import { describe, expect, test } from 'bun:test'
import {
  ACCENT_SUBTLE_ALPHA,
  ACCENTS,
  getTheme,
  parseColor,
  primarySubtleAlpha,
  primarySubtleCss,
  shadcnDestructiveProjection,
  themes as catalogue,
} from '@adea-ai/themes'
import {
  accentVariables,
  builtinThemes,
  contrastRatio,
  themeById,
  themeCssVariables,
  themeFamilies,
  themesForAppearance,
  validateThemeRegistry,
} from '../src/lib/themes'
import { THEME_CSS, valueOf } from './helpers/theme-css'

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

  test('solid destructive actions use the shared projection and preserve semantic error', () => {
    const byId = new Map(catalogue.map((theme) => [theme.id, theme]))

    for (const theme of builtinThemes) {
      const source = byId.get(theme.id)
      expect(source, `${theme.id} has no canonical source record`).toBeDefined()
      const projection = shadcnDestructiveProjection(source!)
      const variables = themeCssVariables(theme)

      expect(theme.colors.destructive, `${theme.id} replaced its canonical error role`).toBe(
        source!.colors.error
      )
      expect(variables['--destructive']).toBe(source!.colors.error)
      expect(variables['--destructive-subtle']).toBe(theme.colors.destructiveSubtle)
      expect(variables['--destructive-action']).toBe(projection.fill)
      expect(variables['--destructive-action-foreground']).toBe(projection.foreground)
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
      'Aardvark',
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

/**
 * The selected-state tint, at each theme's own strength.
 *
 * `--primary-subtle` is `bg-primary-subtle text-foreground` across the library — the
 * active nav row, the pressed toggle, the highlighted command row — so body text on
 * it has to clear 4.5:1. The catalogue measures that per theme (`primarySubtleAlpha`)
 * over every surface and for every accent the theme offers; the bridge's job is only
 * to carry the measured value through, and not to let an accent replace it with the
 * appearance-wide ceiling. Both failures look identical on the default themes, which
 * sit at the ceiling, so these tests read every theme rather than the two defaults.
 */
describe('the primary tint', () => {
  test("every theme writes the catalogue's measured tint, not the appearance ceiling", () => {
    for (const theme of builtinThemes) {
      const record = getTheme(theme.id)!
      expect(
        themeCssVariables(theme)['--primary-subtle'],
        `${theme.id} writes a --primary-subtle the catalogue did not measure for it`
      ).toBe(primarySubtleCss(record))
    }
  })

  test('the per-theme strength is exercised: some themes carry less than the ceiling', () => {
    // Without this the test above would also pass against `primarySubtleCss(appearance)`
    // on a catalogue where every theme sat at the ceiling, and prove nothing.
    const lighter = builtinThemes.filter(
      (theme) => primarySubtleAlpha(getTheme(theme.id)!) < ACCENT_SUBTLE_ALPHA[theme.appearance]
    )
    expect(lighter.length, 'no theme carries a lighter wash than its ceiling').toBeGreaterThan(0)
    for (const theme of lighter) {
      expect(themeCssVariables(theme)['--primary-subtle']).not.toBe(
        primarySubtleCss(theme.appearance)
      )
    }
  })

  test("theme.css's defaults carry the default themes' measured tint", () => {
    for (const [scope, id] of [
      ['root', 'adea-light'],
      ['dark', 'adea-dark'],
    ] as const) {
      expect(valueOf('primary-subtle', scope), `${id} in the ${scope} block`).toBe(
        primarySubtleCss(getTheme(id)!)
      )
    }
  })

  test('no accent block or accent selection reintroduces a fixed tint', () => {
    // The tint is a share of `var(--primary)`, so the theme's own declaration already
    // follows an accent; an accent that declared one could only carry an
    // appearance-wide share, which is exactly what the per-theme measurement replaced.
    const accentRegion = THEME_CSS.slice(
      THEME_CSS.indexOf('/* @generated accents'),
      THEME_CSS.indexOf('/* @end generated accents */')
    )
    expect(accentRegion).toContain("[data-accent='")
    expect(accentRegion, 'an accent block declares --primary-subtle').not.toContain(
      '--primary-subtle'
    )
    expect(
      THEME_CSS.replace(/\/\*[\s\S]*?\*\//g, '').match(/--primary-subtle:/g)?.length,
      'theme.css declares --primary-subtle outside the two default blocks'
    ).toBe(2)

    for (const appearance of ['light', 'dark'] as const) {
      for (const preset of ACCENTS) {
        const roles = accentVariables(preset.id, appearance)
        expect(roles, `${preset.id} produced no variables`).toBeDefined()
        expect(
          roles!['--primary-subtle'],
          `${preset.id}/${appearance} overrides the theme's measured tint`
        ).toBeUndefined()
      }
    }
  })

  test("a theme's tint holds for the accents a user can select on it", () => {
    // The measured strength covers every accent the theme offers, presets included,
    // so the tint expression does not need to change when the accent does.
    for (const theme of builtinThemes) {
      const record = getTheme(theme.id)!
      const presets = ACCENTS.map((preset) =>
        theme.appearance === 'dark' ? preset.dark : preset.light
      )
      expect(
        primarySubtleAlpha(record, presets),
        `${theme.id}: an accent preset needs a lighter tint than the theme writes`
      ).toBe(primarySubtleAlpha(record))
    }
  })
})
