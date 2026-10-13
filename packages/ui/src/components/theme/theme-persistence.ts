import { normalizeCustomAccent } from '#lib/accent-roles'
import { accentPresets } from '#lib/accent-presets'
import { normalizeAppearanceEditorFontSettings } from '#lib/appearance-font-settings'
import { isThemeAccentId } from '#lib/theme-accents'
import {
  catalogueThemeAppearance,
  defaultDarkThemeId,
  defaultLightThemeId,
} from '#lib/theme-defaults'
import { normalizeSurface } from '#lib/theme-surface'
import {
  defaultPreferenceStorage,
  readLegacyValue,
  readVersionedRecord,
  recoveryKeyFor,
  writeVersionedRecord,
  type PreferenceStorage,
} from '#lib/preference-store'
import { defaultThemeSelection, resolvedDensity, type ThemeSelection } from './theme-state-core'

/**
 * Where a selection is kept between sessions.
 *
 * The provider never touches storage itself; it asks a `ThemePersistence`. The
 * default is {@link localStoragePersistence}, which is what the provider always did.
 * A host that stores the preference in a different shape, under a versioned
 * envelope, or somewhere that is not `localStorage` supplies its own and the
 * resolution and application rules stay the shared ones.
 *
 * The contract is deliberately narrow, so that an implementation cannot make the
 * provider less safe than it was:
 *
 *   - `read` is synchronous and runs once, when the provider is created. It may
 *     repair or quarantine what it finds, and it must not throw: the provider
 *     treats a throw as "nothing stored" and starts from the defaults.
 *   - `write` runs only from `setSelection`. Never on mount, never from `preview`,
 *     never as a side effect of reading, so the first write to a store is always a
 *     user's decision. A throw is swallowed, because a full or blocked store must
 *     not break the switch.
 */
export type ThemePersistence = {
  read(): Partial<ThemeSelection> | undefined
  write(next: ThemeSelection): void
}

/**
 * The preference store, or nothing.
 *
 * Only ever called inside a `try`: where storage is blocked — a sandboxed iframe, a
 * privacy mode, a denied site-data permission — merely *reading* the `localStorage`
 * global throws ("Access is denied", `SecurityError`), so even the `typeof` guard
 * has to sit inside the `try` rather than in front of it. Without a store the
 * preference lives only in the provider's signal for the session.
 */
