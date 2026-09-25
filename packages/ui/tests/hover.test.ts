import { describe, expect, test } from 'bun:test'
import { ACCENTS, accentValue, contrastRatio, parseColor } from '@adea-ai/themes'
import { THEME_CSS } from './helpers/theme-css'

/**
 * The hover direction.
 *
 * A hovered primary button moves **away from the canvas** — that is what makes it
 * read as hovered rather than as a second, slightly different colour. Every other
 * assertion in this suite measures a *static* pairing, and axe has no rule for a
 * hover, so nothing here caught the day the rule was written twice and the two
 * copies disagreed: the generated default mixed toward `--background` (toward the
 * page) while every hand-written accent moved away, so the default button hovered
 * backwards and selecting any accent silently corrected it.
 *
 * So this test asserts the *direction*, for the default primary and for every accent,
 * in both appearances. It is the invariant, not a number, which is what makes it
 * survive the values changing.
 *
 * Both sides are read from `theme.css` rather than recomputed, because the failure it
 * guards against is a *generated file* disagreeing with the rule that generated it.
 */

/** The `:root` / `.dark` block a value lives in, as `theme.css` writes it. */
type Appearance = 'light' | 'dark'

/**
 * Resolve a declaration's value to a colour, following the one level of indirection
 * these tokens use.
 *
 * `--primary-hover` is a `color-mix()` over `--primary` and `--foreground`, so a
 * direction check has to evaluate the mix. Only the shapes this file actually
 * generates are handled: a mix of two `var()` references with integer percentages,
 * and a plain colour. Anything else throws rather than being skipped, so a new
 * expression shape fails loudly instead of passing untested.
 */
function resolve(declaration: string, appearance: Appearance, seen = new Set<string>()): string {
  // An operand is either a `var()` reference or a colour written out, because an
  // accent block's hover is the same expression over the accent's own literal.
  const operand = String.raw`(var\(--[\w-]+\)|oklch\([^)]*\))`
  const mix = new RegExp(
    `^color-mix\\(in oklch,\\s*${operand}\\s*([\\d.]+)%,\\s*${operand}\\s*([\\d.]+)%\\)$`
  ).exec(declaration.trim())

  if (!mix) return declaration

  const [, firstOperand, firstShare, secondOperand, secondShare] = mix
  const resolveOperand = (value: string): string => {
    const reference = /^var\((--[\w-]+)\)$/.exec(value)
    return reference ? resolveVar(reference[1]!, appearance, seen) : value
  }

  const first = parseColor(resolveOperand(firstOperand!))!
  const second = parseColor(resolveOperand(secondOperand!))!
  const t = Number(secondShare) / (Number(firstShare) + Number(secondShare))
  return `oklch(${first.l + (second.l - first.l) * t} ${first.c + (second.c - first.c) * t} ${first.h})`
}

/** A token's declared value, from the block that matches the appearance. */
function resolveVar(name: string, appearance: Appearance, seen: Set<string>): string {
  if (seen.has(name)) throw new Error(`circular reference at ${name}`)
  seen.add(name)

  // `--foreground` differs per appearance; the accent blocks override `--primary`
  // and `--primary-hover` only inside their own selector, so the default block is
  // the right source for the theme's own primary.
  const scope = appearance === 'dark' ? '.dark {' : ':root {'
  const start = THEME_CSS.indexOf(scope)
  if (start === -1) throw new Error(`theme.css has no ${scope} block`)
  const end = THEME_CSS.indexOf('\n}', start)
  const block = THEME_CSS.slice(start, end)

  const match = new RegExp(`^\\s*${name}:\\s*(.+);\\s*$`, 'm').exec(block)
  if (!match) throw new Error(`${name} is not declared in ${scope}`)
  return resolve(match[1]!, appearance, seen)
}

/** Lightness of a colour expression, for the direction comparison. */
function lightnessOf(value: string): number {
  const parsed = parseColor(value)
  if (!parsed) throw new Error(`cannot read a lightness from ${value}`)
  return parsed.l
}

