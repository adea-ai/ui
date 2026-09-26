/**
 * Generates the two default themes' declarations in `src/styles/theme.css`.
 *
 * ## Why this file exists
 *
 * The design system applies a theme at runtime by writing every role onto `<html>`
 * as a custom property (see `ThemeProvider`). That is correct and complete — but it
 * only happens once JavaScript has run, and the first paint happens before that. So
 * `theme.css` has to carry the default themes' values too, or the application
 * flickers from an unstyled palette to the chosen one on every load.
 *
 * Those values are a copy of what `themeCssVariables` produces, and a copy that is
 * only ever written by hand is a copy that is eventually wrong. It has already been
 * wrong twice: once when the catalogue moved out of this repository, and once when
 * Adea Dark was recomposed from two upstream palettes. Both times the symptom was a
 * brief flash of a theme the user had not chosen, which is exactly the kind of defect
 * that survives review because it is invisible in a screenshot.
 *
 * So the declarations are generated. `theme.css` keeps everything that is not a
 * theme — the radius, density, typography, elevation, motion and z-index scales, the
 * font axis and the Tailwind bridge — and three regions come from here: the two
 * defaults' colour declarations, and the accent blocks.
 *
 * The accent blocks joined them for the reason the defaults did. They were written
 * by hand, and the *hover* rule in particular existed twice: once here, as a
 * `color-mix()` toward `--background`, and once per accent as a literal. The two
 * disagreed — the generated default moved toward the canvas and every accent moved
 * away — so the default primary button hovered backwards and selecting any accent
 * silently corrected it. One rule, emitted from one place, is what makes that
 * impossible rather than unlikely.
 *
 * ## What is not generated
 *
 * Four tokens are this system's own and have no catalogue role: `--primary-hover`,
 * `--primary-subtle`, `--chrome` and `--surface-sunken`. They are *derived* from
 * catalogue roles rather than catalogued, and they are emitted as `color-mix()`
 * expressions over the properties they derive from, so they track a theme change
 * automatically instead of needing to be regenerated. `--chrome-alpha` is not a
 * colour and stays in `theme.css`.
 *
 * Usage:
 *
 *   bun run theme:build    # rewrite the two blocks in src/styles/theme.css
 *   bun run theme:check    # fail if they are stale
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ACCENTS,
  accentRoles,
  contrastRatio,
  formatOklch,
  parseColor,
  primaryHover,
  primarySubtleCss,
  shiftLightness,
} from '@adea-ai/themes'

import { themeById, themeCssVariables, type ThemeVariant } from '../src/lib/themes'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const THEME_CSS = join(ROOT, 'src', 'styles', 'theme.css')

const check = process.argv.includes('--check')

/** The marker that delimits a generated block, by scope. */
function markers(scope: 'root' | 'dark'): { open: string; close: string } {
  return {
    open: `  /* @generated theme:${scope} — run \`bun run theme:build\` after changing the catalogue */`,
    close: `  /* @end generated theme:${scope} */`,
  }
}

/** The opening line of the block a generated region lives in. */
function blockOpener(scope: 'root' | 'dark'): string {
  return scope === 'root' ? ':root {' : '.dark {'
}

/**
 * The system's own tokens, derived from catalogue roles.
 *
 * Each is a `color-mix()` over the property it is built from rather than a computed
 * value, so a theme switch at runtime updates it without this script knowing. Where a
 * value genuinely cannot be expressed that way it is computed here, and the comment
 * says why.
 */