function preferenceStore(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

/**
 * The stored preference, validated against the catalogue's ids (`theme-defaults`), so
 * reading it never loads the catalogue.
 */
function readSelection(storageKey: string): ThemeSelection {
  try {
    const raw = preferenceStore()?.getItem(storageKey)
    if (!raw) return defaultThemeSelection
    const parsed = JSON.parse(raw) as Partial<ThemeSelection>
    const fonts = normalizeAppearanceEditorFontSettings(parsed.fonts, parsed.font).settings
    return {
      appearance:
        parsed.appearance === 'light' ||
        parsed.appearance === 'dark' ||
        parsed.appearance === 'system'
          ? parsed.appearance
          : defaultThemeSelection.appearance,
      // An unknown id would leave the document with no theme at all, so a stale
      // preference from an older catalogue falls back rather than applying nothing.
      lightThemeId:
        catalogueThemeAppearance(parsed.lightThemeId ?? '') === 'light'
          ? (parsed.lightThemeId as string)
          : defaultLightThemeId,
      darkThemeId:
        catalogueThemeAppearance(parsed.darkThemeId ?? '') === 'dark'
          ? (parsed.darkThemeId as string)
          : defaultDarkThemeId,
      // A theme accent is kept whenever it names a slot, even one the stored pair
      // cannot offer: the id is role-shaped so it survives a theme switch, and an
      // unoffered slot already resolves to the theme's own primary when applied. A
      // custom `#rrggbb` is kept in its one stored spelling; its readability is
      // settled when it is painted, not when it is read.
      accent:
        typeof parsed.accent === 'string' &&
        (accentPresets.some((preset) => preset.id === parsed.accent) ||
          isThemeAccentId(parsed.accent))
          ? parsed.accent
          : (normalizeCustomAccent(parsed.accent) ?? defaultThemeSelection.accent),
      font: fonts.ui.family,
      fonts,
      // Every axis has to be read back here, or it is lost twice: the provider's
      // document effect removes the `data-density` that `themeScript` set for the first paint, and
      // the next `setSelection` rewrites the store without it.
      density: resolvedDensity(parsed as ThemeSelection),
      // The newer axes are read back only when the store holds a usable value and are
      // otherwise left `undefined`, never defaulted: `JSON.stringify` drops them, so a
      // consumer that never sets one writes the bytes it always did. An id is kept as
      // stored, known or not, for the same reason a theme id the registry lacks is.
      terminalThemeId:
        typeof parsed.terminalThemeId === 'string' && parsed.terminalThemeId.trim() !== ''
          ? parsed.terminalThemeId
          : undefined,
      surface: normalizeSurface(parsed.surface),
      reduceTransparency:
        typeof parsed.reduceTransparency === 'boolean' ? parsed.reduceTransparency : undefined,
    }
  } catch {
    return defaultThemeSelection
  }
}

/**
 * The default persistence: one JSON document in `localStorage` under `key`.
 *
 * `read` is the provider's original `readSelection`, moved here unchanged — every
 * stored id is validated against the catalogue, so a stale preference falls back to
 * a default rather than reaching the document. `key` may be a function so a
 * provider whose `storageKey` prop changes writes to the key it is now given.
 *
 * Blocked, full or absent storage is survivable in both directions: a read answers
 * with the defaults and a write is dropped, so the preference simply lasts the
 * session.
 */
export function localStoragePersistence(key: string | (() => string)): ThemePersistence {
  const keyOf = () => (typeof key === 'function' ? key() : key)
  return {
    read: () => readSelection(keyOf()),
    write(next) {
      try {
        preferenceStore()?.setItem(keyOf(), JSON.stringify(next))
      } catch {
        // A full, blocked or unavailable store must not break the switch: the
        // preference simply does not survive the reload.
      }
    },
  }
}

/**
 * What a persistence knows, or nothing.
 *
 * The seam's `read` must not throw, and the provider does not rely on that: a host
 * persistence is code the design system has not seen, and a theme provider that
 * fails to mount because a store misbehaved has turned a lost preference into a
 * blank application.
 */
export function readPersisted(persistence: ThemePersistence): Partial<ThemeSelection> | undefined {
  try {
    return persistence.read()
  } catch {
    return undefined
  }
}

/** Hand a selection to the store; a store that throws loses the preference, not the switch. */
export function writePersisted(persistence: ThemePersistence, next: ThemeSelection): void {
  try {
    persistence.write(next)
  } catch {
    // Same contract as a full or blocked `localStorage`: the choice holds for the
    // session and does not survive the reload.
  }
}

/**
 * Where a host's versioned preference document lives. One schema describes the
 * document to both halves of the system: {@link createVersionedPersistence} reads and
 * writes it, and `themeScript(options)` reads it before first paint, so the two
 * cannot disagree about a key or a version.
 */
export type ThemeStorageSchema = {
  /** The storage key of the document. */
  key: string
  /**
   * The only top-level `version` read. Absent, the document is unversioned. A record
   * of any other version is quarantined (see `recoveryKey`), not interpreted.
   */
  version?: number
  /**
   * The document field that holds the appearance preference (`system`, `light`,
   * `dark`). Read by `themeScript`; the persistence leaves field names to the codec.
   * Default `appearance`.
   */
  appearanceField?: 'appearance' | 'mode'
  /**
   * An older single-value key (`light` | `dark` | `system`) read only while `key` is
   * absent, and never deleted. The persistence hands it to the codec's `fromLegacy`.
   */
  legacyAppearanceKey?: string
  /**
   * The stored library of imported themes, for `themeScript` only: an imported
   * theme's id and verbatim tokens, so the first paint can use the right variant. The
   * persistence neither reads nor writes it.
   */
  libraryKey?: string
  /** Where an unreadable document is kept. Default `${key}.recovery`. */
  recoveryKey?: string
}

/**
 * How a host's document maps to and from the shared {@link ThemeSelection}.
 *
 * The codec is the product schema: it decides which fields a document has, how an
 * unknown value is corrected, and what a fresh install looks like. The engine decides
 * everything about *storage*: what is quarantined, when the legacy key is read, and
 * that nothing is written until `setSelection` asks.
 */
export type VersionedCodec<Doc> = {
  /**
   * A readable record (the right JSON shape and version) as a selection patch. Fields
   * it leaves `undefined` fall back to the provider's defaults. It may keep an id the
   * catalogue lacks; the provider resolves it, it does not rewrite it.
   */
  decode(record: Readonly<Record<string, unknown>>): Partial<ThemeSelection>
  /**
   * The legacy key's value (never `null`) as a selection patch, or `undefined` for a
   * value it does not recognise. Called only when the main key is absent.
   */
  fromLegacy?(value: string): Partial<ThemeSelection> | undefined
  /**
   * What a store with nothing readable answers: a fresh install, an unreadable
   * document, a blocked store. Absent, the provider's own defaults apply.
   */
  defaults?(): Partial<ThemeSelection> | undefined
  /**
   * The document to store for a selection. `previous` is the record last read or
   * written, so a codec can carry a field the selection does not model.
   */
  encode(next: ThemeSelection, previous?: Readonly<Record<string, unknown>>): Doc
}

/** Seams for the storage and the clock; both default to the real ones. */
export type VersionedPersistenceOptions = {
  /** The store, or nothing. Called per access; default is `localStorage` (blocked-safe). */
  storage?: () => PreferenceStorage | undefined
  /** The clock for the recovery envelope's `capturedAt`. */
  now?: () => Date
}

/**
 * A {@link ThemePersistence} over a versioned document and a host codec.
 *
 * `read` follows the engine's rules (`lib/preference-store.ts`): the main key first;
 * an unreadable or unsupported document is quarantined byte for byte into the
 * recovery key and the codec's `defaults` answer; the legacy key only when the main
 * key is absent. It never writes the main key, so the first write is a user's
 * decision. `write` stores `codec.encode(next, previous)` as JSON and swallows a
 * failure.
 *
 * Neither method throws. The stored bytes are exactly what the codec encodes, so a
 * host keeps its keys, field names and bytes by keeping its codec.
 */
export function createVersionedPersistence<Doc>(
  schema: ThemeStorageSchema,
  codec: VersionedCodec<Doc>,
  options: VersionedPersistenceOptions = {}
): ThemePersistence {
  const storageOf = options.storage ?? defaultPreferenceStorage
  const recordSchema = {
    key: schema.key,
    version: schema.version,
    recoveryKey: recoveryKeyFor(schema),
  }
  let previous: Readonly<Record<string, unknown>> | undefined

  const fallback = () => {
    try {
      return codec.defaults?.()
    } catch {
      return undefined
    }
  }

  return {
    read() {
      const storage = storageOf()
      if (!storage) return fallback()
      try {
        const found = readVersionedRecord(storage, recordSchema, options.now)
        if (found.status === 'record') {
          previous = found.record
          return codec.decode(found.record)
        }
        if (found.status === 'absent' && schema.legacyAppearanceKey && codec.fromLegacy) {
          const legacy = readLegacyValue(storage, schema.legacyAppearanceKey)
          const migrated = legacy === null ? undefined : codec.fromLegacy(legacy)
          if (migrated) return migrated
        }
      } catch {
        // A codec that throws on a record it cannot read is an unreadable store.
      }
      return fallback()
    },
    write(next) {
      const storage = storageOf()
      if (!storage) return
      try {
        const document = codec.encode(next, previous)
        if (writeVersionedRecord(storage, schema.key, document)) {
          previous =
            typeof document === 'object' && document !== null
              ? (document as Readonly<Record<string, unknown>>)
              : undefined
        }
      } catch {
        // An encoder that throws loses the preference, not the switch.
      }
    },
  }
}
