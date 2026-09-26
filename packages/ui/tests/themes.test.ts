import { describe, expect, test } from 'bun:test'
import { parseColor, themes as catalogue } from '@adea-ai/themes'
import {
  builtinThemes,
  contrastRatio,
  themeById,
  themeCssVariables,
  themeFamilies,
  themesForAppearance,
  validateThemeRegistry,
} from '../src/lib/themes'

/**
 * The registry's gate.
 *
 * The catalogue itself has its own suite, in its own repository, and it is the one
 * that measures the palettes — these tests are about the *bridge*: that every
 * catalogue entry survives the translation into this system's vocabulary, that the
 * shadcn mapping produces a complete set of variables, and that a theme this system
 * asks for is one the catalogue actually has.
 *
 * The floors are no longer restated here, deliberately. They used to be, and the
 * second copy is the one that would have drifted.
 */
describe('theme registry', () => {
  test('the catalogue is not empty and is bridged in full', () => {
    expect(catalogue.length).toBeGreaterThanOrEqual(20)
    expect(builtinThemes.length).toBe(catalogue.length)
  })

  test('every catalogue entry survives the translation', () => {
    // A role that fails to map resolves to `undefined` and then to an empty custom
    // property, which renders as one component keeping the previous theme's colour.
    for (const theme of builtinThemes) {
      const variables = themeCssVariables(theme)

      expect(Object.keys(variables).length, `${theme.id} sets too few roles`).toBeGreaterThan(60)
      for (const [name, value] of Object.entries(variables)) {
        expect(value, `${theme.id} leaves ${name} empty`).toBeTruthy()
      }
    }
  })

  test('every theme clears the catalogue floors', () => {
    const findings = validateThemeRegistry()

    expect(
      findings.map((finding) => `${finding.themeId}: ${finding.message}`),
      'A theme in the registry fails a floor the catalogue guarantees. Fix the mapping — the ' +
        'floors themselves live in @adea-ai/themes and are not restated here.'
    ).toEqual([])
  })

  test('every theme records its provenance and licence', () => {
    const missing = builtinThemes
      .filter(
        (theme) => !theme.provenance.source || !theme.provenance.url || !theme.provenance.license
      )
      .map((theme) => theme.id)

    expect(missing).toEqual([])
  })

  test('ids are unique and families group correctly', () => {
    const ids = builtinThemes.map((theme) => theme.id)
    expect(ids.toSorted()).toEqual([...new Set(ids)].toSorted())

    const families = themeFamilies()
    const grouped = families.reduce((total, family) => total + family.themes.length, 0)
    expect(grouped).toBe(builtinThemes.length)
    // The families a picker presents, which is the list a user actually sees.
    expect(families.map((family) => family.label)).toEqual([
      'Adea',
      'Ayu',
      'Catppuccin',
      'Dracula',
      'Everforest',
      'Gruvbox',
      'Kanagawa',
      'Monokai',
      'Nord',
      'One Dark',
      'Rosé Pine',
      'Solarized',
      'Tokyo Night',
      'Vesper',
    ])
  })

  test('the catalogue covers both appearances', () => {
    const light = themesForAppearance('light')
    const dark = themesForAppearance('dark')

    // A catalogue that is all dark leaves a light-theme user with one option.
    expect(light.length).toBeGreaterThanOrEqual(5)
    expect(dark.length).toBeGreaterThanOrEqual(5)
    expect(light.length + dark.length).toBe(builtinThemes.length)
  })

  test('a lookup answers rather than throwing for an id the catalogue does not have', () => {
    // The caller is restoring a stored preference, and a preference naming a theme
    // that has since been removed is the expected case, not an exceptional one.
    expect(themeById('not-a-theme')).toBeUndefined()
    expect(themeById('adea-dark')?.appearance).toBe('dark')
  })

  test('the default dark theme is not a near-black canvas', () => {
    const adeaDark = themeById('adea-dark')

    expect(adeaDark).toBeDefined()
    // The owner's rule, as an assertion: a dark theme whose canvas is almost black
    // is the most common way a dark interface is made unpleasant.
    const canvas = contrastRatio(parseColor(adeaDark!.colors.background)!, parseColor('#000000')!)
    expect(canvas, 'the default dark canvas is within 2:1 of pure black').toBeLessThan(2)
  })
})
