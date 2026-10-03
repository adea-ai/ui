import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACCENTS,
  CONTRAST_FLOORS,
  contrastRatio as ratioOf,
  getAccent,
  getTheme,
  parseColor,
  themeAccentPresets,
  themesByAppearance,
} from '@adea-ai/themes'
import {
  accentVariables,
  appearancePreviewThemes,
  isThemeAccentId,
  resolveAccentPreset,
  themeAccentsFor,
  themeById,
  withAccent,
} from '#lib/themes'
import { densityTokens, fontOptions } from '../src/lib/tokens'
import { APPEARANCE_FONT_CSS, THEME_CSS, valueOf } from './helpers/theme-css'

const BASE_CSS = readFileSync(join(import.meta.dir, '../src/styles/base.css'), 'utf8')

/**
 * Appearance selections have to reach their CSS projections. Accent, typography and
 * density are stored choices, so the shared provider and tokens must agree on the
 * attributes and variables that represent them.
 */
/**
 * A declaration inside a named block, as `theme.css` writes it.
 *
 * Comments are stripped first because most of these declarations carry a trailing
 * `/* 20px *\/` note, and an end-of-line anchor after the semicolon would then never
 * match — a reader that silently returns `undefined` for a well-formed declaration
 * is worse than no reader, because it looks like the token is missing.
 */
function declaredIn(selector: string, name: string): string | undefined {
  const start = THEME_CSS.indexOf(selector)
  if (start === -1) return undefined
  const block = THEME_CSS.slice(start, THEME_CSS.indexOf('\n}', start)).replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  )
  // Callers hold the token name both ways round — `accentVariables` returns
  // `--font-sans`, the token lists read `font-sans` — so it is normalised here
  // rather than at every call site.
  const bare = name.replace(/^--/, '')
  return new RegExp(`^\\s*--${bare}:\\s*([^;]+);`, 'm').exec(block)?.[1]?.trim()
}

describe('the accent axis reaches the screen', () => {
  /**
   * The stylesheet and the provider must produce the same values.
   *
   * This is the assertion whose absence let the axis die. Both sides call
   * `accentRoles` out of `@adea-ai/themes`, so they cannot disagree about the
   * colour — but they could still disagree about *whether they apply*, which is
   * exactly what happened, and no amount of re-deriving the palette would have
   * caught it. Reading the generated block and the runtime function side by side is
   * the only way to see a selection that is computed correctly and then discarded.
   */
  for (const preset of ACCENTS) {
    for (const appearance of ['light', 'dark'] as const) {
      test(`${preset.id} in ${appearance} applies the same values the stylesheet declares`, () => {
        const runtime = accentVariables(preset.id, appearance)
        expect(runtime, `${preset.id} produced no variables`).toBeDefined()

        const selector =
          appearance === 'light'
            ? `[data-accent='${preset.id}'] {`
            : `.dark[data-accent='${preset.id}'] {`
        expect(THEME_CSS, `${selector} is missing from theme.css`).toContain(selector)

        for (const [name, value] of Object.entries(runtime!)) {
          const declared = declaredIn(selector, name)
          expect(
            declared,
            `${selector} declares no ${name}, but the provider writes it — one of the two is a lie`
          ).toBeDefined()
          expect(
            declared,
            `${name} differs between the stylesheet (${declared}) and the provider (${value}) for ` +
              `${preset.id}/${appearance}. Both call accentRoles, so a difference here means one of ` +
              'them is not using it.'
          ).toBe(value)
        }
      })
    }
  }

  /**
   * An accent that resolved to the theme's own primary would pass every test above.
   *
   * Each preset is a distinct colour, so the failure this guards is a silent
   * no-op: the attribute set, the variables written, and the screen unchanged.
   */
  test('every accent is a different colour from the theme primary it replaces', () => {
    for (const appearance of ['light', 'dark'] as const) {
      const theme = themeById(appearance === 'dark' ? 'adea-dark' : 'adea-light')!
      const own = accentVariables('theme', appearance)
      expect(
        own,
        "`theme` must not override anything — it means 'leave the variant alone'"
      ).toBeUndefined()

      const primaries = new Set<string>()
      for (const preset of ACCENTS) {
        const primary = accentVariables(preset.id, appearance)!['--primary']
        expect(primary, `${preset.id} has no primary`).toBeDefined()
        primaries.add(primary!)
        expect(
          primary,
          `${preset.id} resolves to the same value as the theme's own primary, so selecting it ` +
            'changes nothing on screen'
        ).not.toBe(theme.colors.primary)
      }
      expect(
        primaries.size,
        `accents are not distinct in ${appearance}: ${[...primaries].join(', ')}`
      ).toBe(ACCENTS.length)
    }
  })

  test('an unknown accent falls back rather than blanking the primary', () => {
    // A stored preference outlives the catalogue. A preset that has been renamed
    // must leave the theme readable rather than leave `--primary` unset.
    expect(accentVariables('no-such-accent', 'dark')).toBeUndefined()
    expect(accentVariables('', 'light')).toBeUndefined()
  })

  test('the accent roles the provider writes are the ones the catalogue defines', () => {
    // `getAccent` is what `accentVariables` resolves through, so an id the picker
    // offers must always be one the runtime accepts.
    for (const preset of ACCENTS) {
      expect(getAccent(preset.id), `${preset.id} is offered but not resolvable`).toBeDefined()
    }
  })
})

