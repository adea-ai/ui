import { describe, expect, test } from 'bun:test'
import {
  createVersionedPersistence,
  localStoragePersistence,
  readPersisted,
  writePersisted,
  type ThemeStorageSchema,
  type VersionedCodec,
} from '../src/components/theme/theme-persistence'
import {
  defaultThemeSelection,
  initialThemeSelection,
  mergeThemeSelection,
  type ThemeSelection,
} from '../src/components/theme/theme-state'
import { normalizeAppearanceEditorFontSettings } from '../src/lib/appearance-font-settings'
import { normalizeCustomAccent } from '../src/lib/accent-roles'
import { normalizeSurface } from '../src/lib/theme-surface'
import { accentPresets } from '../src/lib/tokens'
import { isThemeAccentId } from '../src/lib/themes'
import type { PreferenceStorage } from '../src/lib/preference-store'
import { blockLocalStorage, installLocalStorage } from './helpers/fake-root'

/**
 * A host codec shaped like adea's V2 document (`mode` for `appearance`, a `version`,
 * the legacy `theme` key, keys `appearance`, `appearance.library`,
 * `appearance.recovery`). It is the contract the engine must let a host keep
 * byte for byte, so it lives here as the reference host.
 */
const SCHEMA: ThemeStorageSchema = {
  key: 'appearance',
  version: 2,
  appearanceField: 'mode',
  legacyAppearanceKey: 'theme',
  libraryKey: 'appearance.library',
  recoveryKey: 'appearance.recovery',
}

type V2 = {
  version: 2
  mode: 'system' | 'light' | 'dark'
  lightThemeId: string
  darkThemeId: string
  terminalThemeId: string
  accent: string
  surface: 'opaque' | 'frosted' | 'translucent'
  reduceTransparency: boolean
  fonts?: ReturnType<typeof normalizeAppearanceEditorFontSettings>['settings']
}

const DEFAULTS: Omit<V2, 'fonts'> = {
  version: 2,
  mode: 'system',
  lightThemeId: 'adea-light',
  darkThemeId: 'adea-dark',
  terminalThemeId: 'theme',
  accent: 'violet',
  surface: 'opaque',
  reduceTransparency: false,
}

const id = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback

function toSelection(doc: V2 | typeof DEFAULTS): Partial<ThemeSelection> {
  return {
    appearance: doc.mode,
    lightThemeId: doc.lightThemeId,
    darkThemeId: doc.darkThemeId,
    terminalThemeId: doc.terminalThemeId,
    accent: doc.accent,
    surface: doc.surface,
    reduceTransparency: doc.reduceTransparency,
    ...('fonts' in doc && doc.fonts ? { fonts: doc.fonts } : {}),
  }
}

const codec: VersionedCodec<V2> = {
  decode(record) {
    const accent = record['accent']
    return toSelection({
      version: 2,
      mode:
        record['mode'] === 'light' || record['mode'] === 'dark' || record['mode'] === 'system'
          ? record['mode']
          : 'system',
      lightThemeId: id(record['lightThemeId'], DEFAULTS.lightThemeId),
      darkThemeId: id(record['darkThemeId'], DEFAULTS.darkThemeId),
      terminalThemeId: id(record['terminalThemeId'], 'theme'),
      accent:
        typeof accent === 'string' &&
        accent !== 'theme' &&
        (accentPresets.some((preset) => preset.id === accent) || isThemeAccentId(accent))
          ? accent
          : (normalizeCustomAccent(accent) ?? 'violet'),
      surface: normalizeSurface(record['surface']) ?? 'opaque',
      reduceTransparency: record['reduceTransparency'] === true,
      ...(record['fonts'] === undefined
        ? {}
        : { fonts: normalizeAppearanceEditorFontSettings(record['fonts']).settings }),
    })
  },
  fromLegacy: (value) =>
    value === 'light' || value === 'dark' || value === 'system'
      ? toSelection({ ...DEFAULTS, mode: value })
      : undefined,
  defaults: () => toSelection(DEFAULTS),
  encode(next, previous) {
    return {
      version: 2,
      mode: next.appearance,
      lightThemeId: next.lightThemeId,
      darkThemeId: next.darkThemeId,
      terminalThemeId: next.terminalThemeId ?? 'theme',
      accent: next.accent,
      surface: next.surface ?? 'opaque',
      reduceTransparency: next.reduceTransparency ?? false,
      // Only when the stored document had it, so untouched fonts keep today's bytes.
      ...(previous?.['fonts'] === undefined ? {} : { fonts: next.fonts }),
    }
  },
}

