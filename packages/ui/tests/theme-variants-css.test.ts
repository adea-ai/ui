import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ACCENTS, accentRoles } from '@adea-ai/themes'
import {
  accentReassertion,
  declaredProperties,
  themeVariantsCss,
  THEME_VARIANTS_HEADER,
} from '../scripts/theme-variants-css'
import { builtinThemes, defaultDarkThemeId, defaultLightThemeId } from '../src/lib/themes'
import { themeCssVariables } from '../src/lib/themes'
import { THEME_CSS } from './helpers/theme-css'

/**
 * `theme-variants.css`: the pre-paint sheet for the whole catalogue.
 *
 * Three claims, each with a test that can fail for the reason it names:
 *
 *   1. The committed sheet is what the generator makes from the committed
 *      `theme.css` (the drift check `theme:check` runs, as a unit test).
 *   2. It carries the palette `themeCssVariables` writes inline, theme for theme, so
 *      `palette: 'stylesheet'` and `palette: 'inline'` paint the same page.
 *   3. It does not lose a cascade it must win and win one it must lose: loaded after
 *      `theme.css`, a theme beats the defaults and an accent beats the theme.
 *
 * The cascade is resolved by a small stand-in for the browser, below, because the
 * claim is about which declaration wins and a string comparison cannot say that.
 */

const SHEET = readFileSync(join(import.meta.dir, '../src/styles/theme-variants.css'), 'utf8')

type Rule = { selector: string; order: number; declarations: Map<string, string> }

/** The flat rules of a stylesheet, in source order. Nested at-rules are not entered. */
function rulesOf(css: string, firstOrder: number): Rule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  let order = firstOrder
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = new Map<string, string>()
    for (const declaration of (match[2] as string).split(';')) {
      const colon = declaration.indexOf(':')
      if (colon === -1) continue
      declarations.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim())
    }
    for (const selector of (match[1] as string).split(',')) {
      rules.push({ selector: selector.trim(), order: order++, declarations })
    }
  }
  return rules
}

type Element = { dark: boolean; theme: string; accent?: string }

/** The three selector parts these sheets use, and how many each is worth. */
function matches(selector: string, element: Element): number | undefined {
  let specificity = 0
  let rest = selector
  while (rest.length > 0) {
    const part =
      /^:root/.exec(rest) ??
      /^\.dark/.exec(rest) ??
      /^\[data-(theme|accent)='([\w-]+)'\]/.exec(rest)
    if (!part) return undefined
    const text = part[0]
    if (text === '.dark' && !element.dark) return undefined
    if (part[1] === 'theme' && element.theme !== part[2]) return undefined
    if (part[1] === 'accent' && element.accent !== part[2]) return undefined
    specificity += 1
    rest = rest.slice(text.length)
  }
  return specificity
}

/** The value `name` computes to on `element`: highest specificity, then latest. */
function cascade(rules: Rule[], element: Element, name: string): string | undefined {
  let winner: { specificity: number; order: number; value: string } | undefined
  for (const rule of rules) {
    const value = rule.declarations.get(name)
    const specificity = matches(rule.selector, element)
    if (value === undefined || specificity === undefined) continue
    if (
      !winner ||
      specificity > winner.specificity ||
      (specificity === winner.specificity && rule.order > winner.order)
    ) {
      winner = { specificity, order: rule.order, value }
    }
  }
  return winner?.value
}

const themeRules = rulesOf(THEME_CSS, 0)
const sheetRules = rulesOf(SHEET, themeRules.length)
const loaded = [...themeRules, ...sheetRules]
const isDefault = (id: string) => id === defaultLightThemeId || id === defaultDarkThemeId

describe('theme-variants.css is generated', () => {
  test('the committed sheet is what the generator makes from the committed theme.css', () => {
    expect(SHEET === themeVariantsCss(THEME_CSS), 'run `bun run theme:build`').toBe(true)
  })

  test('a stale theme.css makes a stale sheet: the sheet is a function of it', () => {
    // The accent copy and the default pair's "what theme.css lacks" both read it, so a
    // change there that the sheet did not follow is drift the check can see.
    const changed = THEME_CSS.replace(
      "[data-accent='blue'] {\n  --primary:",
      "[data-accent='blue'] {\n  --primary: red; --was:"
    )
    expect(changed).not.toBe(THEME_CSS)
    expect(themeVariantsCss(changed)).not.toBe(SHEET)

    const learned = `${THEME_CSS}\n:root { --terminal-background: red; }\n`
    expect(themeVariantsCss(learned)).not.toContain(
      `[data-theme='${defaultLightThemeId}'] {\n  --terminal-background`
    )
  })

  test('opens with the generated notice', () => {
    expect(SHEET.startsWith(THEME_VARIANTS_HEADER)).toBe(true)
    expect(THEME_VARIANTS_HEADER).toContain('@generated')
    expect(THEME_VARIANTS_HEADER).toContain('bun run theme:build')
  })
})

const blocks = (id: string) => sheetRules.filter((rule) => rule.selector === `[data-theme='${id}']`)

