import { describe, expect, test } from 'bun:test'
import { contrastRatio, parseColor as parseCatalogueColor } from '@adea-ai/themes'
import { allTokens, undocumentedTokenAliases } from '../src/lib/tokens'
import { declarations, declaredNames, valueOf, type Scope } from './helpers/theme-css'

/* ---------------------------------------------------------------------------
 * Contrast is *measured*, and the measurement is the catalogue's.
 *
 * This file used to carry its own OKLCH → sRGB → luminance conversion, matrices
 * and all. That was a second implementation of arithmetic `@adea-ai/themes` already
 * ships, and the failure mode of two implementations is the bad one: they agree
 * until a rounding difference makes one of them report a pass and the other a fail,
 * and then the number in CI is not the number in the catalogue.
 *
 * So `contrastRatio` and `parseColor` are imported. What stays here is what is
 * genuinely *this system's*: the pairings it renders, and the floors it holds its own
 * default themes to.
 * ------------------------------------------------------------------------- */

/**
 * The measured ratio between two declared values.
 *
 * A value the catalogue cannot read — missing, or not a colour it parses —
 * measures `NaN`, and `NaN` fails every floor it is compared against. That is the
 * behaviour worth having: an unreadable token fails loudly at the assertion that
 * names it, rather than being skipped or compared as zero. The pairings loop also
 * asserts readability directly, so the failure message says which token and why.
 */
function ratio(fg: string | undefined, bg: string | undefined): number {
  const foreground = fg ? parseCatalogueColor(fg) : undefined
  const background = bg ? parseCatalogueColor(bg) : undefined
  if (!foreground || !background) return Number.NaN
  return contrastRatio(foreground, background)
}

const themes: Scope[] = ['root', 'dark']

const manifestNames = new Set(allTokens.map((token) => token.name))

/* ------------------------------------------------------------------------- */

/**
 * A type size is one token with two declarations: Tailwind pairs `--text-sm`
 * with `--text-sm--line-height`, and the leading belongs to the size rather than
 * standing on its own. Normalising the suffix keeps the manifest describing
 * design decisions instead of Tailwind's file format.
 */
const ownerOf = (name: string) => name.replace(/--line-height$/, '')

describe('token manifest', () => {
  test('every token declared in theme.css is documented', () => {
    const undocumented = [...declaredNames]
      .map(ownerOf)
      .filter((name) => !manifestNames.has(name) && !undocumentedTokenAliases.includes(name))
      .toSorted()

    expect(
      undocumented,
      'theme.css declares tokens with no entry in src/lib/tokens.ts. Add each to a group in ' +
        'the manifest (or to undocumentedTokenAliases, with a reason) so the Storybook ' +
        'galleries and the docs stay complete.'
    ).toEqual([])
  })

  test('every documented token is declared in theme.css', () => {
    const missing = [...manifestNames].filter((name) => !declaredNames.has(name)).toSorted()

    expect(
      missing,
      'src/lib/tokens.ts documents tokens that theme.css does not declare. Either the token ' +
        'was renamed or removed in CSS and the manifest is stale, or the manifest invented one.'
    ).toEqual([])
  })

  test('every colour token is themed, or explicitly theme-invariant', () => {
    const colors = allTokens.filter((token) => token.kind === 'color')
    const notThemed = colors.filter((token) => !token.themed).map((token) => token.name)

    // Only the scrim family and the sidebar's pass-throughs may be invariant;
    // a colour that does not vary with polarity has to be a deliberate choice,
    // because the usual reason for one is that the light theme was forgotten.
    expect(notThemed.toSorted()).toEqual(['scrim', 'scrim-edge', 'scrim-foreground'])
  })
})

