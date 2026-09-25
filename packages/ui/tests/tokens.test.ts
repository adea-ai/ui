import { describe, expect, test } from 'bun:test'
import { allTokens, undocumentedTokenAliases } from '../src/lib/tokens'
import { declarations, declaredNames, valueOf, type Scope } from './helpers/theme-css'

/* ---------------------------------------------------------------------------
 * OKLCH → sRGB → relative luminance, so contrast is *measured* rather than
 * asserted. Values are rounded to 8 bits per channel, exactly as a browser
 * renders them, so the number this test computes is the number a user sees.
 * ------------------------------------------------------------------------- */

function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(value: number): number {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
}

function oklchToRgb(l: number, c: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)

  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3)

  const linear = [
    4.0767416621 * lms[0]! - 3.3077115913 * lms[1]! + 0.2309699292 * lms[2]!,
    -1.2684380046 * lms[0]! + 2.6097574011 * lms[1]! - 0.3413193965 * lms[2]!,
    -0.0041960863 * lms[0]! - 0.7034186147 * lms[1]! + 1.707614701 * lms[2]!,
  ]

  return linear.map((v) =>
    Math.round(Math.max(0, Math.min(1, linearToSrgb(Math.max(0, Math.min(1, v))))) * 255)
  ) as [number, number, number]
}

function parseColor(raw: string | undefined): [number, number, number] | undefined {
  if (!raw) return undefined
  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(raw.trim())
  if (!oklch) return undefined
  return oklchToRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]))
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(srgbToLinear) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].toSorted((x, y) => y - x) as [
    number,
    number,
  ]
  return (light + 0.05) / (dark + 0.05)
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
   * The pairings the system actually renders, each measured on the surface the
   * text really sits on. These are not aspirations: they are the numbers the
   * token values were solved for, and a change that breaks one is a visible
   * regression for anyone reading the interface at 4.5:1 or below.
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
          const fg = parseColor(valueOf(pairing.fg, theme))
          const bg = parseColor(valueOf(pairing.bg, theme))

          // A pairing whose tokens are not plain oklch() is a test bug, not a
          // pass — better to fail loudly than to skip silently.
          expect(
            fg,
            `${pairing.fg} is not a plain oklch() value in the ${label} theme`
          ).toBeDefined()
          expect(
            bg,
            `${pairing.bg} is not a plain oklch() value in the ${label} theme`
          ).toBeDefined()

          const ratio = contrast(fg!, bg!)
          expect(
            Number(ratio.toFixed(2)),
            `${pairing.fg} on ${pairing.bg} measures ${ratio.toFixed(2)}:1 in the ${label} theme, ` +
              `below the ${pairing.minimum}:1 floor. Adjust the token in theme.css.`
          ).toBeGreaterThanOrEqual(pairing.minimum)
        })
      }
    })
  }

  test('a focus ring is distinguishable from its surface', () => {
    for (const theme of themes) {
      const label = theme === 'root' ? 'light' : 'dark'
      const ring = parseColor(valueOf('ring', theme))!
      const background = parseColor(valueOf('background', theme))!
      const ratio = contrast(ring, background)

      // WCAG 1.4.11 sets a 3:1 floor for a non-text indicator that is the only
      // cue to state. The ring is that cue for keyboard focus.
      expect(
        Number(ratio.toFixed(2)),
        `the focus ring is ${ratio.toFixed(2)}:1 on the ${label} canvas`
      ).toBeGreaterThanOrEqual(3)
    }
  })

  test('the border is subtle but present on both surfaces', () => {
    for (const theme of themes) {
      const label = theme === 'root' ? 'light' : 'dark'
      const border = parseColor(valueOf('border', theme))!

      for (const surface of ['background', 'card']) {
        const ratio = contrast(border, parseColor(valueOf(surface, theme))!)
        // A hairline is decoration, not an indicator, so the WCAG floor does not
        // apply — but a border that resolves to its own surface is an invisible
        // card, which is a real defect. 1.1:1 is "you can see there is an edge".
        expect(
          Number(ratio.toFixed(3)),
          `border is ${ratio.toFixed(3)}:1 against ${surface} in the ${label} theme — too faint to read as an edge`
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
