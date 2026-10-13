import { describe, expect, test } from 'bun:test'
import {
  builtinThemes,
  defaultDarkThemeId,
  defaultLightThemeId,
  themeAccentsFor,
  themeById,
  variantFromRecord,
} from '../src/lib/themes'
import {
  accentRolesForState,
  defaultThemeSelection,
  initialThemeSelection,
  mergeRegistry,
  mergeThemeSelection,
  resolveAppearance,
  resolveThemeState,
  resolvedDensity,
  selectedThemeId,
  type ThemeSelection,
} from '../src/components/theme/theme-state'
import { getTheme } from '@adea-ai/themes'
import { APPEARANCE_EDITOR_FONT_SIZE_MAX } from '../src/lib/appearance-font-settings'

const select = (patch: Partial<ThemeSelection>): ThemeSelection => ({
  ...defaultThemeSelection,
  ...patch,
})

describe('defaultThemeSelection', () => {
  test('carries only the original axes, so a store never gains a key it did not have', () => {
    // A field added later must stay absent here: JSON.stringify drops `undefined`,
    // which is what keeps an existing consumer's stored document byte-identical.
    expect(Object.keys(defaultThemeSelection)).toEqual([
      'appearance',
      'lightThemeId',
      'darkThemeId',
      'accent',
      'font',
      'fonts',
      'density',
    ])
  })

  test('density defaults to comfortable and tolerates garbage', () => {
    expect(resolvedDensity(defaultThemeSelection)).toBe('comfortable')
    expect(resolvedDensity({ ...defaultThemeSelection, density: 'compact' })).toBe('compact')
    expect(resolvedDensity({ ...defaultThemeSelection, density: 'cramped' as 'compact' })).toBe(
      'comfortable'
    )
  })
})

describe('mergeThemeSelection', () => {
  test('a font patch moves the UI family and keeps the legacy alias in step', () => {
    const next = mergeThemeSelection(defaultThemeSelection, { font: 'geist' })
    expect(next.fonts?.ui.family).toBe('geist')
    expect(next.font).toBe('geist')
    expect(next.fonts?.code.family).toBe('system')
  })

  test('a fonts patch is normalised and wins over the alias', () => {
    const next = mergeThemeSelection(defaultThemeSelection, {
      fonts: {
        ui: { family: 'geist', size: 99 },
        content: { family: 'nope', size: 14 },
        code: { family: 'system', size: 12 },
      } as never,
    })
    expect(next.fonts?.ui.size).toBe(APPEARANCE_EDITOR_FONT_SIZE_MAX)
    expect(next.fonts?.content.family).toBe('system')
    expect(next.font).toBe('geist')
  })

  test('other axes merge without touching the fonts', () => {
    const base = mergeThemeSelection(defaultThemeSelection, { font: 'geist' })
    const next = mergeThemeSelection(base, {
      appearance: 'dark',
      accent: 'violet',
    })
    expect(next).toMatchObject({ appearance: 'dark', accent: 'violet', font: 'geist' })
  })
})

describe('initialThemeSelection', () => {
  test('nothing stored and nothing initial is the defaults', () => {
    expect(initialThemeSelection(undefined, undefined)).toEqual(defaultThemeSelection)
  })

  test('the store sits over the defaults and `initial` sits over the store', () => {
    const next = initialThemeSelection(
      { appearance: 'light', accent: 'violet', darkThemeId: 'nord' },
      { appearance: 'dark', font: 'geist' }
    )
    expect(next.appearance).toBe('dark')
    expect(next.accent).toBe('violet')
    expect(next.darkThemeId).toBe('nord')
    expect(next.font).toBe('geist')
    expect(next.fonts?.ui.family).toBe('geist')
  })

  test('explicit undefined from a store leaves the default standing', () => {
    const next = initialThemeSelection(
      { appearance: undefined, density: undefined, accent: 'blue' },
      undefined
    )
    expect(next.appearance).toBe('system')
    expect(next.density).toBe('comfortable')
    expect(next.accent).toBe('blue')
  })

  test('the result serialises with the original key order', () => {
    expect(Object.keys(initialThemeSelection(undefined, { appearance: 'dark' }))).toEqual(
      Object.keys(defaultThemeSelection)
    )
  })
})

