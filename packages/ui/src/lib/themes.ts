/**
 * The theme registry, now a bridge.
 *
 * The catalogue itself lives in `@adea-ai/themes`. This module is what is left in
 * the design system: the translation between the catalogue's **canonical** role
 * names and the **shadcn** vocabulary every component here is written against, plus
 * the handful of custom properties this system declares that are presentations of
 * data the catalogue already holds — the `--terminal-*` ramp, the `--editor-*` ramp,
 * and `--chrome`.
 *
 * ## Why it is a bridge and not a copy
 *
 * This file used to hold thirteen themes as hand-written hex literal tables, with its
 * own contrast validator, its own terminal and editor palettes, and its own
 * provenance records. That is a lot of surface to maintain for one consumer of a
 * palette, and it meant every product that wanted the same themes — Adea, Cortana —
 * either imported this package or wrote its own. The catalogue moved out so that
 * there is one answer to "what is Catppuccin Mocha", and this file is the part that
 * genuinely belongs to the design system.
 *
 * It is deliberately thin. If you are looking for a colour, it is not here: see
 * `@adea-ai/themes`, whose README explains how the values are produced and whose
 * `NOTICE` records where every palette came from.
 *
 * ## The mapping, and the entry that is not a rename
 *
 * {@link ROLE_FOR} maps canonical roles onto this system's variable vocabulary. One
 * entry will trip a reader: the catalogue's `accent` becomes this system's
 * `primary`, because in the shadcn vocabulary `--primary` is the action colour — the
 * fill of a primary button, the thing a focus ring is drawn in — while `--accent` is
 * a low-contrast hover wash. The catalogue's `accent` is the former, so it goes to
 * `--primary`, and `--accent` is filled from `surfaceHover`, which is what shadcn
 * components actually use it for.
 */

import {
  chartSeries,
  hasTheme,
  statusForeground,
  primaryHover,
  primarySubtleCss,
  syntaxRoles,
  themes as catalogue,
  themesByAppearance,
  validateCatalogue,
  type AdeaThemeRecord,
  type ContrastFinding,
} from '@adea-ai/themes'

export type ThemeAppearance = 'light' | 'dark'

/**
 * The surface and text roles, in shadcn's vocabulary.
 *
 * Named to match the components below, which is why they differ from the
 * catalogue's: these are this system's variable names, and renaming them would mean
 * touching every component in the library for no gain.
 */
export type ThemeColors = {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  success: string
  warning: string
  info: string
  border: string
  input: string
  ring: string
  sidebar: string
  sidebarForeground: string
  sidebarAccent: string
  sidebarBorder: string
}

