import { describe, expect, test } from 'bun:test'
import {
  builtinThemes,
  contrastRatio,
  themeCssVariables,
  themeFamilies,
  validateThemeRegistry,
} from '../src/lib/themes'

/**
 * The theme catalogue's gate.
 *
 * This is what lets the registry hold other people's palettes without anyone
 * hand-checking every colour: an imported theme either clears the contrast floors
 * or the build fails with the pairing and the number. That is the difference
 * between a catalogue and a pile of colour schemes.
 */
describe('theme registry', () => {
  test('every theme clears the contrast floors', () => {
    const findings = validateThemeRegistry()

    expect(
      findings.map((finding) => `${finding.themeId}: ${finding.message}`),
      'A theme in the catalogue has a pairing below its floor. Fix the value or drop the theme — ' +
        'the floors are the reason the catalogue can accept external palettes at all.'
    ).toEqual([])
  })

  test('every theme records its provenance and licence', () => {
    const missing = builtinThemes
      .filter((theme) => !theme.provenance.url || !theme.provenance.license)
      .map((theme) => theme.id)

    expect(missing).toEqual([])
  })

  test('every theme ships the whole role set', () => {
    for (const theme of builtinThemes) {
      const variables = themeCssVariables(theme)

      // A theme that misses a role leaves that role on the previous theme's value,
      // which shows up as one component keeping the old palette.
      expect(Object.keys(variables).length, `${theme.id} sets too few roles`).toBeGreaterThan(50)
      for (const [name, value] of Object.entries(variables)) {
        expect(value, `${theme.id} leaves ${name} empty`).toBeTruthy()
      }
    }
  })

  test('ids are unique and families group correctly', () => {
    const ids = builtinThemes.map((theme) => theme.id)
    expect(ids.toSorted()).toEqual([...new Set(ids)].toSorted())

    const families = themeFamilies()
    const grouped = families.reduce((total, family) => total + family.themes.length, 0)
    expect(grouped).toBe(builtinThemes.length)
  })

  test('the catalogue covers both appearances', () => {
    const light = builtinThemes.filter((theme) => theme.appearance === 'light').length
    const dark = builtinThemes.filter((theme) => theme.appearance === 'dark').length

    // A catalogue that is all dark leaves a light-theme user with one option.
    expect(light).toBeGreaterThanOrEqual(5)
    expect(dark).toBeGreaterThanOrEqual(5)
  })

  test('the default dark theme is not a near-black canvas', () => {
    const adeaDark = builtinThemes.find((theme) => theme.id === 'adea-dark')

    expect(adeaDark).toBeDefined()
    // The owner's rule, as an assertion: a dark theme whose canvas is almost black
    // is the most common way a dark interface is made unpleasant.
    const canvas = contrastRatio(adeaDark!.colors.background, '#000000')
    expect(canvas).toBeDefined()
    expect(canvas!, 'the default dark canvas is within 2:1 of pure black').toBeLessThan(2)
  })
})