describe('contrast', () => {
  /**
   * The pairings *this system* renders, each measured on the surface the text
   * really sits on.
   *
   * **These floors are deliberately not the catalogue's.** `@adea-ai/themes` holds
   * every palette it accepts to WCAG AA — `CONTRAST_FLOORS` is 4.5:1 for text and
   * 3:1 for a raised indicator — because a floor that rejected a well-made
   * third-party palette would make the catalogue useless. The two themes that ship
   * as this system's defaults are held higher: **7:1** for body text, which is AAA
   * and is what "solved rather than chosen" means here.
   *
   * So a number below is not the catalogue's number restated, and it is not drift
   * either. It is the stricter promise the defaults make, and the catalogue's own
   * suite is the one that checks everything else.
   *
   * `color-mix()` fills (the `-subtle` family, the diff backgrounds) are not
   * covered here because their resolved value depends on what they are mixed
   * into. Their foregrounds are chosen from the solid tokens, which are.
   */
  const pairings: { fg: string; bg: string; minimum: number; why: string }[] = [
    { fg: 'foreground', bg: 'background', minimum: 7, why: 'body text on the canvas' },
    { fg: 'foreground', bg: 'card', minimum: 7, why: 'body text on a card' },
    { fg: 'card-foreground', bg: 'card', minimum: 7, why: 'text on a card' },
    { fg: 'popover-foreground', bg: 'popover', minimum: 7, why: 'text on a floating surface' },
    // 4.5 rather than 7: secondary text is allowed to be quieter, not unreadable.
    { fg: 'muted-foreground', bg: 'background', minimum: 4.5, why: 'secondary text on the canvas' },
    { fg: 'muted-foreground', bg: 'card', minimum: 4.5, why: 'secondary text on a card' },
    { fg: 'muted-foreground', bg: 'popover', minimum: 4.5, why: 'secondary text in a menu' },
    {
      fg: 'sidebar-muted-foreground',
      bg: 'sidebar',
      minimum: 4.5,
      why: 'an inactive rail destination',
    },
    { fg: 'sidebar-foreground', bg: 'sidebar', minimum: 7, why: 'an active rail destination' },
    { fg: 'primary-foreground', bg: 'primary', minimum: 4.5, why: 'the label on a primary button' },
    {
      fg: 'secondary-foreground',
      bg: 'secondary',
      minimum: 4.5,
      why: 'the label on a secondary button',
    },
    {
      fg: 'destructive-foreground',
      bg: 'destructive',
      minimum: 4.5,
      why: 'the label on a destructive button',
    },
    { fg: 'success-foreground', bg: 'success', minimum: 4.5, why: 'the label on a success button' },
    { fg: 'warning-foreground', bg: 'warning', minimum: 4.5, why: 'the label on a warning badge' },
    { fg: 'info-foreground', bg: 'info', minimum: 4.5, why: 'the label on an info badge' },
  ]

  for (const theme of themes) {
    const label = theme === 'root' ? 'light' : 'dark'

    describe(`${label} theme`, () => {
      for (const pairing of pairings) {
        test(`${pairing.fg} on ${pairing.bg} (${pairing.why})`, () => {
          const fg = valueOf(pairing.fg, theme)
          const bg = valueOf(pairing.bg, theme)

          // A pairing whose tokens are missing, or whose values the catalogue
          // cannot read, is a test bug rather than a pass — better to fail loudly
          // than to compare NaN and skip silently.
          expect(fg, `${pairing.fg} is not declared in the ${label} theme`).toBeDefined()
          expect(bg, `${pairing.bg} is not declared in the ${label} theme`).toBeDefined()
          expect(
            parseCatalogueColor(fg!),
            `${pairing.fg} is not a value @adea-ai/themes can read in the ${label} theme`
          ).toBeDefined()
          expect(
            parseCatalogueColor(bg!),
            `${pairing.bg} is not a value @adea-ai/themes can read in the ${label} theme`
          ).toBeDefined()

          const measured = ratio(fg, bg)
          expect(
            Number(measured.toFixed(2)),
            `${pairing.fg} on ${pairing.bg} measures ${measured.toFixed(2)}:1 in the ${label} theme, ` +
              `below the ${pairing.minimum}:1 floor. Adjust the token in theme.css.`
          ).toBeGreaterThanOrEqual(pairing.minimum)
        })
      }
    })
  }

  test('a focus ring is distinguishable from its surface', () => {
    for (const theme of themes) {
      const label = theme === 'root' ? 'light' : 'dark'
      const measured = ratio(valueOf('ring', theme), valueOf('background', theme))

      // WCAG 1.4.11 sets a 3:1 floor for a non-text indicator that is the only
      // cue to state. The ring is that cue for keyboard focus.
      expect(
        Number(measured.toFixed(2)),
        `the focus ring is ${measured.toFixed(2)}:1 on the ${label} canvas`
      ).toBeGreaterThanOrEqual(3)
    }
  })

  test('the border is subtle but present on both surfaces', () => {
    for (const theme of themes) {
      const label = theme === 'root' ? 'light' : 'dark'
      for (const surface of ['background', 'card']) {
        const measured = ratio(valueOf('border', theme), valueOf(surface, theme))
        // A hairline is decoration, not an indicator, so the WCAG floor does not
        // apply — but a border that resolves to its own surface is an invisible
        // card, which is a real defect. 1.1:1 is "you can see there is an edge".
        expect(
          Number(measured.toFixed(3)),
          `border is ${measured.toFixed(3)}:1 against ${surface} in the ${label} theme — too faint to read as an edge`
        ).toBeGreaterThanOrEqual(1.1)
      }
    }
  })
})

describe('structure', () => {
  test('the token file declares both themes', () => {
    expect(declarations.some((d) => d.scope === 'dark')).toBe(true)
    expect(declarations.filter((d) => d.scope === 'root').length).toBeGreaterThan(50)
  })

  test('the dark theme overrides every colour the light theme defines', () => {
    const lightColors = declaredNames
    const darkNames = new Set(declarations.filter((d) => d.scope === 'dark').map((d) => d.name))

    const invariant = new Set(['scrim', 'scrim-foreground', 'scrim-edge'])

    // Non-colour tokens live in their own `:root` block and are not expected in
    // `.dark`; only the colour family is checked here.
    const expectedInDark = allTokens
      .filter((token) => token.kind === 'color' && token.themed)
      .map((token) => token.name)

    const missing = expectedInDark.filter((name) => !darkNames.has(name))
    expect(missing).toEqual([])
    expect([...invariant].filter((name) => !lightColors.has(name))).toEqual([])
  })
})
