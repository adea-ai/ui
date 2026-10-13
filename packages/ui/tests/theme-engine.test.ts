import { describe, expect, test } from 'bun:test'
import { ACCENTS } from '@adea-ai/themes'
import { catalogueThemeEngine } from '../src/lib/theme-catalogue'
import { DEFAULT_VARIANTS } from '../src/lib/theme-defaults'
import { CatalogueRequired, needsCatalogue } from '../src/lib/theme-engine'
import { lightThemeEngine } from '../src/lib/theme-engine-light'
import { terminalCssVariables as terminalFromCss } from '../src/lib/theme-css'
import { builtinThemes, themeById, themeCssVariables, type ThemeVariant } from '../src/lib/themes'

const light = themeById('adea-light')!
const dark = themeById('adea-dark')!
const pair = { lightThemeId: 'adea-light', darkThemeId: 'adea-dark' }
const presets = ACCENTS.map((accent) => accent.id)
const accents = ['theme', ...presets, '#7a9cff', '#101010', '#ffffff', 'ansi-blue', 'ansi-green']

describe('the light engine answers like the catalogue where it can answer', () => {
  test('its built-in variants are the default pair, in catalogue order', () => {
    expect(lightThemeEngine.builtinThemes.map((theme) => theme.id)).toEqual([
      'adea-light',
      'adea-dark',
    ])
    expect(catalogueThemeEngine.builtinThemes).toBe(builtinThemes)
  })

  test('custom properties of the default pair, under both editor projections', () => {
    for (const shipped of Object.values(DEFAULT_VARIANTS)) {
      for (const options of [
        undefined,
        { editor: 'syntax' as const },
        { editor: 'floor' as const },
      ]) {
        // The shipped variant is the light engine's catalogue variant; the catalogue's own
        // object (identity) is the full engine's. Values must agree either way.
        const catalogue = themeById(shipped.id)!
        expect(lightThemeEngine.themeCssVariables(shipped, options)).toEqual(
          catalogueThemeEngine.themeCssVariables(catalogue, options)
        )
        expect(lightThemeEngine.themeCssVariables(shipped, options)).toEqual(
          themeCssVariables(catalogue, options)
        )
      }
    }
  })

  test('a host variant that is not in the catalogue paints the same in both', () => {
    const imported: ThemeVariant = {
      ...DEFAULT_VARIANTS['adea-dark'],
      id: 'imported-one',
      tokens: { '--background': '#010203', '--terminal-extra': '#040506' },
    }
    for (const editor of ['syntax', 'floor'] as const) {
      expect(lightThemeEngine.themeCssVariables(imported, { editor })).toEqual(
        catalogueThemeEngine.themeCssVariables(imported, { editor })
      )
    }
  })

  test('identity: only the shipped default objects are the catalogue’s own', () => {
    expect(lightThemeEngine.isCatalogueVariant(DEFAULT_VARIANTS['adea-dark'])).toBe(true)
    expect(lightThemeEngine.isCatalogueVariant({ ...DEFAULT_VARIANTS['adea-dark'] })).toBe(false)
    expect(
      lightThemeEngine.isCatalogueVariant({ ...DEFAULT_VARIANTS['adea-dark'], id: 'imported' })
    ).toBe(false)
    expect(catalogueThemeEngine.isCatalogueVariant(dark)).toBe(true)
    expect(catalogueThemeEngine.isCatalogueVariant({ ...dark })).toBe(false)
  })

  test('accent overrides, every accent over every default appearance and floor', () => {
    for (const accent of accents) {
      for (const variant of [light, dark]) {
        for (const floor of [undefined, 3, 7, 12]) {
          const options = {
            background: variant.colors.background,
            floor,
            variantId: variant.id,
          }
          expect(
            lightThemeEngine.accentVariables(accent, variant.appearance, pair, options),
            `${accent} ${variant.id} floor ${floor}`
          ).toEqual(catalogueThemeEngine.accentVariables(accent, variant.appearance, pair, options))
        }
      }
    }
  })

  test('accent roles are exact when the tint is the theme’s own, and refused when it is not', () => {
    let exact = 0
    let refused = 0
    for (const accent of accents) {
      for (const variant of [light, dark]) {
        const options = { background: variant.colors.background, variantId: variant.id }
        const full = catalogueThemeEngine.accentRolesForSelection(
          accent,
          variant.appearance,
          pair,
          options
        )
        try {
          expect(
            lightThemeEngine.accentRolesForSelection(accent, variant.appearance, pair, options),
            `${accent} ${variant.id}`
          ).toEqual(full)
          exact += 1
        } catch (error) {
          if (!(error instanceof CatalogueRequired)) throw error
          // Refusal is only for an accent the contrast floor repaired: the catalogue's
          // primary is then not the accent's own colour.
          const unrepaired = catalogueThemeEngine.accentRolesForSelection(
            accent,
            variant.appearance,
            pair,
            { ...options, floor: Number.NEGATIVE_INFINITY }
          )
          expect(full?.primary, `${accent} ${variant.id}`).not.toBe(unrepaired?.primary)
          refused += 1
        }
      }
    }
    expect(exact).toBeGreaterThan(refused)
    expect(refused).toBeGreaterThan(0)
  })

  test('accent roles for a repaired accent over a default need the catalogue to measure the tint', () => {
    // #101010 on the dark canvas is below the 12:1 floor, so the primary is repaired and
    // its tint is measured against the repaired colour, which only the catalogue can do.
    const options = { background: dark.colors.background, floor: 12, variantId: 'adea-dark' }
    expect(() =>
      lightThemeEngine.accentRolesForSelection('#101010', 'dark', pair, options)
    ).toThrow(CatalogueRequired)
    // The document properties do not read the tint, so they are still exact.
    expect(lightThemeEngine.accentVariables('#101010', 'dark', pair, options)).toEqual(
      catalogueThemeEngine.accentVariables('#101010', 'dark', pair, options)
    )
    // Without a variant there is no record to measure and nothing to correct.
    const bare = { background: dark.colors.background, floor: 12 }
    expect(lightThemeEngine.accentRolesForSelection('#101010', 'dark', pair, bare)).toEqual(
      catalogueThemeEngine.accentRolesForSelection('#101010', 'dark', pair, bare)
    )
  })

  test('theme accents of the default pair are shipped', () => {
    expect(lightThemeEngine.themeAccentsFor('adea-light', 'adea-dark')).toEqual(
      catalogueThemeEngine.themeAccentsFor('adea-light', 'adea-dark')
    )
    // An unknown id stands in as the default, as the catalogue resolves it.
    expect(lightThemeEngine.themeAccentsFor('gone', 'also-gone')).toEqual(
      catalogueThemeEngine.themeAccentsFor('gone', 'also-gone')
    )
  })
})