describe('what the sheet carries', () => {
  test('every non-default catalogue theme has exactly one rule: its inline palette, in full', () => {
    const others = builtinThemes.filter((theme) => !isDefault(theme.id))
    expect(others.length).toBe(builtinThemes.length - 2)
    for (const theme of others) {
      const found = blocks(theme.id)
      expect(found, `${theme.id} rules`).toHaveLength(1)
      expect(Object.fromEntries(found[0]!.declarations), theme.id).toEqual(themeCssVariables(theme))
    }
  })

  test('the default pair adds only what theme.css does not declare, and with theme.css covers the whole palette', () => {
    const declared = declaredProperties(THEME_CSS)
    for (const id of [defaultLightThemeId, defaultDarkThemeId]) {
      const theme = builtinThemes.find((candidate) => candidate.id === id)!
      const expected = themeCssVariables(theme)
      const found = blocks(id)
      expect(found, `${id} rules`).toHaveLength(1)
      const added = [...found[0]!.declarations.keys()]

      for (const name of added) {
        expect(declared.has(name), `${id} repeats ${name}, which theme.css declares`).toBe(false)
        expect(found[0]!.declarations.get(name)).toBe(expected[name])
      }
      for (const name of Object.keys(expected)) {
        expect(declared.has(name) || added.includes(name), `${id}: ${name} is nowhere`).toBe(true)
      }
      // The reason the pair has a rule at all.
      expect(added.some((name) => name.startsWith('--terminal-'))).toBe(true)
      expect(added.some((name) => name.startsWith('--editor-'))).toBe(true)
    }
  })

  test('every value is a token: nothing that could end its rule early', () => {
    for (const rule of sheetRules) {
      for (const [name, value] of rule.declarations) {
        expect(value, `${rule.selector} ${name}`).not.toMatch(/[;{}]/)
        expect(value.length).toBeGreaterThan(0)
      }
    }
  })

  test('each theme rule is a single attribute selector, so it can sit under an accent', () => {
    for (const rule of sheetRules.filter((candidate) =>
      candidate.selector.includes('data-theme')
    )) {
      expect(rule.selector).toMatch(/^\[data-theme='[\w-]+'\]$/)
    }
  })

  test("the accent copy at the end is theme.css's light accent blocks, verbatim", () => {
    const copy = accentReassertion(THEME_CSS)
    expect(SHEET.trimEnd().endsWith(copy)).toBe(true)
    expect(copy.match(/^\[data-accent=/gm)).toHaveLength(ACCENTS.length)
    expect(copy).not.toContain('.dark')
    // Everything in it is in theme.css already: it repeats, it does not decide.
    for (const block of copy.split('\n\n')) expect(THEME_CSS).toContain(block)
  })
})

describe('the cascade, theme.css then theme-variants.css', () => {
  test('without an accent, every theme paints the palette themeCssVariables describes', () => {
    const declared = declaredProperties(THEME_CSS)
    for (const theme of builtinThemes) {
      const element = { dark: theme.appearance === 'dark', theme: theme.id }
      for (const [name, value] of Object.entries(themeCssVariables(theme))) {
        // The default pair's colours are theme.css's own statement, which differs from
        // the inline one only in tokens it derives (`--chrome`, `--surface-sunken`).
        if (isDefault(theme.id) && declared.has(name)) continue
        expect(cascade(loaded, element, name), `${theme.id} ${name}`).toBe(value)
      }
    }
  })

  test('an accent beats the theme, in both appearances, for every theme and preset', () => {
    for (const theme of builtinThemes) {
      for (const preset of ACCENTS) {
        const roles = accentRoles(preset, theme.appearance)
        const element = {
          dark: theme.appearance === 'dark',
          theme: theme.id,
          accent: preset.id,
        }
        const painted = (name: string) => cascade(loaded, element, name)
        const label = `${theme.id} + ${preset.id}`
        expect(painted('--primary'), label).toBe(roles.primary)
        expect(painted('--primary-foreground'), label).toBe(roles.primaryForeground)
        expect(painted('--primary-hover'), label).toBe(roles.primaryHover)
        expect(painted('--ring'), label).toBe(roles.ring)
        // And only those four: the theme still owns the rest.
        expect(painted('--card'), label).toBe(
          isDefault(theme.id)
            ? cascade(themeRules, element, '--card')
            : themeCssVariables(theme)['--card']
        )
      }
    }
  })

  test('without the copy at the end, a light theme would paint over its accent', () => {
    // The reason the copy exists, stated as a failure: drop it and the later theme
    // rule wins the tie against the earlier accent rule.
    const withoutCopy = rulesOf(
      SHEET.slice(0, SHEET.indexOf('/* The light accents')),
      themeRules.length
    )
    const light = builtinThemes.find(
      (theme) => theme.appearance === 'light' && !isDefault(theme.id)
    )!
    const element = { dark: false, theme: light.id, accent: 'blue' }
    const bare = cascade([...themeRules, ...withoutCopy], element, '--primary')
    expect(bare).toBe(themeCssVariables(light)['--primary'])
    expect(bare).not.toBe(
      accentRoles(
        ACCENTS.find((p) => p.id === 'blue')!,
        'light'
      ).primary
    )
  })
})

describe('the generator refuses what it cannot generate from', () => {
  test('a theme.css with no accent region has nothing to copy', () => {
    expect(() => themeVariantsCss(':root { --background: red; }')).toThrow(/accent region/)
  })

  test('a region with no light blocks has nothing to copy', () => {
    expect(() =>
      accentReassertion(
        "/* @generated accents */\n.dark[data-accent='x'] {\n}\n/* @end generated accents */"
      )
    ).toThrow(/light accent blocks/)
  })

  test('declaredProperties ignores commented-out declarations', () => {
    expect([...declaredProperties('a { --x: 1; /* --y: 2; */ --z:3 }')]).toEqual(['--x', '--z'])
  })
})