/** The sixteen ANSI colours a terminal needs, plus its cursor and selection. */
export type ThemeTerminalPalette = {
  background: string
  foreground: string
  cursor: string
  selection: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

/** The syntax roles a code view needs. */
export type ThemeEditorPalette = {
  keyword: string
  string: string
  number: string
  comment: string
  function: string
  variable: string
  type: string
  tag: string
  attribute: string
  operator: string
  heading: string
  link: string
  diffAdd: string
  diffDelete: string
  diffHunk: string
  searchMatch: string
}

/** Where a palette came from, and the terms it is used under. */
export type ThemeProvenance = {
  /** The project or person the palette belongs to. */
  source: string
  url: string
  /** An SPDX identifier. Every palette in this catalogue is permissive. */
  license: string
}

export type ThemeVariant = {
  /** The `data-theme` value and the id a preference stores. */
  id: string
  /** Groups the variants that came from one project. */
  family: string
  familyLabel: string
  label: string
  appearance: ThemeAppearance
  /** One line, shown in a picker. */
  description: string
  colors: ThemeColors
  terminal: ThemeTerminalPalette
  editor: ThemeEditorPalette
  /** The categorical series, in order. */
  chart: readonly string[]
  provenance: ThemeProvenance
}

/**
 * Canonical role → this system's `ThemeColors` key.
 *
 * Read by {@link toVariant}. Every key of `ThemeColors` must appear, so a role added
 * to this system fails the type check rather than silently resolving to `undefined`.
 */
const ROLE_FOR: Readonly<Record<keyof ThemeColors, keyof AdeaThemeRecord['colors']>> = {
  background: 'background',
  foreground: 'text',
  card: 'surface',
  cardForeground: 'text',
  popover: 'surfaceElevated',
  popoverForeground: 'text',
  // Not a rename — see this module's header.
  primary: 'accent',
  primaryForeground: 'accentForeground',
  // shadcn's `secondary` and `muted` are both the first surface rung used as a fill.
  secondary: 'surface',
  secondaryForeground: 'text',
  muted: 'surface',
  mutedForeground: 'textMuted',
  // shadcn's `accent` is a hover wash, which is exactly `surfaceHover`.
  accent: 'surfaceHover',
  accentForeground: 'text',
  destructive: 'error',
  // Overwritten below from the measured pairing; nominal here so the table is total.
  destructiveForeground: 'error',
  success: 'success',
  warning: 'warning',
  info: 'info',
  border: 'border',
  input: 'border',
  ring: 'accent',
  sidebar: 'surface',
  sidebarForeground: 'text',
  sidebarAccent: 'surfaceHover',
  sidebarBorder: 'border',
}

/** Builds the design system's view of one catalogue entry. */
function toVariant(theme: AdeaThemeRecord): ThemeVariant {
  const colors = {} as ThemeColors
  for (const key of Object.keys(ROLE_FOR) as (keyof ThemeColors)[]) {
    colors[key] = theme.colors[ROLE_FOR[key]]
  }
  // The label on a solid destructive fill is measured rather than mapped: on a bright
  // red it is black and on a deep red it is white, and using the body text would put
  // white on a mid-tone red at about 3:1.
  colors.destructiveForeground = statusForeground(theme, 'error')

  const syntax = syntaxRoles(theme)

  return {
    id: theme.id,
    family: theme.family,
    familyLabel: theme.familyLabel,
    label: theme.label,
    appearance: theme.appearance,
    description: theme.description,
    colors,
    terminal: {
      // The embedded terminal uses the theme's own canvas rather than a palette of its
      // own. The ANSI colours came from the palette that produced the canvas, so they
      // were chosen against it; a terminal on a different background would be the one
      // surface in the application not lit by the active theme.
      background: theme.colors.background,
      foreground: theme.colors.foreground,
      cursor: theme.cursor,
      selection: theme.selection,
      ...theme.ansi,
    },
    editor: {
      keyword: syntax.keyword,
      string: syntax.string,
      number: syntax.number,
      comment: syntax.comment,
      function: syntax.function,
      variable: syntax.variable,
      type: syntax.type,
      tag: syntax.tag,
      attribute: syntax.attribute,
      operator: syntax.operator,
      heading: syntax.heading,
      link: syntax.link,
      diffAdd: syntax.diffAdd,
      diffDelete: syntax.diffDelete,
      diffHunk: syntax.diffHunk,
      searchMatch: syntax.searchMatch,
    },
    chart: chartSeries(theme),
    provenance: {
      source: theme.provenance.project,
      url: theme.provenance.url,
      license: theme.provenance.license,
    },
  }
}

/** The catalogue, in catalogue order. */
export const builtinThemes: readonly ThemeVariant[] = Object.freeze(catalogue.map(toVariant))

export function themeById(id: string): ThemeVariant | undefined {
  if (!hasTheme(id)) return undefined
  return builtinThemes.find((theme) => theme.id === id)
}

/** The variants of one appearance, which is what a picker for that mode shows. */
export function themesForAppearance(appearance: ThemeAppearance): readonly ThemeVariant[] {
  const ids = new Set(themesByAppearance(appearance).map((theme) => theme.id))
  return builtinThemes.filter((theme) => ids.has(theme.id))
}

/** The families in the catalogue, in catalogue order. */
export function themeFamilies(): { family: string; label: string; themes: ThemeVariant[] }[] {
  const families = new Map<string, { family: string; label: string; themes: ThemeVariant[] }>()
  for (const theme of builtinThemes) {
    const entry = families.get(theme.family) ?? {
      family: theme.family,
      label: theme.familyLabel,
      themes: [],
    }
    entry.themes.push(theme)
    families.set(theme.family, entry)
  }
  return [...families.values()]
}

/**
 * The roles a variant sets, as CSS custom properties.
 *
 * The one place that knows the mapping from a theme's roles to this system's variable
 * names. A provider applies this; nothing else repeats it. The `--terminal-*` and
 * `--editor-*` ramps are presentations of the catalogue's ANSI and syntax data rather
 * than separate roles, which is why they are built here and not in the catalogue.
 */
export function themeCssVariables(theme: ThemeVariant): Record<string, string> {
  const c = theme.colors
  const t = theme.terminal
  const e = theme.editor
  return {
    '--background': c.background,
    '--foreground': c.foreground,
    '--card': c.card,
    '--card-foreground': c.cardForeground,
    '--popover': c.popover,
    '--popover-foreground': c.popoverForeground,
    '--primary': c.primary,
    '--primary-foreground': c.primaryForeground,
    /*
     * The two tokens derived from the primary, and they are here rather than left to
     * `theme.css` because they must follow `--primary` — which this function writes
     * for *any* theme in the catalogue, not just the two defaults `theme.css` carries.
     *
     * `--primary-hover` is a resolved colour, not a `color-mix()`: a uniform hover
     * step cannot be expressed as a mix (see `primaryHover`). Left out, a theme switch
     * would keep the previous theme's hover on the new theme's primary.
     *
     * `--primary-subtle` is a mix over `--primary`, so it would follow on its own —
     * it is written anyway so the pair is applied together and neither is left to
     * depend on which stylesheet happened to load.
     */
    '--primary-hover': primaryHover(c.primary, theme.appearance),
    '--primary-subtle': primarySubtleCss(theme.appearance),
    '--secondary': c.secondary,
    '--secondary-foreground': c.secondaryForeground,
    '--muted': c.muted,
    '--muted-foreground': c.mutedForeground,
    '--accent': c.accent,
    '--accent-foreground': c.accentForeground,
    '--destructive': c.destructive,
    '--destructive-foreground': c.destructiveForeground,
    '--success': c.success,
    '--warning': c.warning,
    '--info': c.info,
    '--border': c.border,
    '--input': c.input,
    '--ring': c.ring,
    '--sidebar': c.sidebar,
    '--sidebar-foreground': c.sidebarForeground,
    '--sidebar-accent': c.sidebarAccent,
    '--sidebar-border': c.sidebarBorder,
    '--sidebar-primary': c.primary,
    '--sidebar-primary-foreground': c.primaryForeground,
    '--sidebar-ring': c.ring,
    '--sidebar-muted-foreground': c.mutedForeground,
    '--surface-sunken': c.muted,
    '--surface-hover': c.accent,
    '--surface-active': c.border,
    '--chrome': c.background,
    '--terminal-background': t.background,
    '--terminal-foreground': t.foreground,
    '--terminal-cursor': t.cursor,
    '--terminal-selection': t.selection,
    '--terminal-ansi-black': t.black,
    '--terminal-ansi-red': t.red,
    '--terminal-ansi-green': t.green,
    '--terminal-ansi-yellow': t.yellow,
    '--terminal-ansi-blue': t.blue,
    '--terminal-ansi-magenta': t.magenta,
    '--terminal-ansi-cyan': t.cyan,
    '--terminal-ansi-white': t.white,
    '--terminal-ansi-bright-black': t.brightBlack,
    '--terminal-ansi-bright-red': t.brightRed,
    '--terminal-ansi-bright-green': t.brightGreen,
    '--terminal-ansi-bright-yellow': t.brightYellow,
    '--terminal-ansi-bright-blue': t.brightBlue,
    '--terminal-ansi-bright-magenta': t.brightMagenta,
    '--terminal-ansi-bright-cyan': t.brightCyan,
    '--terminal-ansi-bright-white': t.brightWhite,
    '--editor-keyword': e.keyword,
    '--editor-string': e.string,
    '--editor-number': e.number,
    '--editor-comment': e.comment,
    '--editor-function': e.function,
    '--editor-variable': e.variable,
    '--editor-type': e.type,
    '--editor-tag': e.tag,
    '--editor-attribute': e.attribute,
    '--editor-operator': e.operator,
    '--editor-heading': e.heading,
    '--editor-link': e.link,
    '--editor-diff-add': e.diffAdd,
    '--editor-diff-delete': e.diffDelete,
    '--editor-diff-hunk': e.diffHunk,
    '--editor-search-match': e.searchMatch,
    '--chart-1': theme.chart[0] ?? c.primary,
    '--chart-2': theme.chart[1] ?? c.info,
    '--chart-3': theme.chart[2] ?? c.success,
    '--chart-4': theme.chart[3] ?? c.warning,
    '--chart-5': theme.chart[4] ?? c.destructive,
    '--chart-6': theme.chart[5] ?? c.mutedForeground,
  }
}

/* ---------------------------------------------------------------------------
 * Validation
 *
 * Delegated. The floors are the catalogue's, because they are what makes the
 * catalogue able to hold other people's palettes at all, and a second set of floors
 * here would be a second answer to the same question — and the one that drifts.
 * ------------------------------------------------------------------------- */

export type ThemeFinding = {
  themeId: string
  role: string
  message: string
}

function toFinding(finding: ContrastFinding): ThemeFinding {
  return { themeId: finding.themeId, role: finding.role, message: finding.message }
}

/** Validates one variant. The floors, and the reasoning behind them, live in the catalogue. */
export function validateTheme(theme: ThemeVariant): ThemeFinding[] {
  const record = catalogue.find((entry) => entry.id === theme.id)
  if (!record) {
    return [{ themeId: theme.id, role: 'id', message: `${theme.id} is not in the catalogue` }]
  }
  return validateCatalogue([record]).map(toFinding)
}

/** Validates the whole registry, including the catalogue-level invariants. */
export function validateThemeRegistry(
  themes: readonly ThemeVariant[] = builtinThemes
): ThemeFinding[] {
  const records = themes
    .map((theme) => catalogue.find((entry) => entry.id === theme.id))
    .filter((record): record is AdeaThemeRecord => !!record)

  const orphaned = themes
    .filter((theme) => !hasTheme(theme.id))
    .map((theme) => ({
      themeId: theme.id,
      role: 'id',
      message: `${theme.id} is in the registry but not in the catalogue`,
    }))

  return [...orphaned, ...validateCatalogue(records).map(toFinding)]
}

export const defaultLightThemeId = 'adea-light'
export const defaultDarkThemeId = 'adea-dark'

/** Re-exported so a consumer measuring a colour does not need a second import. */
export { contrastRatio } from '@adea-ai/themes'