/**
 * The accents a theme carries.
 *
 * Since `@adea-ai/themes` 0.9 a light/dark pair offers its own accent-shaped ANSI
 * colours beside the six presets. They have no `[data-accent]` block — the value
 * depends on the pair — so the only path to the screen is `accentVariables`, and
 * these tests are what keep it honest: the value is the pair's, the label is
 * measured, and a slot the pair cannot offer falls back instead of blanking.
 */
/** Contrast between two CSS colour strings, as the catalogue measures it. */
const contrastRatio = (a: string, b: string) => ratioOf(parseColor(a)!, parseColor(b)!)

describe('theme-carried accents reach the screen', () => {
  const pair = { lightThemeId: 'catppuccin-latte', darkThemeId: 'catppuccin-mocha' }
  const latte = getTheme(pair.lightThemeId)!
  const mocha = getTheme(pair.darkThemeId)!

  test("the offered accents are the catalogue's, for the selected pair", () => {
    const offered = themeAccentsFor(pair.lightThemeId, pair.darkThemeId)
    expect(offered.length).toBeGreaterThan(0)
    expect(offered).toEqual(themeAccentPresets(latte, mocha))
    for (const accent of offered) expect(isThemeAccentId(accent.id)).toBe(true)
  })

  test("a theme accent resolves to the pair's value in each appearance", () => {
    for (const accent of themeAccentsFor(pair.lightThemeId, pair.darkThemeId)) {
      expect(accentVariables(accent.id, 'light', pair)?.['--primary']).toBe(accent.light)
      expect(accentVariables(accent.id, 'dark', pair)?.['--primary']).toBe(accent.dark)
    }
  })

  test('the same id follows the theme: a different pair gives its own blue', () => {
    const other = { lightThemeId: 'gruvbox-light', darkThemeId: 'gruvbox-dark' }
    const here = accentVariables('ansi-blue', 'dark', pair)?.['--primary']
    const there = accentVariables('ansi-blue', 'dark', other)?.['--primary']
    expect(here).toBeDefined()
    expect(there).toBeDefined()
    expect(there).not.toBe(here)
  })

  test('a slot the pair does not offer, or a non-slot id, falls back to the theme', () => {
    // Red is never an accent slot, so no pair offers it; it is still a stored-id
    // shape the provider keeps, and it must resolve to nothing rather than a colour.
    expect(isThemeAccentId('ansi-red')).toBe(true)
    expect(accentVariables('ansi-red', 'dark', pair)).toBeUndefined()
    expect(isThemeAccentId('ansi-')).toBe(false)
    expect(isThemeAccentId('blue')).toBe(false)
    expect(resolveAccentPreset('ansi-chartreuse', latte, mocha)).toBeUndefined()
  })

  test('a preset still resolves through the pair-aware path', () => {
    expect(resolveAccentPreset('violet', latte, mocha)).toEqual(getAccent('violet'))
    expect(accentVariables('violet', 'dark', pair)).toEqual(accentVariables('violet', 'dark'))
  })

  /**
   * Contrast, measured rather than inherited. The catalogue enforces its floors
   * when it offers a slot; this pins that the label and canvas pairings the
   * provider actually writes clear them, across every theme of each appearance
   * paired with the other appearance's default.
   */
  test('every offered theme accent carries a legible label and clears the raised floor', () => {
    const pairs = [
      ...themesByAppearance('light').map((theme) => [theme.id, 'adea-dark'] as const),
      ...themesByAppearance('dark').map((theme) => ['adea-light', theme.id] as const),
    ]
    let measured = 0
    for (const [lightThemeId, darkThemeId] of pairs) {
      for (const accent of themeAccentsFor(lightThemeId, darkThemeId)) {
        for (const appearance of ['light', 'dark'] as const) {
          const roles = accentVariables(accent.id, appearance, { lightThemeId, darkThemeId })!
          const canvas = getTheme(appearance === 'light' ? lightThemeId : darkThemeId)!.colors
            .background
          const where = `${accent.id} on ${lightThemeId}/${darkThemeId} (${appearance})`
          expect(
            contrastRatio(roles['--primary-foreground']!, roles['--primary']!),
            `${where}: label`
          ).toBeGreaterThanOrEqual(CONTRAST_FLOORS.accentForeground)
          expect(
            contrastRatio(roles['--primary']!, canvas),
            `${where}: canvas`
          ).toBeGreaterThanOrEqual(CONTRAST_FLOORS.accentRaised)
          measured += 1
        }
      }
    }
    expect(measured).toBeGreaterThan(0)
  })
})