function derivedDeclarations(theme: ThemeVariant): string[] {
  return [
    `  /*`,
    `   * A uniform step away from the canvas, so a hovered primary button reads as`,
    `   * hovered rather than as a second, slightly different colour.`,
    `   *`,
    `   * Resolved rather than a \`color-mix()\`, because a uniform step cannot be`,
    `   * expressed as one: mixing a fixed share toward white or black moves an accent`,
    `   * by a share of its headroom, which gives the light appearance a step twice the`,
    `   * dark one's and nearly none at all on the palest accent.`,
    `   *`,
    `   * Both values come from @adea-ai/themes, so the accent blocks below are the same`,
    `   * rule rather than a matching one — which is what they were not, before.`,
    `   */`,
    `  --primary-hover: ${primaryHover(theme.colors.primary, theme.appearance)};`,
    `  --primary-subtle: ${primarySubtleCss(theme.appearance)};`,
    `  /* The window chrome, one step off the canvas. */`,
    `  --chrome: var(--surface);`,
    `  /*`,
    `   * Below the canvas: a code well, an inset panel. Not a catalogue role, because`,
    `   * the catalogue's ladder only goes *up* from the canvas — the four rungs it`,
    `   * derives are all surfaces something sits on. This is the one value in the`,
    `   * ladder that runs the other way, so it is computed rather than mapped.`,
    `   *`,
    `   * Darker in both appearances, which is the rule the ladder does not follow: a`,
    `   * raised surface is lighter than the canvas on a dark theme and darker on a`,
    `   * light one, but a sunken one is *always* darker, because the metaphor is a`,
    `   * well cut into the page rather than a panel laid on it.`,
    `   */`,
    `  --surface-sunken: ${sunken(theme)};`,
    `  --chrome-alpha: 0.9;`,
  ]
}

/**
 * One step below the canvas, away from the foreground.
 *
 * Computed rather than expressed in CSS because `color-mix()` cannot move a colour
 * along the lightness axis — mixing toward black or white also drains the hue, and
 * these themes' canvases are tinted.
 */
function sunken(theme: ThemeVariant): string {
  const background = parseColor(theme.colors.background)
  if (!background) return theme.colors.background
  return formatOklch(shiftLightness(background, -0.02))
}

/**
 * The status labels, which are measured rather than assumed.
 *
 * A dark theme's body text is near-white and near-white on a bright green is about
 * 2.6:1, so the label on a filled status control is chosen per theme from whichever of
 * the two extremes measures better against the fill. That is the same rule the
 * catalogue applies in `statusForeground`, restated here because the tokens this
 * system exposes (`--success-foreground` and friends) are not catalogue roles.
 */
function statusLabels(theme: ThemeVariant): Record<'success' | 'warning' | 'info', string> {
  const label = (role: 'success' | 'warning' | 'info'): string => {
    const fill = parseColor(theme.colors[role])
    if (!fill) return theme.colors.foreground

    // Whichever of the theme's two extremes measures better on this fill. Computed
    // rather than fixed because it genuinely differs per theme: near-white is the
    // right label on a deep red and the wrong one on a bright green.
    let best = theme.colors.foreground
    let bestRatio = contrastRatio(parseColor(best)!, fill)
    for (const candidate of [theme.colors.background, theme.colors.foreground]) {
      const parsed = parseColor(candidate)
      if (!parsed) continue
      const ratio = contrastRatio(parsed, fill)
      if (ratio > bestRatio) {
        best = candidate
        bestRatio = ratio
      }
    }
    return best
  }

  return { success: label('success'), warning: label('warning'), info: label('info') }
}

/**
 * The declarations for one default theme.
 *
 * Ordered by the groups `theme.css` has always used, so that regenerating produces a
 * diff of values and not a diff of shape.
 */
