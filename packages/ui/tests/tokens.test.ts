import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contrastRatio, parseColor as parseCatalogueColor } from '@adea-ai/themes'
import { alertVariants } from '../src/components/ui/alert/alert'
import { badgeVariants } from '../src/components/ui/badge/badge'
import { buttonVariants } from '../src/components/ui/button/button'
import { APPEARANCE_EDITOR_FONT_AXES } from '../src/lib/appearance-font-settings'
import { allTokens, undocumentedTokenAliases } from '../src/lib/tokens'
import { builtinThemes, themeCssVariables } from '../src/lib/themes'
import { destructiveMenuItem, menuItem } from '../src/lib/overlay'
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
const BASE_CSS = readFileSync(join(import.meta.dir, '../src/styles/base.css'), 'utf8')
// These host preference values are emitted by the shared runtime/bootstrap,
// rather than declared as fixed defaults in a stylesheet.
const runtimeAppearanceFontSizeTokens = new Set(
  APPEARANCE_EDITOR_FONT_AXES.map((axis) => `font-${axis}-size`)
)

/* ------------------------------------------------------------------------- */

/**
 * A type size is one token with two declarations: Tailwind pairs `--text-sm`
 * with `--text-sm--line-height`, and the leading belongs to the size rather than
 * standing on its own. Normalising the suffix keeps the manifest describing
 * design decisions instead of Tailwind's file format.
 */
const ownerOf = (name: string) => name.replace(/--line-height$/, '')