describe('the appearance editor adapter', () => {
  test('preview themes are canonical records, with the accent laid over both', () => {
    const selection = { lightThemeId: 'adea-light', darkThemeId: 'adea-dark', accent: 'violet' }
    const { lightTheme, darkTheme } = appearancePreviewThemes(selection)
    const violet = getAccent('violet')!
    expect(lightTheme.id).toBe('adea-light')
    expect(darkTheme.id).toBe('adea-dark')
    // The roles the editor's miniatures read and the shadcn projection does not carry.
    expect(darkTheme.colors.surfaceActive).toBe(getTheme('adea-dark')!.colors.surfaceActive)
    expect(darkTheme.colors.textSubtle).toBe(getTheme('adea-dark')!.colors.textSubtle)
    expect(lightTheme.colors.accent).toBe(violet.light)
    expect(darkTheme.colors.accent).toBe(violet.dark)
    expect(
      contrastRatio(darkTheme.colors.accentForeground, darkTheme.colors.accent)
    ).toBeGreaterThanOrEqual(CONTRAST_FLOORS.accentForeground)
  })

  test('a theme accent and the theme default resolve as the provider resolves them', () => {
    const base = { lightThemeId: 'gruvbox-light', darkThemeId: 'gruvbox-dark' }
    const offered = themeAccentsFor(base.lightThemeId, base.darkThemeId)[0]!
    const tinted = appearancePreviewThemes({ ...base, accent: offered.id })
    expect(tinted.darkTheme.colors.accent).toBe(offered.dark)
    expect(tinted.lightTheme.colors.accent).toBe(offered.light)
    const plain = appearancePreviewThemes({ ...base, accent: 'theme' })
    expect(plain.darkTheme).toBe(getTheme('gruvbox-dark')!)
    expect(appearancePreviewThemes({ ...base, accent: 'ansi-red' }).darkTheme).toBe(
      getTheme('gruvbox-dark')!
    )
  })

  test('unknown theme ids fall back to the defaults rather than to nothing', () => {
    const { lightTheme, darkTheme } = appearancePreviewThemes({
      lightThemeId: 'gone',
      darkThemeId: 'also-gone',
      accent: 'theme',
    })
    expect(lightTheme.id).toBe('adea-light')
    expect(darkTheme.id).toBe('adea-dark')
  })

  test('withAccent without an accent is the identity', () => {
    const theme = getTheme('nord') ?? getTheme('adea-dark')!
    expect(withAccent(theme, undefined)).toBe(theme)
  })
})