function generate(theme: ThemeVariant): string {
  const variables = themeCssVariables(theme)
  const value = (name: string): string => {
    const found = variables[name]
    if (!found) throw new Error(`${name} is missing from themeCssVariables for ${theme.id}`)
    return found
  }
  const lines: string[] = []

  const group = (title: string, names: string[]): void => {
    lines.push(`  /* ${title} */`)
    for (const name of names) lines.push(`  --${name}: ${value(`--${name}`)};`)
    lines.push('')
  }

  group('The canvas and its text', ['background', 'foreground'])
  group('Raised surfaces', [
    'card',
    'card-foreground',
    'popover',
    'popover-foreground',
    'surface-hover',
    'surface-active',
  ])
  // Aliases rather than values: the ladder's names are the roles they point at, so a
  // theme switch moves them without this file knowing.
  lines.push(
    '  --surface: var(--background);',
    '  --surface-raised: var(--card);',
    '  --surface-overlay: var(--popover);',
    ''
  )
  group('The interactive colour', [
    'primary',
    'primary-foreground',
    'ring',
    'accent',
    'accent-foreground',
  ])
  group('Neutral fills and secondary text', [
    'secondary',
    'secondary-foreground',
    'muted',
    'muted-foreground',
  ])

  const labels = statusLabels(theme)
  lines.push('  /* Status. The fills are catalogue roles; the labels are measured. */')
  lines.push(`  --destructive: ${value('--destructive')};`)
  lines.push(`  --destructive-foreground: ${value('--destructive-foreground')};`)
  for (const role of ['success', 'warning', 'info'] as const) {
    lines.push(`  --${role}: ${value(`--${role}`)};`)
    lines.push(`  --${role}-foreground: ${labels[role]};`)
  }
  lines.push(
    '  --destructive-subtle: color-mix(in oklch, var(--destructive) 16%, transparent);',
    '  --success-subtle: color-mix(in oklch, var(--success) 16%, transparent);',
    '  --warning-subtle: color-mix(in oklch, var(--warning) 16%, transparent);',
    '  --info-subtle: color-mix(in oklch, var(--info) 16%, transparent);',
    ''
  )

  group('Lines', ['border', 'input'])
  lines.push('  /* The primary, so a focus ring is the interactive colour. */')
  lines.push('  --ring: var(--primary);')
  lines.push('')

  group('The sidebar', [
    'sidebar',
    'sidebar-foreground',
    'sidebar-accent',
    'sidebar-border',
    'sidebar-muted-foreground',
  ])
  lines.push(
    '  --sidebar-primary: var(--primary);',
    '  --sidebar-primary-foreground: var(--primary-foreground);',
    '  --sidebar-accent-foreground: var(--accent-foreground);',
    '  --sidebar-ring: var(--ring);',
    ''
  )

  group('Charts', ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6'])

  // The `--terminal-*` and `--editor-*` ramps are deliberately absent. They are
  // written by the provider at runtime and are not part of the token manifest, so
  // carrying them here would add undeclared names to this file and make the manifest
  // check fail — a change worth making deliberately, with the manifest and the
  // galleries updated together, rather than as a side effect of this one.

  lines.push('  /* Diff surfaces, over the status roles. */')
  lines.push(
    '  --diff-add: color-mix(in oklch, var(--success) 18%, transparent);',
    '  --diff-add-foreground: var(--success);',
    '  --diff-delete: color-mix(in oklch, var(--destructive) 18%, transparent);',
    '  --diff-delete-foreground: var(--destructive);',
    '  --diff-hunk: color-mix(in oklch, var(--info) 14%, transparent);',
    '  --diff-hunk-foreground: var(--info);',
    '  --diff-meta-foreground: var(--muted-foreground);',
    ''
  )

  if (theme.appearance === 'light') {
    lines.push(
      '  /*',
      '   * The modal veil. One value in both appearances because a scrim sits over',
      '   * media rather than over the application — a video, a screenshot — and a veil',
      '   * that changed with the theme would be a veil that is wrong half the time.',
      '   */',
      '  --scrim: oklch(0.1919 0.025 264.7);',
      '  --scrim-foreground: oklch(1 0 0);',
      '  --scrim-edge: oklch(1 0 0);',
      ''
    )
  }

  lines.push(...derivedDeclarations(theme))
  lines.push('')
  // Not a custom property, and load-bearing: it is what makes the platform render
  // form controls, scrollbars and the caret in the theme's own appearance.
  lines.push(`  color-scheme: ${theme.appearance};`)

  return lines.join('\n')
}

/**
 * Replaces the generated region of one block, inserting the markers if absent.
 *
 * Self-bootstrapping on purpose. The markers are the only thing that says where the
 * generated region begins, and a script that refused to run without them would make a
 * fresh checkout or a `git checkout` of this file an error rather than a no-op — which
 * is exactly the trap that caught this file's first author. If the markers are missing
 * the whole block body is taken as the region, which is right because the block existed
 * only to hold colours.
 */
/** The markers around the generated accent blocks. */
const ACCENT_OPEN =
  '/* @generated accents — run `bun run theme:build` after changing the catalogue */'
const ACCENT_CLOSE = '/* @end generated accents */'

/** The five declarations one accent sets. */
function accentDeclarations(appearance: 'light' | 'dark', preset: (typeof ACCENTS)[number]) {
  const roles = accentRoles(preset, appearance)
  return [
    `  --primary: ${roles.primary};`,
    `  --primary-foreground: ${roles.primaryForeground};`,
    `  --primary-hover: ${roles.primaryHover};`,
    `  --primary-subtle: ${roles.primarySubtle};`,
    `  --ring: ${roles.ring};`,
  ]
}

/**
 * The twelve accent blocks, from the catalogue's preset list.
 *
 * A block sets five properties and no more. `--primary-hover` and `--primary-subtle`
 * are expressions over `--primary`, so they are identical in every block by
 * construction — which is the point: they used to be five hand-written literals per
 * block, and the default's rule disagreed with all twelve of them.
 *
 * `[data-accent]` is the light block and `.dark[data-accent]` the dark one, because
 * the accent is a selection on the same element that carries the theme rather than a
 * theme of its own. The default (`theme`) sets no `data-accent` and needs no block.
 */
function accentBlocks(): string {
  return ACCENTS.map((preset) =>
    [
      `[data-accent='${preset.id}'] {`,
      ...accentDeclarations('light', preset),
      `}`,
      `.dark[data-accent='${preset.id}'] {`,
      ...accentDeclarations('dark', preset),
      `}`,
    ].join('\n')
  ).join('\n\n')
}

/**
 * Replaces the run of accent blocks.
 *
 * Unlike a single block, this region is bounded by the section comment that follows
 * it rather than by brace counting: it is twelve blocks, and the first run has no
 * markers to find.
 */
function replaceAccentRegion(css: string, body: string): string {
  const openIndex = css.indexOf(ACCENT_OPEN)

  if (openIndex !== -1) {
    const closeIndex = css.indexOf(ACCENT_CLOSE, openIndex)
    if (closeIndex === -1) throw new Error('theme.css has an accent marker with no end marker')
    return (
      css.slice(0, openIndex) +
      `${ACCENT_OPEN}\n${body}\n${ACCENT_CLOSE}` +
      css.slice(closeIndex + ACCENT_CLOSE.length)
    )
  }

  const first = css.indexOf("[data-accent='")
  if (first === -1) throw new Error('theme.css has no accent blocks to replace')
  const lineStart = css.lastIndexOf('\n', first) + 1
  const nextSection = css.indexOf('/* ---', first)
  if (nextSection === -1) throw new Error('theme.css has no section after the accent blocks')

  return `${css.slice(0, lineStart)}${ACCENT_OPEN}\n${body}\n${ACCENT_CLOSE}\n\n${css.slice(nextSection)}`
}

function replaceRegion(css: string, scope: 'root' | 'dark', body: string): string {
  const { open, close } = markers(scope)
  const opener = blockOpener(scope)
  const blockStart = css.indexOf(`${opener}\n`)
  if (blockStart === -1) throw new Error(`theme.css has no ${opener} block`)
  const bodyStart = blockStart + opener.length + 1

  let openIndex = css.indexOf(open, blockStart)
  let closeIndex = openIndex === -1 ? -1 : css.indexOf(close, openIndex)

  if (openIndex === -1 || closeIndex === -1) {
    // No markers yet: the region is the block's whole body, ending at its closing
    // brace. Braces are counted rather than searched for, so a declaration whose value
    // contains one cannot end the block early.
    openIndex = bodyStart
    let depth = 1
    let index = bodyStart
    while (depth > 0 && index < css.length) {
      if (css[index] === '{') depth += 1
      else if (css[index] === '}') depth -= 1
      index += 1
    }
    closeIndex = index - 1
  } else {
    closeIndex += close.length
    return `${css.slice(0, openIndex)}${open}\n${body}\n${close}${css.slice(closeIndex)}`
  }

  return `${css.slice(0, openIndex)}${open}\n${body}\n${close}\n${css.slice(closeIndex)}`
}

async function main(): Promise<void> {
  const original = await readFile(THEME_CSS, 'utf8')
  const light = themeById('adea-light')
  const dark = themeById('adea-dark')
  if (!light || !dark) throw new Error('the catalogue is missing a default theme')

  const generated = replaceAccentRegion(
    replaceRegion(replaceRegion(original, 'root', generate(light)), 'dark', generate(dark)),
    accentBlocks()
  )

  if (check) {
    if (generated !== original) {
      console.error('theme.css is stale. Run: bun run theme:build')
      process.exit(1)
    }
    console.log('theme.css matches the catalogue')
    return
  }

  await writeFile(THEME_CSS, generated, 'utf8')
  console.log('theme.css regenerated from the catalogue')
}

await main()