describe('what the light engine cannot answer', () => {
  test('refuses a catalogue theme beyond the defaults, in every operation', () => {
    const nord = themeById('nord')!
    expect(() => lightThemeEngine.themeCssVariables(nord)).toThrow(CatalogueRequired)
    expect(() => lightThemeEngine.themeAccentsFor('adea-light', 'nord')).toThrow(CatalogueRequired)
    expect(() =>
      lightThemeEngine.accentVariables('ansi-blue', 'dark', { ...pair, darkThemeId: 'nord' }, {})
    ).toThrow(CatalogueRequired)
    expect(() =>
      lightThemeEngine.accentRolesForSelection('violet', 'dark', pair, { variantId: 'nord' })
    ).toThrow(CatalogueRequired)
  })

  test('answers presets and custom colours over any pair, because they ignore the pair', () => {
    const away = { lightThemeId: 'adea-light', darkThemeId: 'nord' }
    expect(lightThemeEngine.accentVariables('violet', 'dark', away, {})).toBeDefined()
    expect(lightThemeEngine.accentVariables('theme', 'dark', away, {})).toBeUndefined()
  })

  test('the error names what was asked', () => {
    expect(() => lightThemeEngine.themeCssVariables(themeById('nord')!)).toThrow(
      'needs the theme catalogue'
    )
  })
})

describe('needsCatalogue', () => {
  const base = { lightThemeId: 'adea-light', darkThemeId: 'adea-dark', accent: 'violet' }

  test('the default pair, any preset, custom colour or unknown id does not', () => {
    expect(needsCatalogue(base, 'dark')).toBe(false)
    expect(needsCatalogue({ ...base, accent: '#7a9cff' }, 'light')).toBe(false)
    expect(needsCatalogue({ ...base, accent: 'ansi-blue' }, 'dark')).toBe(false)
    expect(needsCatalogue({ ...base, darkThemeId: 'imported-by-the-host' }, 'dark')).toBe(false)
    expect(needsCatalogue({ ...base, terminalThemeId: 'theme' }, 'dark')).toBe(false)
    expect(needsCatalogue({ ...base, terminalThemeId: 'adea-light' }, 'dark')).toBe(false)
  })

  test('only the theme being shown counts, until an ansi accent reads the whole pair', () => {
    const away = { ...base, darkThemeId: 'nord' }
    expect(needsCatalogue(away, 'dark')).toBe(true)
    expect(needsCatalogue(away, 'light')).toBe(false)
    expect(needsCatalogue({ ...away, accent: 'ansi-blue' }, 'light')).toBe(true)
  })

  test('a pinned terminal theme from the catalogue does', () => {
    expect(needsCatalogue({ ...base, terminalThemeId: 'dracula' }, 'dark')).toBe(true)
  })
})

describe('terminalCssVariables without the catalogue', () => {
  test('is the terminal slice of the full variable map, for every built-in and a host variant', () => {
    const imported: ThemeVariant = {
      ...DEFAULT_VARIANTS['adea-dark'],
      id: 'imported-two',
      tokens: { '--terminal-background': '#123456', '--terminal-only-here': '#abcdef', '--x': '1' },
    }
    for (const theme of [...builtinThemes, imported]) {
      const expected = Object.fromEntries(
        Object.entries(themeCssVariables(theme)).filter(([name]) => name.startsWith('--terminal-'))
      )
      expect(terminalFromCss(theme), theme.id).toEqual(expected)
    }
  })
})