describe('the font axes reach the screen', () => {
  test('System family and UI-scaled role defaults are activated by the marker', () => {
    expect(APPEARANCE_FONT_CSS).toContain(':root[data-font-settings]')
    expect(APPEARANCE_FONT_CSS).toContain('--font-ui: var(--font-family-system)')
    expect(APPEARANCE_FONT_CSS).toContain('--font-content: var(--font-family-system)')
    expect(APPEARANCE_FONT_CSS).toContain('--font-code: var(--font-family-system-mono)')
  })

  test('every catalog family resolves to a published family variable for all text roles', () => {
    for (const option of fontOptions) {
      for (const variable of Object.values(option.familyVariables)) {
        expect(variable).toMatch(/^--font-family-/)
        expect(THEME_CSS).toContain(variable + ':')
      }
    }
  })

  test('legacy data-font remains a UI-only compatibility alias', () => {
    expect(THEME_CSS).toContain("[data-font='system']")
    expect(THEME_CSS).toContain("[data-font='geist']")
    expect(THEME_CSS).not.toMatch(/\[data-font=[^\]]+\][^{]*\{[^}]*--font-content:/)
    expect(APPEARANCE_FONT_CSS).toContain('--font-sans: var(--font-ui)')
  })

  test('content and code expose their own selected size tokens', () => {
    expect(APPEARANCE_FONT_CSS).toContain('--font-ui-scale: 1')
    expect(APPEARANCE_FONT_CSS).toContain('--font-content-scale: 1')
    expect(APPEARANCE_FONT_CSS).toContain('--font-code-scale: 1')
    expect(APPEARANCE_FONT_CSS).toContain(
      '--text-content: calc(0.875rem * var(--font-content-scale))'
    )
    expect(APPEARANCE_FONT_CSS).toContain('--text-code: calc(0.75rem * var(--font-code-scale))')
    expect(APPEARANCE_FONT_CSS).toContain('--font-mono: var(--font-code)')
  })

  test('the body and semantic code elements retain rem-relative enlargement', () => {
    expect(BASE_CSS).toContain('font-size: var(--text-sm);')
    expect(APPEARANCE_FONT_CSS).toContain('font-size: var(--text-code);')
  })
})

/** A `rem` length in px, for the direction comparison. */
function px(value: string): number {
  const match = /^(-?[\d.]+)rem$/.exec(value)
  if (!match) throw new Error(`expected a rem length, got "${value}"`)
  return Number(match[1]) * 16
}

describe('the density axis is real', () => {
  const CONTROL_TOKENS = [
    'control-height-2xs',
    'control-height-xs',
    'control-height-sm',
    'control-height-md',
    'control-height-lg',
    'control-height-xl',
    'control-padding-2xs',
    'control-padding-xs',
    'control-padding-sm',
    'control-padding-md',
    'control-padding-lg',
    'control-padding-xl',
    'row-height-sm',
    'row-height-md',
    'row-height-lg',
  ] as const

  const selector = "[data-density='compact']"

  test('compact exists, and overrides every rung the comfortable ladder declares', () => {
    expect(
      THEME_CSS,
      `${selector} is missing — density is documented but not implemented`
    ).toContain(selector)
    for (const token of CONTROL_TOKENS) {
      expect(
        declaredIn(selector, token),
        `${selector} does not override --${token}, so that control keeps its comfortable height`
      ).toBeDefined()
    }
  })

  /**
   * Every rung tightens, by the same step, and none of them inverts.
   *
   * A density that made one control taller would be a bug wearing a feature's
   * clothes, so this asserts the direction of every rung rather than a sample.
   */
  test('every rung is strictly tighter than comfortable, and the ladder keeps its order', () => {
    for (const token of CONTROL_TOKENS) {
      const comfortable = valueOf(token, 'root')
      expect(comfortable, `--${token} is not declared in :root`).toBeDefined()
      const compact = declaredIn(selector, token)
      expect(compact, `--${token} is not in ${selector}`).toBeDefined()
      expect(
        px(compact!),
        `--${token} is ${compact} at compact and ${comfortable} at comfortable — compact must be smaller`
      ).toBeLessThan(px(comfortable!))
    }
  })

  test('comfortable is the absence of the attribute, so opting out is a no-op', () => {
    // `comfortable` must not need a block: a document that ships no `data-density`
    // renders as comfortable, which is what keeps this change additive rather than
    // a migration for every existing consumer.
    expect(THEME_CSS).not.toContain("[data-density='comfortable']")
    expect(valueOf('control-height-sm', 'root'), 'the default rung is missing').toBeDefined()
  })

  test('the 2xl touch target stays 48px under compact density', () => {
    for (const token of ['control-height-2xl', 'control-padding-2xl']) {
      expect(valueOf(token, 'root'), `--${token} is not declared in :root`).toBeDefined()
      expect(
        declaredIn(selector, token),
        `--${token} must stay unchanged under compact density`
      ).toBeUndefined()
    }
    expect(px(valueOf('control-height-2xl', 'root')!)).toBe(48)
    expect(densityTokens.map((token) => token.name)).toContain('control-height-2xl')
    expect(densityTokens.map((token) => token.name)).toContain('control-padding-2xl')
  })
})
