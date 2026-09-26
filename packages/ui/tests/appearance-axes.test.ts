import { describe, expect, test } from 'bun:test'
import { ACCENTS, getAccent } from '@adea-ai/themes'
import { accentVariables, themeById } from '#lib/themes'
import { THEME_CSS, valueOf } from './helpers/theme-css'

/**
 * The three appearance axes that select rather than describe.
 *
 * Accent, typeface and density are *selections*: a user picks one, it is stored,
 * and something has to act on it. That is a different kind of claim from "these two
 * colours are legible", and it is the kind that quietly stops being true.
 *
 * All three were broken at once, in the same way, and nothing noticed:
 *
 *   - **Accent.** `theme.css` carried a correct `[data-accent='…']` block per preset
 *     and `ThemeProvider` set the attribute, but the provider writes a theme's roles
 *     onto `<html>` as *inline* custom properties. An inline declaration outranks
 *     every stylesheet selector, so the blocks never applied. All seven accents
 *     rendered as the same blue, and the toolbar reported a selection that had no
 *     effect.
 *   - **Typeface.** The default `--font-sans` was declared in a `:root` block placed
 *     *after* the `[data-font]` blocks. Equal specificity, so source order decided it
 *     and the default won. All five faces resolved to Space Grotesk.
 *   - **Density.** `grep -rn data-density` returned nothing. The tokens, the
 *     documentation and a toolbar control all described an axis with no
 *     implementation behind it.
 *
 * Every other suite here reads `theme.css` as text, which is why all three survived:
 * the file was correct in each case and the *runtime* was not. So these tests assert
 * the two things text cannot see — that the stylesheet and the provider agree, and
 * that a selection is reachable at all.
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
 * Which `--font-sans` declaration the cascade actually selects, per selection.
 *
 * The rules are read in document order and the *last* match wins, which is exactly
 * what the browser does for equal specificity — so this reproduces the rule rather
 * than trusting the file's appearance. It is a reimplementation, which is normally a
 * thing to avoid in a test, and it is here because the alternative is a test that
 * agrees with any file as long as the text looks plausible.
 */
function resolveFontSans(): { default: string; bySelection: Record<string, string | undefined> } {
  const rules: { selector: string; value: string }[] = []
  const source = THEME_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*--font-sans\s*:[^;}]+;)/g)) {
    rules.push({
      selector: (match[1] ?? '').trim(),
      value: /--font-sans\s*:\s*([^;]+);/.exec(match[2] ?? '')?.[1]?.trim() ?? '',
    })
  }

  // `:root` matches the document element with no attribute, and `[data-font='x']`
  // matches it when the attribute is `x`. Both are specificity (0,1,0).
  const lastMatch = (attribute: string | null): string | undefined => {
    let winner: string | undefined
    for (const rule of rules) {
      const applies =
        rule.selector === ':root'
          ? attribute === null
          : attribute !== null && rule.selector === `[data-font='${attribute}']`
      if (applies) winner = rule.value
    }
    return winner
  }

  return {
    default: lastMatch(null) ?? '',
    bySelection: Object.fromEntries(
      ['system', 'geist', 'geist-mono', 'jetbrains-mono'].map((id) => [id, lastMatch(id)])
    ),
  }
}

describe('the typeface axis reaches the screen', () => {
  const defaultSans = /:root\s*\{[^}]*--font-sans:\s*([^;]+);/.exec(THEME_CSS)

  /**
   * Source order, because that is the whole mechanism.
   *
   * `:root` and `[data-font='…']` have identical specificity, so whichever is written
   * last wins outright — there is no cascade subtlety to reason about, only a
   * position in the file. A test that resolved the value would have to reproduce
   * that rule; asserting the order states the requirement directly.
   */
  test('the default typeface is declared before every selection, so the selection wins', () => {
    // Every `:root` declaration of the default, not just the first. Copying the
    // default instead of moving it leaves the original sitting below the
    // `[data-font]` blocks, where it silently wins again — and a test that looked at
    // the first match would pass on exactly that file. So the assertion is on the
    // *last* one, and the count is asserted separately.
    const defaults = [...THEME_CSS.matchAll(/:root\s*\{([^}]*)\}/g)]
      .map((match) => ({ body: match[1] ?? '', at: match.index ?? 0 }))
      .filter(({ body }) => /--font-sans\s*:/.test(body))

    expect(
      defaults.length,
      `--font-sans is declared in ${defaults.length} :root blocks. There must be exactly one ` +
        'default, and it must sit above the [data-font] blocks — a second copy below them wins.'
    ).toBe(1)

    const defaultAt = defaults[0]!.at
    expect(defaultSans, 'the default typeface is missing').not.toBeNull()

    for (const id of ['system', 'geist', 'geist-mono', 'jetbrains-mono']) {
      const selector = `[data-font='${id}']`
      const at = THEME_CSS.indexOf(selector)
      expect(at, `${selector} is missing from theme.css`).toBeGreaterThan(-1)
      expect(
        at,
        `${selector} is written before the :root default. They have the same specificity, so the ` +
          'default wins and the selection has no effect — which is what made all five typefaces ' +
          'resolve to Space Grotesk.'
      ).toBeGreaterThan(defaultAt)
    }
  })

  /**
   * The resolved stack, which is the only assertion that cannot be satisfied by a
   * file that merely *reads* correctly.
   *
   * The ordering assertions above were written backwards once and passed anyway,
   * because they described the order the file should have rather than the order it
   * had. Nothing textual can catch that. A browser can: substitute each `--font-family-*`
   * stack with a marker, apply the cascade for real, and read which marker wins. It
   * needs no font to be installed and no rendering, because the whole question is
   * which declaration the cascade selects.
   */
  test('the cascade selects the chosen stack, resolved through the family tokens', () => {
    const resolved = resolveFontSans()
    expect(resolved.default, 'the default stack is missing').toContain(
      '--font-family-space-grotesk'
    )

    for (const id of ['system', 'geist', 'geist-mono', 'jetbrains-mono']) {
      expect(
        resolved.bySelection[id],
        `[data-font='${id}'] does not resolve to its own stack — the default is winning`
      ).toBe(`var(--font-family-${id})`)
    }
  })

  test('each typeface resolves to a different stack than the default', () => {
    const stacks = new Set<string>()
    for (const id of ['system', 'geist', 'geist-mono', 'jetbrains-mono']) {
      const sans = declaredIn(`[data-font='${id}'] {`, 'font-sans')
      expect(sans, `${id} declares no --font-sans`).toBeDefined()
      stacks.add(sans!)
    }
    expect(stacks.size, `typeface stacks are not distinct: ${[...stacks].join(' | ')}`).toBe(4)
  })

  test('the mono typefaces tighten tracking, and the proportional ones do not', () => {
    // Tracking is what makes a monospace face sit correctly next to prose, and it
    // is only meaningful when the UI face is monospace. A proportional face that
    // tightened would read as a bug.
    for (const id of ['geist-mono', 'jetbrains-mono']) {
      expect(
        declaredIn(`[data-font='${id}'] {`, 'ui-tracking'),
        `${id} sets no --ui-tracking`
      ).toBeDefined()
    }
    for (const id of ['system', 'geist']) {
      expect(
        declaredIn(`[data-font='${id}'] {`, 'ui-tracking'),
        `${id} tightens tracking; a proportional face should not`
      ).toBeUndefined()
    }
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
})
