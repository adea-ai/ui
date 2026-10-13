import { describe, expect, test } from 'bun:test'
import {
  ACCENT_SUBTLE_ALPHA,
  ACCENTS,
  editorRolesHex,
  getTheme,
  parseColor,
  primarySubtleAlpha,
  primarySubtleCss,
  shadcnDestructiveProjection,
  themes as catalogue,
} from '@adea-ai/themes'
import { shadcnVariables } from '@adea-ai/themes/adapters/shadcn'
import {
  accentVariables,
  builtinThemes,
  contrastRatio,
  editorPaletteFor,
  floorEditorPalette,
  isCatalogueVariant,
  themeById,
  themeCssVariables,
  themeFamilies,
  themesForAppearance,
  validateThemeRegistry,
  variantFromRecord,
} from '../src/lib/themes'
import { THEME_CSS, valueOf } from './helpers/theme-css'

const cssName = (role: string): string =>
  `--${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`

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

  test('the UI forwards package-owned shadcn role projections', () => {
    const byId = new Map(catalogue.map((theme) => [theme.id, theme]))
    const uiOwnedDestructiveRoles = new Set([
      'destructive',
      'destructiveForeground',
      'destructiveAction',
      'destructiveActionForeground',
    ])

    for (const theme of builtinThemes) {
      const source = byId.get(theme.id)
      expect(source, `${theme.id} has no catalogue source`).toBeDefined()
      if (!source) continue

      const projected = shadcnVariables(source)
      const applied = themeCssVariables(theme)
      for (const [role, value] of Object.entries(theme.colors)) {
        if (uiOwnedDestructiveRoles.has(role)) continue
        const name = cssName(role)
        expect(projected[name], `${theme.id} is missing package projection ${name}`).toBe(value)
        expect(applied[name], `${theme.id} changed package projection ${name}`).toBe(value)
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

const editorEntries = (tokens: Record<string, string>) =>
  Object.entries(tokens).filter(([name]) => name.startsWith('--editor-'))

const unreachable = (): never => {
  throw new Error('cannot encode editor.number above 4.5:1 contrast')
}

describe('editor roles: syntax and floor', () => {
  const EDITOR_KEYS = [
    'keyword',
    'string',
    'number',
    'comment',
    'function',
    'variable',
    'type',
    'tag',
    'attribute',
    'operator',
    'heading',
    'link',
    'diffAdd',
    'diffDelete',
    'diffHunk',
    'searchMatch',
  ] as const

  test('absent options, an empty object and `syntax` are the output that has always been written', () => {
    for (const theme of builtinThemes) {
      const baseline = themeCssVariables(theme)
      expect(themeCssVariables(theme, {}), theme.id).toEqual(baseline)
      expect(themeCssVariables(theme, { editor: 'syntax' }), theme.id).toEqual(baseline)
      expect(themeCssVariables(theme, { editor: undefined }), theme.id).toEqual(baseline)
      expect(baseline['--editor-keyword'], theme.id).toBe(theme.editor.keyword)
    }
  })

  test('floor is editorRolesHex, for all 34 catalogue themes', () => {
    expect(builtinThemes).toHaveLength(34)
    for (const theme of builtinThemes) {
      const expected = editorRolesHex(getTheme(theme.id)!)
      const palette = editorPaletteFor(theme, 'floor')
      expect(Object.keys(palette).toSorted(), theme.id).toEqual([...EDITOR_KEYS].toSorted())
      for (const key of EDITOR_KEYS) expect(palette[key], `${theme.id}.${key}`).toBe(expected[key])
    }
  })

  test('floor changes only the editor ramp, and every role clears 4.5:1 on the canvas', () => {
    for (const theme of builtinThemes) {
      const plain = themeCssVariables(theme)
      const held = themeCssVariables(theme, { editor: 'floor' })
      expect(Object.keys(held), theme.id).toEqual(Object.keys(plain))
      for (const [name, value] of Object.entries(plain)) {
        if (!name.startsWith('--editor-')) expect(held[name], `${theme.id} ${name}`).toBe(value)
      }
      for (const [name, value] of editorEntries(held)) {
        expect(
          contrastRatio(parseColor(value)!, parseColor(theme.colors.background)!),
          `${theme.id} ${name}`
        ).toBeGreaterThanOrEqual(4.5 - 1e-9)
      }
    }
  })

  test('the two projections differ somewhere, or the option would prove nothing', () => {
    const differing = builtinThemes.filter((theme) =>
      editorEntries(themeCssVariables(theme)).some(
        ([name, value]) => themeCssVariables(theme, { editor: 'floor' })[name] !== value
      )
    )
    expect(differing.length).toBeGreaterThan(0)
  })

  test('floor is memoised per theme', () => {
    const theme = themeById('nord')!
    expect(editorPaletteFor(theme, 'floor')).toBe(editorPaletteFor(theme, 'floor'))
  })

  test('a variant the catalogue does not hold keeps its own editor roles under floor', () => {
    const copy = {
      ...variantFromRecord(getTheme('nord')!),
      editor: { ...themeById('nord')!.editor, keyword: 'red' },
    }
    expect(editorPaletteFor(copy, 'floor')).toBe(copy.editor)
    expect(themeCssVariables(copy, { editor: 'floor' })['--editor-keyword']).toBe('red')
  })

  test('a palette that cannot reach the floor falls back instead of failing', () => {
    const fallback = themeById('nord')!.editor
    expect(floorEditorPalette(getTheme('nord')!, fallback, unreachable)).toBe(fallback)
  })

  test('isCatalogueVariant is identity, not id', () => {
    expect(isCatalogueVariant(themeById('nord')!)).toBe(true)
    expect(isCatalogueVariant({ ...themeById('nord')! })).toBe(false)
    expect(isCatalogueVariant(variantFromRecord(getTheme('nord')!))).toBe(false)
  })
})