describe('the primary hover', () => {
  for (const appearance of ['light', 'dark'] as const) {
    /**
     * The direction, for the theme's own primary.
     *
     * The canvas is what the button sits on, so "away from the canvas" is the
     * comparison — not "darker" or "lighter", which is why this is expressed as a
     * distance rather than a sign.
     */
    test(`the default primary moves away from the canvas (${appearance})`, () => {
      const primary = resolveVar('--primary', appearance, new Set())
      const hover = resolveVar('--primary-hover', appearance, new Set())
      const canvas = resolveVar('--background', appearance, new Set())

      const primaryDistance = Math.abs(lightnessOf(primary) - lightnessOf(canvas))
      const hoverDistance = Math.abs(lightnessOf(hover) - lightnessOf(canvas))

      expect(
        hoverDistance,
        `in the ${appearance} theme the primary is ${lightnessOf(primary).toFixed(3)} against a ` +
          `canvas at ${lightnessOf(canvas).toFixed(3)}, and its hover is ` +
          `${lightnessOf(hover).toFixed(3)} — closer to the canvas, so the button recedes when ` +
          'hovered instead of lifting. The hover is derived in @adea-ai/themes; it must step ' +
          'away from the canvas.'
      ).toBeGreaterThan(primaryDistance)
    })

    /**
     * The same direction for every accent, read from the generated blocks.
     *
     * This is the half that was right while the default was wrong, which is why the
     * assertion covers both rather than trusting one.
     */
    test(`every accent moves away from the canvas (${appearance})`, () => {
      const canvas = resolveVar('--background', appearance, new Set())
      const canvasLightness = lightnessOf(canvas)

      for (const preset of ACCENTS) {
        const selector =
          appearance === 'light'
            ? `[data-accent='${preset.id}'] {`
            : `.dark[data-accent='${preset.id}'] {`
        const start = THEME_CSS.indexOf(selector)
        expect(start, `${selector} is missing from theme.css`).toBeGreaterThan(-1)
        const block = THEME_CSS.slice(start, THEME_CSS.indexOf('\n}', start))

        const hover = /--primary-hover:\s*(.+);/.exec(block)?.[1]
        const primary = /--primary:\s*(.+);/.exec(block)?.[1]
        expect(hover, `${preset.id} has no --primary-hover`).toBeDefined()
        expect(primary, `${preset.id} has no --primary`).toBeDefined()

        // The accent's hover is a mix over `--primary` *inside the accent block*, so
        // it is resolved against the accent's own value rather than the theme's.
        const resolved = resolve(hover!.replace(/var\(--primary\)/g, primary!.trim()), appearance)
        const hoverDistance = Math.abs(lightnessOf(resolved) - canvasLightness)
        const primaryDistance = Math.abs(lightnessOf(primary!.trim()) - canvasLightness)

        expect(
          hoverDistance,
          `${preset.id} in the ${appearance} theme hovers toward the canvas: primary ` +
            `${lightnessOf(primary!.trim()).toFixed(3)} → hover ${lightnessOf(resolved).toFixed(3)}, ` +
            `canvas ${canvasLightness.toFixed(3)}`
        ).toBeGreaterThan(primaryDistance)
      }
    })

    /** The hover stays legible: a step that ruins the label's contrast is not a hover. */
    test(`the label stays legible on a hovered primary (${appearance})`, () => {
      const hover = parseColor(resolveVar('--primary-hover', appearance, new Set()))!
      const label = parseColor(resolveVar('--primary-foreground', appearance, new Set()))!
      const measured = contrastRatio(label, hover)

      expect(
        measured,
        `the label on a hovered primary measures ${measured.toFixed(2)}:1 in the ${appearance} theme`
      ).toBeGreaterThanOrEqual(4.5)
    })
  }

  /**
   * The accent pairs are designed so the label polarity flips between appearances,
   * and the generated blocks carry a measured label rather than a convention.
   */
  test('every accent carries a label that clears the floor', () => {
    for (const preset of ACCENTS) {
      for (const appearance of ['light', 'dark'] as const) {
        const fill = parseColor(accentValue(preset, appearance))!
        const label = /--primary-foreground:\s*(.+);/.exec(
          THEME_CSS.slice(
            THEME_CSS.indexOf(
              appearance === 'light'
                ? `[data-accent='${preset.id}'] {`
                : `.dark[data-accent='${preset.id}'] {`
            )
          )
        )?.[1]
        expect(label, `${preset.id}/${appearance} has no --primary-foreground`).toBeDefined()
        const measured = contrastRatio(parseColor(label!.trim())!, fill)
        expect(
          measured,
          `${preset.id} in the ${appearance} theme has a ${measured.toFixed(2)}:1 label`
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