describe('resolution', () => {
  test('system follows the operating system, an explicit choice does not', () => {
    expect(resolveAppearance('system', 'dark')).toBe('dark')
    expect(resolveAppearance('system', 'light')).toBe('light')
    expect(resolveAppearance('light', 'dark')).toBe('light')
    expect(resolveAppearance('dark', 'light')).toBe('dark')
  })

  test('the selection names a theme per appearance', () => {
    const selection = select({ lightThemeId: 'solarized-light', darkThemeId: 'nord' })
    expect(selectedThemeId(selection, 'light')).toBe('solarized-light')
    expect(selectedThemeId(selection, 'dark')).toBe('nord')
  })

  test('a known id resolves to its variant', () => {
    const state = resolveThemeState(
      select({ appearance: 'dark', darkThemeId: 'nord' }),
      'light',
      builtinThemes
    )
    expect(state.appearance).toBe('dark')
    expect(state.variant.id).toBe('nord')
  })

  test('an unknown LIGHT id paints the light default, not the first (dark) variant', () => {
    // The latent bug: the registry's first entry is dark, so an unresolvable id
    // painted a dark palette under a light colour-scheme.
    expect(builtinThemes[0]!.appearance).toBe('dark')
    const state = resolveThemeState(
      select({ appearance: 'light', lightThemeId: 'gone' }),
      'dark',
      builtinThemes
    )
    expect(state.appearance).toBe('light')
    expect(state.variant.id).toBe(defaultLightThemeId)
    expect(state.variant.appearance).toBe('light')
  })

  test('an unknown dark id paints the dark default', () => {
    const state = resolveThemeState(
      select({ appearance: 'dark', darkThemeId: 'gone' }),
      'light',
      builtinThemes
    )
    expect(state.variant.id).toBe(defaultDarkThemeId)
  })

  test('resolving does not rewrite the selection', () => {
    const selection = select({ appearance: 'light', lightThemeId: 'gone' })
    resolveThemeState(selection, 'light', builtinThemes)
    expect(selection.lightThemeId).toBe('gone')
  })

  test('a host variant resolves, and the catalogue wins a collision', () => {
    const record = getTheme('nord')!
    const imported = { ...variantFromRecord({ ...record, id: 'custom-a' }), label: 'Imported' }
    const shadow = { ...variantFromRecord(record), label: 'Shadow' }
    const registry = mergeRegistry(builtinThemes, [imported, shadow])
    expect(registry.length).toBe(builtinThemes.length + 2)

    const ours = resolveThemeState(
      select({ appearance: 'dark', darkThemeId: 'custom-a' }),
      'dark',
      registry
    )
    expect(ours.variant.label).toBe('Imported')
    const collision = resolveThemeState(
      select({ appearance: 'dark', darkThemeId: 'nord' }),
      'dark',
      registry
    )
    expect(collision.variant).toBe(themeById('nord')!)
  })

  test('no extras is the catalogue itself, so a plain array stays a plain array', () => {
    expect(mergeRegistry(builtinThemes, undefined)).toBe(builtinThemes)
    expect(mergeRegistry(builtinThemes, [])).toBe(builtinThemes)
  })
})

describe('a custom accent in the selection', () => {
  test('is stored in one spelling, whichever way it arrives', () => {
    expect(mergeThemeSelection(defaultThemeSelection, { accent: '#0B57D0' }).accent).toBe('#0b57d0')
    expect(initialThemeSelection({ accent: '#ABCDEF' }, undefined).accent).toBe('#abcdef')
    expect(initialThemeSelection(undefined, { accent: '#ABCDEF' }).accent).toBe('#abcdef')
  })

  test('anything that is not a custom colour is stored as given', () => {
    for (const accent of ['violet', 'theme', 'ansi-blue', '#abc', 'Not-An-Accent']) {
      expect(mergeThemeSelection(defaultThemeSelection, { accent }).accent).toBe(accent)
    }
  })

  test('leaves the stored shape of a consumer that never uses one untouched', () => {
    const merged = mergeThemeSelection(defaultThemeSelection, { appearance: 'dark' })
    expect(Object.keys(merged).toSorted()).toEqual(Object.keys(defaultThemeSelection).toSorted())
  })
})

const state = (patch: Partial<ThemeSelection> = {}, floor?: number) => {
  const selection = select({ appearance: 'dark', ...patch })
  return {
    selection,
    variant: themeById('adea-dark')!,
    registry: builtinThemes,
    accentContrastFloor: floor,
  }
}

describe('accentRolesForState', () => {
  test('null, theme and unresolvable accents override nothing', () => {
    expect(accentRolesForState(null, undefined, state())).toBeUndefined()
    expect(accentRolesForState('theme', undefined, state())).toBeUndefined()
    expect(accentRolesForState('chartreuse', undefined, state())).toBeUndefined()
    expect(accentRolesForState('#abc', undefined, state())).toBeUndefined()
  })

  test('defaults to the variant in use and takes the appearance of the variant it is asked for', () => {
    const own = accentRolesForState('violet', undefined, state())!
    expect(own).toEqual(accentRolesForState('violet', 'adea-dark', state())!)
    const light = accentRolesForState('violet', 'adea-light', state())!
    expect(light.primary).not.toBe(own.primary)
  })

  test('a variant the registry does not hold overrides nothing', () => {
    expect(accentRolesForState('violet', 'gone', state())).toBeUndefined()
  })

  test('resolves a theme accent against the selection pair, and a custom colour against the floor', () => {
    const offered = themeAccentsFor(defaultLightThemeId, defaultDarkThemeId)[0]!
    expect(accentRolesForState(offered.id, undefined, state())).toBeDefined()
    expect(accentRolesForState('ansi-not-a-slot', undefined, state())).toBeUndefined()

    const lenient = accentRolesForState('#7a9cff', undefined, state())!
    const strict = accentRolesForState('#7a9cff', undefined, state({}, 12))!
    expect(strict.primary).not.toBe(lenient.primary)
  })
})