function memory(initial: Record<string, string> = {}) {
  const backing = new Map(Object.entries(initial))
  const writes: Array<[string, string]> = []
  const storage: PreferenceStorage = {
    getItem: (key) => backing.get(key) ?? null,
    setItem(key, value) {
      writes.push([key, value])
      backing.set(key, value)
    },
  }
  const persistence = createVersionedPersistence(SCHEMA, codec, {
    storage: () => storage,
    now: () => new Date('2026-10-13T08:00:00.000Z'),
  })
  return { backing, writes, persistence }
}

describe('createVersionedPersistence.read', () => {
  test('a fresh install answers the codec defaults and writes nothing', () => {
    const { persistence, writes } = memory()
    expect(persistence.read()).toEqual(toSelection(DEFAULTS))
    expect(writes).toEqual([])
  })

  test('a V2 record is decoded field by field, keeping ids it does not know', () => {
    const { persistence, writes } = memory({
      appearance: JSON.stringify({
        version: 2,
        mode: 'dark',
        darkThemeId: 'custom-deleted-import',
        accent: '#0B57D0',
        surface: 'glass',
      }),
    })
    expect(persistence.read()).toMatchObject({
      appearance: 'dark',
      darkThemeId: 'custom-deleted-import',
      lightThemeId: 'adea-light',
      accent: '#0b57d0',
      surface: 'opaque',
    })
    expect(writes).toEqual([])
  })

  test('the legacy theme key migrates only while the main key is absent, and stays', () => {
    const { persistence, backing, writes } = memory({ theme: 'dark' })
    expect(persistence.read()).toMatchObject({ appearance: 'dark', accent: 'violet' })
    expect(backing.get('theme')).toBe('dark')
    expect(writes).toEqual([])
    expect(memory({ theme: 'bogus' }).persistence.read()).toEqual(toSelection(DEFAULTS))
  })

  test('a corrupt main document is quarantined and does not resurrect the legacy key', () => {
    const corrupt = '{"version":2,"mode":"da'
    const { persistence, backing } = memory({ appearance: corrupt, theme: 'dark' })
    expect(persistence.read()).toEqual(toSelection(DEFAULTS))
    expect(JSON.parse(backing.get('appearance.recovery')!)).toEqual({
      schemaVersion: 1,
      reason: 'corrupt_json',
      capturedAt: '2026-10-13T08:00:00.000Z',
      raw: corrupt,
    })
    expect(backing.get('appearance')).toBe(corrupt)
  })

  test('a future version is quarantined byte for byte and survives a later write', () => {
    const future = JSON.stringify({ version: 3, mode: 'sepia', nextThing: true })
    const { persistence, backing } = memory({ appearance: future })
    expect(persistence.read()).toEqual(toSelection(DEFAULTS))
    expect(JSON.parse(backing.get('appearance.recovery')!)).toMatchObject({
      reason: 'unsupported_record',
      raw: future,
    })
    persistence.write(mergeThemeSelection(defaultThemeSelection, { appearance: 'dark' }))
    expect(JSON.parse(backing.get('appearance.recovery')!).raw).toBe(future)
    expect(JSON.parse(backing.get('appearance')!)).toMatchObject({ version: 2, mode: 'dark' })
  })

  test('the recovery key defaults to <key>.recovery', () => {
    const backing = new Map([['appearance', 'nope']])
    const storage: PreferenceStorage = {
      getItem: (key) => backing.get(key) ?? null,
      setItem: (key, value) => void backing.set(key, value),
    }
    const { recoveryKey: _omitted, ...withoutRecovery } = SCHEMA
    createVersionedPersistence(withoutRecovery, codec, { storage: () => storage }).read()
    expect(backing.has('appearance.recovery')).toBe(true)
  })

  test('blocked or absent storage answers the defaults and never throws', () => {
    const restore = blockLocalStorage()
    try {
      const persistence = createVersionedPersistence(SCHEMA, codec)
      expect(persistence.read()).toEqual(toSelection(DEFAULTS))
      expect(() => persistence.write(defaultThemeSelection)).not.toThrow()
    } finally {
      restore()
    }
    const absent = createVersionedPersistence(SCHEMA, codec, { storage: () => undefined })
    expect(absent.read()).toEqual(toSelection(DEFAULTS))
    expect(() => absent.write(defaultThemeSelection)).not.toThrow()
  })

  test('a codec that throws is an unreadable store, not a crash', () => {
    const backing = new Map([['appearance', JSON.stringify({ version: 2 })]])
    const storage: PreferenceStorage = {
      getItem: (key) => backing.get(key) ?? null,
      setItem: (key, value) => void backing.set(key, value),
    }
    const persistence = createVersionedPersistence(
      SCHEMA,
      {
        decode() {
          throw new Error('decode exploded')
        },
        defaults() {
          throw new Error('defaults exploded')
        },
        encode() {
          throw new Error('encode exploded')
        },
      },
      { storage: () => storage }
    )
    expect(persistence.read()).toBeUndefined()
    expect(() => persistence.write(defaultThemeSelection)).not.toThrow()
    expect(backing.get('appearance')).toBe(JSON.stringify({ version: 2 }))
  })

  test('without defaults or a legacy codec the provider defaults apply', () => {
    const backing = new Map<string, string>([['theme', 'dark']])
    const storage: PreferenceStorage = {
      getItem: (key) => backing.get(key) ?? null,
      setItem: (key, value) => void backing.set(key, value),
    }
    const persistence = createVersionedPersistence(
      SCHEMA,
      { decode: () => ({}), encode: (next) => next },
      { storage: () => storage }
    )
    expect(persistence.read()).toBeUndefined()
  })
})

