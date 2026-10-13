/**
 * One catalogue record, as this system's {@link ThemeVariant}.
 *
 * `variantFromRecord` and the lazy form the catalogue is built with live here, and not
 * beside the 34-theme table in `lib/themes.ts`, because a bundler places a module
 * whole: a host that imports `variantFromRecord` from the same module as the table
 * ships the table with it. This module reads a record it is handed and imports no
 * catalogue, so a start-up path that only turns a stored record into a variant
 * (an imported theme, a reconstruction) stays small. `lib/themes.ts` re-exports
 * `variantFromRecord`, so `@adea-ai/ui/lib/themes` keeps working; the lazy start-up
 * gate (`check:theme-startup`) holds the split in place.
 *
 * It does import `@adea-ai/themes` for the projection helpers (`chartSeries`,
 * `tint`, `shadcnVariables`…), none of which reads the table of themes.
 */
import {
  chartSeries,
  shadcnDestructiveProjection,
  statusForeground,
  syntaxRoles,
  tint,
  type AdeaThemeRecord,
} from '@adea-ai/themes'
import { shadcnVariables } from '@adea-ai/themes/adapters/shadcn'
import type {
  ThemeColors,
  ThemeEditorPalette,
  ThemeProvenance,
  ThemeTerminalPalette,
  ThemeVariant,
} from './themes'

/**
 * The shadcn-vocabulary roles of one catalogue entry.
 *
 * The expensive half of a variant: `shadcnVariables` projects the whole palette
 * (about 4 ms a theme), which is why {@link lazyVariantFromRecord} defers it.
 */
function colorsOf(theme: AdeaThemeRecord): ThemeColors {
  const projected = shadcnVariables(theme)
  const token = (name: string): string => {
    const value = projected[`--${name}`]
    if (!value) throw new Error(`${theme.id} has no shared shadcn projection for --${name}`)
    return value
  }
  const destructiveAction = shadcnDestructiveProjection(theme)
  return {
    background: token('background'),
    foreground: token('foreground'),
    card: token('card'),
    cardForeground: token('card-foreground'),
    popover: token('popover'),
    popoverForeground: token('popover-foreground'),
    primary: token('primary'),
    primaryForeground: token('primary-foreground'),
    secondary: token('secondary'),
    secondaryForeground: token('secondary-foreground'),
    muted: token('muted'),
    mutedForeground: token('muted-foreground'),
    accent: token('accent'),
    accentForeground: token('accent-foreground'),
    // Preserve the UI's semantic error token. The Themes projection uses its
    // contrast-safe solid-action fill for --destructive; UI keeps that fill in
    // the separate destructiveAction pair below.
    destructive: theme.colors.error,
    destructiveForeground: statusForeground(theme, 'error'),
    destructiveSubtle: tint(theme.colors.error, theme.colors.background),
    destructiveAction: destructiveAction.fill,
    destructiveActionForeground: destructiveAction.foreground,
    success: token('success'),
    successForeground: statusForeground(theme, 'success'),
    successSubtle: tint(theme.colors.success, theme.colors.background),
    warning: token('warning'),
    warningForeground: statusForeground(theme, 'warning'),
    warningSubtle: tint(theme.colors.warning, theme.colors.background),
    info: token('info'),
    infoForeground: statusForeground(theme, 'info'),
    infoSubtle: tint(theme.colors.info, theme.colors.background),
    border: token('border'),
    input: token('input'),
    ring: token('ring'),
    sidebar: token('sidebar'),
    sidebarForeground: token('sidebar-foreground'),
    sidebarAccent: token('sidebar-accent'),
    sidebarBorder: token('sidebar-border'),
    sidebarMutedForeground: token('sidebar-muted-foreground'),
  }
}

// The embedded terminal uses the theme's own canvas rather than a palette of its
// own. The ANSI colours came from the palette that produced the canvas, so they
// were chosen against it; a terminal on a different background would be the one
// surface in the application not lit by the active theme.
function terminalOf(theme: AdeaThemeRecord): ThemeTerminalPalette {
  return {
    background: theme.colors.background,
    foreground: theme.colors.foreground,
    cursor: theme.cursor,
    selection: theme.selection,
    ...theme.ansi,
  }
}

function editorOf(theme: AdeaThemeRecord): ThemeEditorPalette {
  const syntax = syntaxRoles(theme)
  return {
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
  }
}

function provenanceOf(theme: AdeaThemeRecord): ThemeProvenance {
  return {
    source: theme.provenance.project,
    url: theme.provenance.url,
    license: theme.provenance.license,
  }
}

/**
 * The design system's view of one catalogue record, built in full and at once.
 *
 * For a host that holds a record the catalogue does not — an imported theme, a
 * reconstruction from stored data — and wants a variant it can hand to
 * `ThemeProvider`'s `themes`. It throws for a record the shadcn projection cannot
 * map, here and now, rather than on first paint. The catalogue itself goes through
 * {@link lazyVariantFromRecord} instead.
 */
export function variantFromRecord(theme: AdeaThemeRecord): ThemeVariant {
  return {
    id: theme.id,
    family: theme.family,
    familyLabel: theme.familyLabel,
    label: theme.label,
    appearance: theme.appearance,
    description: theme.description,
    colors: colorsOf(theme),
    terminal: terminalOf(theme),
    editor: editorOf(theme),
    chart: chartSeries(theme),
    provenance: provenanceOf(theme),
  }
}

/** Runs `build` on first call and returns that value from then on. A throw is not cached. */
function once<T>(build: () => T): () => T {
  let built = false
  let value: T
  return () => {
    if (!built) {
      value = build()
      built = true
    }
    return value
  }
}

const lazy = <T>(build: () => T): PropertyDescriptor => ({
  get: once(build),
  enumerable: true,
})

/**
 * {@link variantFromRecord} with the four derived palettes built on first read.
 *
 * Evaluating this module used to project all 34 catalogue themes up front, about
 * 155 ms before a single one was needed, on the hydration path of every consumer.
 * A page paints one variant, and a picker's labels and appearance are plain
 * fields, so only a variant whose `colors`, `terminal`, `editor` or `chart` is read
 * pays for them, once. The properties stay enumerable data-shaped accessors, so
 * spreading, `Object.entries` and JSON see the same object they always did.
 */
export function lazyVariantFromRecord(theme: AdeaThemeRecord): ThemeVariant {
  return Object.defineProperties(
    {
      id: theme.id,
      family: theme.family,
      familyLabel: theme.familyLabel,
      label: theme.label,
      appearance: theme.appearance,
      description: theme.description,
      provenance: provenanceOf(theme),
    },
    {
      colors: lazy(() => colorsOf(theme)),
      terminal: lazy(() => terminalOf(theme)),
      editor: lazy(() => editorOf(theme)),
      chart: lazy(() => chartSeries(theme)),
    }
  ) as ThemeVariant
}