describe('token manifest', () => {
  test('every token declared in the theme stylesheets is documented', () => {
    const undocumented = [...declaredNames]
      .map(ownerOf)
      .filter((name) => !manifestNames.has(name) && !undocumentedTokenAliases.includes(name))
      .toSorted()

    expect(
      undocumented,
      'A theme stylesheet declares tokens with no entry in src/lib/tokens.ts. Add each to a group in ' +
        'the manifest (or to undocumentedTokenAliases, with a reason) so the Storybook ' +
        'galleries and the docs stay complete.'
    ).toEqual([])
  })

  test('every documented token is declared in a stylesheet or shared runtime projection', () => {
    const missing = [...manifestNames]
      .filter((name) => !declaredNames.has(name) && !runtimeAppearanceFontSizeTokens.has(name))
      .toSorted()

    expect(
      missing,
      'src/lib/tokens.ts documents tokens with no stylesheet or runtime projection. Either the ' +
        'token was renamed or removed and the manifest is stale, or the manifest invented one.'
    ).toEqual([])
  })

  test('shared runtime-projected font sizes remain documented', () => {
    const missing = [...runtimeAppearanceFontSizeTokens]
      .filter((name) => !manifestNames.has(name))
      .toSorted()

    expect(missing).toEqual([])
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

describe('comfortable touch target utility', () => {
  test('uses the stable 2xl token only when any available pointer is coarse', () => {
    const utility = /@utility touch-target-comfortable\s*\{([\s\S]*?)^\}/m.exec(BASE_CSS)?.[1]

    expect(utility).toContain('@media (any-pointer: coarse)')
    expect(utility).toContain('min-inline-size: var(--control-height-2xl)')
    expect(utility).toContain('min-block-size: var(--control-height-2xl)')
    expect(manifestNames.has('control-height-2xl')).toBe(true)
    expect(valueOf('control-height-2xl', 'root')).toBe('3rem')
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
   * Opaque status-subtle fills are checked against body foreground for every
   * catalogue theme below. The remaining translucent diff and primary fills are
   * not text surfaces: their rendered value depends on what they are mixed into.
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
      why: 'text on the canonical destructive status role',
    },
    {
      fg: 'destructive-action-foreground',
      bg: 'destructive-action',
      minimum: 4.5,
      why: 'the label on a contrast-safe destructive action',
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

  test('disabled menu labels and selected command shortcuts retain readable contrast across the catalogue', () => {
    expect(menuItem).toContain('data-[disabled]:text-muted-foreground')
    expect(menuItem).not.toContain('data-[disabled]:opacity-50')

    for (const theme of builtinThemes) {
      const variables = themeCssVariables(theme)
      const mutedForeground = parseCatalogueColor(variables['--muted-foreground'] ?? '')
      const popover = parseCatalogueColor(variables['--popover'] ?? '')
      const foreground = parseCatalogueColor(variables['--foreground'] ?? '')
      const selectedSurface = parseCatalogueColor(variables['--card'] ?? '')

      expect(mutedForeground, `${theme.id} has no readable muted foreground`).toBeDefined()
      expect(popover, `${theme.id} has no readable popover surface`).toBeDefined()
      expect(foreground, `${theme.id} has no readable foreground`).toBeDefined()
      expect(selectedSurface, `${theme.id} has no readable selected surface`).toBeDefined()

      const disabledLabel = contrastRatio(mutedForeground!, popover!)
      expect(
        disabledLabel,
        `${theme.id} disabled menu text on popover is ${disabledLabel.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(4.5)

      const selectedShortcut = contrastRatio(foreground!, selectedSurface!)
      expect(
        selectedShortcut,
        `${theme.id} selected command shortcut on card surface is ${selectedShortcut.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

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

  test('status component labels and their actual fills compose across every catalogue theme', () => {
    const statuses = [
      { token: 'destructive', badge: 'destructive', alert: 'destructive' },
      { token: 'success', badge: 'success', alert: 'success' },
      { token: 'warning', badge: 'warning', alert: 'warning' },
      { token: 'info', badge: 'info', alert: 'info' },
    ] as const

    for (const theme of builtinThemes) {
      const variables = themeCssVariables(theme)
      const required = (name: string): string => {
        const value = variables[name]
        expect(value, `${theme.id} is missing ${name}`).toBeDefined()
        return value ?? ''
      }
      const bodyText = parseCatalogueColor(required('--foreground'))

      expect(bodyText, `${theme.id} has no body foreground`).toBeDefined()

      for (const status of statuses) {
        const fill = parseCatalogueColor(required(`--${status.token}-subtle`))
        const roleColor = parseCatalogueColor(required(`--${status.token}`))
        expect(fill, `${theme.id} ${status.token}-subtle is not a resolved colour`).toBeDefined()
        expect(roleColor, `${theme.id} ${status.token} is not a resolved colour`).toBeDefined()

        const textRatio = contrastRatio(bodyText!, fill!)
        expect(
          textRatio,
          `${theme.id} foreground on ${status.token}-subtle is ${textRatio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(4.5)

        const iconRatio = contrastRatio(roleColor!, fill!)
        expect(
          iconRatio,
          `${theme.id} ${status.token} icon on its subtle fill is ${iconRatio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(3)

        const menuIndicatorRatio = contrastRatio(
          roleColor!,
          parseCatalogueColor(required('--popover'))!
        )
        expect(
          menuIndicatorRatio,
          `${theme.id} ${status.token} menu edge on popover is ${menuIndicatorRatio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(3)

        const badge = badgeVariants({ variant: status.badge })
        const alert = alertVariants({ variant: status.alert })
        expect(badge).toContain(`bg-${status.token}-subtle`)
        expect(badge).toContain('text-foreground')
        expect(alert).toContain(`bg-${status.token}-subtle`)
        expect(alert).toContain('text-foreground')
      }
    }

    expect(destructiveMenuItem).toContain('text-foreground')
    expect(destructiveMenuItem).toContain('border-destructive')
    expect(destructiveMenuItem).toContain('data-[highlighted]:bg-destructive-subtle')

    const destructiveButton = buttonVariants({ variant: 'destructive' })
    expect(destructiveButton).toContain('bg-destructive-action')
    expect(destructiveButton).toContain('text-destructive-action-foreground')
    expect(destructiveButton).toContain('hover:bg-destructive-action/90')
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