describe('createVersionedPersistence.write', () => {
  test('stores exactly the codec document under the main key, nothing else', () => {
    const { persistence, writes } = memory()
    const next = mergeThemeSelection(defaultThemeSelection, {
      appearance: 'dark',
      darkThemeId: 'nord',
      accent: 'blue',
      surface: 'frosted',
      reduceTransparency: true,
      terminalThemeId: 'dracula',
    })
    persistence.write(next)
    expect(writes).toEqual([
      [
        'appearance',
        '{"version":2,"mode":"dark","lightThemeId":"adea-light","darkThemeId":"nord","terminalThemeId":"dracula","accent":"blue","surface":"frosted","reduceTransparency":true}',
      ],
    ])
  })

  test('the previous record reaches the encoder, then the written document replaces it', () => {
    const fonts = { ui: { family: 'geist', size: 16 } }
    const { persistence, backing } = memory({
      appearance: JSON.stringify({ version: 2, mode: 'light', fonts }),
    })
    const read = persistence.read()!
    persistence.write(mergeThemeSelection(defaultThemeSelection, read))
    expect(JSON.parse(backing.get('appearance')!)).toHaveProperty('fonts')

    const fresh = memory()
    fresh.persistence.read()
    fresh.persistence.write(defaultThemeSelection)
    expect(JSON.parse(fresh.backing.get('appearance')!)).not.toHaveProperty('fonts')
  })

  test('write then read round-trips and creates no recovery envelope', () => {
    const { persistence, backing } = memory()
    persistence.write(
      mergeThemeSelection(defaultThemeSelection, {
        appearance: 'light',
        lightThemeId: 'solarized-light',
        accent: '#112233',
        surface: 'translucent',
        reduceTransparency: true,
      })
    )
    expect(persistence.read()).toMatchObject({
      appearance: 'light',
      lightThemeId: 'solarized-light',
      accent: '#112233',
      surface: 'translucent',
      reduceTransparency: true,
    })
    expect(backing.has('appearance.recovery')).toBe(false)
  })

  test('a full store loses the preference, not the switch', () => {
    const persistence = createVersionedPersistence(SCHEMA, codec, {
      storage: () => ({
        getItem: () => null,
        setItem() {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        },
      }),
    })
    expect(() => writePersisted(persistence, defaultThemeSelection)).not.toThrow()
  })
})

describe('with the provider seam', () => {
  test('initial still wins over the stored document, which wins over the defaults', () => {
    const { persistence } = memory({
      appearance: JSON.stringify({ version: 2, mode: 'light', accent: 'blue' }),
    })
    const selection = initialThemeSelection(readPersisted(persistence), { appearance: 'dark' })
    expect(selection.appearance).toBe('dark')
    expect(selection.accent).toBe('blue')
    expect(selection.lightThemeId).toBe('adea-light')
  })
})

describe('Cortana invariants: the default persistence is untouched', () => {
  const KEY = 'cortana.appearance'

  test('its stored bytes are the selection as JSON, with none of the newer axes', () => {
    const installed = installLocalStorage()
    try {
      const persistence = localStoragePersistence(KEY)
      const next = initialThemeSelection(persistence.read(), {
        appearance: 'dark',
        accent: 'theme',
        font: 'geist',
      })
      persistence.write(next)
      expect(installed.backing.get(KEY)).toBe(JSON.stringify(next))
      expect(Object.keys(JSON.parse(installed.backing.get(KEY)!)).toSorted()).toEqual([
        'accent',
        'appearance',
        'darkThemeId',
        'density',
        'font',
        'fonts',
        'lightThemeId',
      ])
    } finally {
      installed.restore()
    }
  })

  test('reading a damaged document writes nothing: no recovery key appears', () => {
    const installed = installLocalStorage({ [KEY]: '{"appearance":"da' })
    try {
      localStoragePersistence(KEY).read()
      expect([...installed.backing.keys()]).toEqual([KEY])
      expect(installed.backing.get(KEY)).toBe('{"appearance":"da')
    } finally {
      installed.restore()
    }
  })
})
