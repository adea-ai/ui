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
 * The package-owned `shadcnVariables` adapter maps canonical roles onto this
 * system's vocabulary. One entry will trip a reader: the catalogue's `accent`
 * becomes this system's `primary`, because in the shadcn vocabulary `--primary` is
 * the action colour — the fill of a primary button, the thing a focus ring is drawn
 * in — while `--accent` is a low-contrast hover wash. The catalogue's `accent` is
 * the former, so it goes to `--primary`, and `--accent` is filled from
 * `surfaceHover`, which is what shadcn components actually use it for.
 */

import {
  ACCENTS,
  accentForeground,
  chartSeries,
  getAccent,
  getTheme,
  hasTheme,
  shadcnDestructiveProjection,
  statusForeground,
  tint,
  primaryHover,
  primarySubtleCss,
  syntaxRoles,
  themes as catalogue,
  themesByAppearance,
  themeAccentPresets,
  validateCatalogue,
  type AccentPreset,
  type AdeaTheme,
  type AdeaThemeRecord,
  type ContrastFinding,
} from '@adea-ai/themes'
import { shadcnVariables } from '@adea-ai/themes/adapters/shadcn'
import { oklchToHex, parseColor } from '@adea-ai/themes/oklch'
import { accentOverrideVariables, resolveAccentRoles, type AccentRoles } from './accent-roles'
import { isThemeAccentId } from './theme-accents'

export { isThemeAccentId } from './theme-accents'

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
  destructiveSubtle: string
  /** Contrast-safe solid-action presentation, derived from the canonical error role. */
  destructiveAction: string
  destructiveActionForeground: string
  success: string
  successForeground: string
  successSubtle: string
  warning: string
  warningForeground: string
  warningSubtle: string
  info: string
  infoForeground: string
  infoSubtle: string
  border: string
  input: string
  ring: string
  sidebar: string
  sidebarForeground: string
  sidebarAccent: string
  sidebarBorder: string
  sidebarMutedForeground: string
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
  /**
   * Custom properties written verbatim over {@link themeCssVariables}, last.
   *
   * For a variant a host built from data it does not control the derivation of —
   * an imported theme whose painted colours must stay exactly what the user
   * imported. The catalogue's own variants never carry it, so the derived roles
   * stay the only source of truth for them.
   */
  tokens?: Readonly<Record<string, string>>
}

/**
 * The shadcn-vocabulary roles of one catalogue entry.
 *
 * The expensive half of a variant: `shadcnVariables` projects the whole palette
 * (about 4 ms a theme), which is why {@link lazyVariant} defers it.
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
 * {@link lazyVariant} instead.
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
function lazyVariant(theme: AdeaThemeRecord): ThemeVariant {
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

/**
 * A variant's `--primary-subtle`: the tint over `var(--primary)` at the strength its
 * catalogue record measures (`primarySubtleAlpha`). A variant that is not in the
 * catalogue has nothing to measure, and gets its appearance's ceiling.
 */
export function primarySubtleFor(theme: Pick<ThemeVariant, 'id' | 'appearance'>): string {
  const record = getTheme(theme.id)
  return record ? primarySubtleCss(record) : primarySubtleCss(theme.appearance)
}

/** The catalogue, in catalogue order. */
export const builtinThemes: readonly ThemeVariant[] = Object.freeze(catalogue.map(lazyVariant))

export function themeById(id: string): ThemeVariant | undefined {
  if (!hasTheme(id)) return undefined
  return builtinThemes.find((theme) => theme.id === id)
}

/**
 * The variant a stored id means, or the default of the same appearance.
 *
 * An id the registry does not hold — an imported theme that was deleted, a
 * catalogue entry that was renamed — must still paint *something of the appearance
 * being shown*. Falling back to whichever variant happens to be first in the
 * registry painted a dark palette under a light `color-scheme` for a light id, so
 * the fallback is the appearance's own default, then any variant of that
 * appearance, then the registry's first entry only when it holds nothing else.
 *
 * `registry` is the builtin catalogue plus whatever extras the host supplies; the
 * stored id is never rewritten, only resolved, so a host that keeps an unknown id
 * keeps resolving it if the theme comes back.
 *
 * The fallback order is translated from Zeron's `ThemeRegistry::resolve` (MIT,
 * Copyright (c) 2026 Wing); see NOTICE.
 */
export function resolveVariant(
  registry: readonly ThemeVariant[],
  id: string,
  appearance: ThemeAppearance
): ThemeVariant {
  const found = registry.find((variant) => variant.id === id)
  if (found) return found
  const defaultId = appearance === 'dark' ? defaultDarkThemeId : defaultLightThemeId
  return (
    registry.find((variant) => variant.id === defaultId) ??
    registry.find((variant) => variant.appearance === appearance) ??
    registry[0]!
  )
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

/** The accent presets, in the order a picker should show them. */
export const accents = ACCENTS

/**
 * The canonical catalogue records, in catalogue order.
 *
 * {@link builtinThemes} is this system's projection of the catalogue onto the
 * shadcn vocabulary, which is what a document is painted with. A *preview* of a
 * theme — the miniatures `AppearanceEditor` and `ThemeMiniature` draw — reads the
 * catalogue's own roles instead (`surfaceActive`, `borderMuted`, `textSubtle`…),
 * several of which the projection folds together. These are those records, so a
 * consumer hands the editor exactly what it takes rather than reconstructing it
 * from the projection.
 */
export const themeRecords: readonly AdeaThemeRecord[] = catalogue

export function themeRecordById(id: string): AdeaThemeRecord | undefined {
  return getTheme(id)
}

/** A light/dark theme pair by id, with the defaults standing in for an unknown id. */
function recordPair(lightThemeId: string, darkThemeId: string) {
  const light = getTheme(lightThemeId) ?? getTheme(defaultLightThemeId)!
  const dark = getTheme(darkThemeId) ?? getTheme(defaultDarkThemeId)!
  return { light, dark }
}

/**
 * The accents the selected light/dark pair carries — offered beside the presets.
 *
 * Computed per pair rather than per theme because a theme accent is a *pair* of
 * values, like a preset: a slot is offered only when both themes can offer it.
 */
export function themeAccentsFor(
  lightThemeId: string,
  darkThemeId: string
): readonly AccentPreset[] {
  const { light, dark } = recordPair(lightThemeId, darkThemeId)
  return themeAccentPresets(light, dark)
}

/**
 * An accent id resolved against a theme pair: a preset, a theme accent the pair
 * offers, or `undefined` for `theme`, an unknown id, or a slot this pair cannot
 * offer — each of which means "use the theme's own primary".
 *
 * Theme accent ids are role-shaped (`ansi-blue`), so a stored one survives a theme
 * switch and resolves to the new theme's blue; when the new pair cannot offer the
 * slot it resolves to nothing, the same fallback a stale preset id gets.
 */
export function resolveAccentPreset(
  accentId: string,
  light: AdeaTheme,
  dark: AdeaTheme
): AccentPreset | undefined {
  if (accentId === 'theme') return undefined
  const preset = getAccent(accentId)
  if (preset) return preset
  if (!isThemeAccentId(accentId)) return undefined
  return themeAccentPresets(light, dark).find((option) => option.id === accentId)
}

/**
 * A theme with an accent laid over it, in the catalogue's own shape.
 *
 * The accent replaces `accent` and its measured label, which is all an accent
 * changes about a theme; `undefined` returns the theme untouched. This is the
 * overlay a host needs for `AppearanceEditor`'s `lightTheme`/`darkTheme`.
 */
export function withAccent<T extends AdeaTheme>(theme: T, accent: AccentPreset | undefined): T {
  if (!accent) return theme
  const value = theme.appearance === 'dark' ? accent.dark : accent.light
  return {
    ...theme,
    colors: { ...theme.colors, accent: value, accentForeground: accentForeground(value) },
  }
}

/**
 * The two preview themes an appearance selection resolves to, accent applied.
 *
 * The adapter between a stored selection and `AppearanceEditor`: it takes ids —
 * what a preference holds — and returns the canonical records the editor's
 * `lightTheme` and `darkTheme` props take, so a host does not map roles by hand.
 * Unknown ids fall back to the defaults and an accent the pair cannot offer falls
 * back to the theme's own, exactly as `ThemeProvider` resolves them.
 */
export function appearancePreviewThemes(selection: {
  lightThemeId: string
  darkThemeId: string
  accent: string
}): { lightTheme: AdeaThemeRecord; darkTheme: AdeaThemeRecord } {
  const { light, dark } = recordPair(selection.lightThemeId, selection.darkThemeId)
  const accent = resolveAccentPreset(selection.accent, light, dark)
  return { lightTheme: withAccent(light, accent), darkTheme: withAccent(dark, accent) }
}

/**
 * The properties an accent selection overrides, as CSS custom properties.
 *
 * ## Why this exists rather than relying on the `[data-accent]` blocks
 *
 * `theme.css` carries a `[data-accent='…']` block per preset, and those blocks are
 * correct — but they are unreachable at runtime. `ThemeProvider` writes a theme's
 * whole role set onto `<html>` as *inline* custom properties, and an inline
 * declaration outranks any stylesheet selector regardless of specificity. The
 * attribute was set, the rules existed, the values were right, and every one of the
 * seven accents rendered as the same blue.
 *
 * The blocks are kept, because they are what styles the window between the document
 * arriving and the provider mounting — which is the whole reason `themeScript`
 * exists. But the authoritative value has to be applied by the same code that
 * applies the theme, from the same source, or the two can drift again. So both the
 * provider and the CSS generator call `accentRoles` out of `@adea-ai/themes`, and
 * `tests/appearance-axes.test.ts` asserts the two agree value for value.
 *
 * A theme accent (`ansi-blue`) has no block: its value depends on the theme pair,
 * so it is resolved against `pair` — the selection's light and dark theme ids —
 * and only ever applied here. Without a pair it resolves against the defaults.
 *
 * Returns `undefined` for `theme` — the variant's own primary — for an id the
 * catalogue does not have, and for a theme accent the pair does not offer, so a
 * stale stored preference falls back to the theme rather than blanking the primary.
 */
export function accentVariables(
  accentId: string,
  appearance: ThemeAppearance,
  pair: { lightThemeId: string; darkThemeId: string } = {
    lightThemeId: defaultLightThemeId,
    darkThemeId: defaultDarkThemeId,
  },
  options: AccentVariableOptions = {}
): Record<string, string> | undefined {
  const roles = accentRolesForSelection(accentId, appearance, pair, options)
  return roles ? accentOverrideVariables(roles) : undefined
}

/** What an accent is held to when it is resolved against a surface. */
export type AccentVariableOptions = {
  /** The surface the accent must read on: the variant's `colors.background`. */
  background?: string
  /**
   * The contrast floor against `background`. Absent, a preset is painted verbatim
   * and only a custom `#rrggbb` is held to the default floor.
   */
  floor?: number
  /** The variant the accent is applied to, so the tint takes its measured strength. */
  variantId?: string
}

/**
 * An accent selection resolved to the full {@link AccentRoles}, against a theme
 * pair. {@link accentVariables} is the document half of this; an element-scoped
 * paint (`paintAccentRoles`) wants all of it, including the tint.
 */
export function accentRolesForSelection(
  accentId: string,
  appearance: ThemeAppearance,
  pair: { lightThemeId: string; darkThemeId: string } = {
    lightThemeId: defaultLightThemeId,
    darkThemeId: defaultDarkThemeId,
  },
  options: AccentVariableOptions = {}
): AccentRoles | undefined {
  if (accentId === 'theme') return undefined
  const record = options.variantId ? getTheme(options.variantId) : undefined
  return resolveAccentRoles(accentId, {
    target: record ?? appearance,
    background: options.background,
    floor: options.floor,
    // Only an `ansi-*` id needs the pair's offering, and measuring it is not free.
    themeAccents: isThemeAccentId(accentId)
      ? themeAccentsFor(pair.lightThemeId, pair.darkThemeId)
      : undefined,
  })
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
  const derived = {
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
     * `--primary-subtle` is a mix over `--primary`, so it follows an accent on its
     * own, but its *strength* is per theme: `primarySubtleCss(record)` lowers the
     * appearance ceiling only as far as this theme needs for body text to clear 4.5:1
     * on the tint, over every surface, for every accent it offers. It has to be
     * written per theme for that reason — the appearance-wide value is not legible on
     * every palette.
     */
    '--primary-hover': primaryHover(c.primary, theme.appearance),
    '--primary-subtle': primarySubtleFor(theme),
    '--secondary': c.secondary,
    '--secondary-foreground': c.secondaryForeground,
    '--muted': c.muted,
    '--muted-foreground': c.mutedForeground,
    '--accent': c.accent,
    '--accent-foreground': c.accentForeground,
    '--destructive': c.destructive,
    '--destructive-foreground': c.destructiveForeground,
    '--destructive-subtle': c.destructiveSubtle,
    '--destructive-action': c.destructiveAction,
    '--destructive-action-foreground': c.destructiveActionForeground,
    '--success': c.success,
    '--success-foreground': c.successForeground,
    '--success-subtle': c.successSubtle,
    '--warning': c.warning,
    '--warning-foreground': c.warningForeground,
    '--warning-subtle': c.warningSubtle,
    '--info': c.info,
    '--info-foreground': c.infoForeground,
    '--info-subtle': c.infoSubtle,
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
    '--sidebar-muted-foreground': c.sidebarMutedForeground,
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
  return theme.tokens ? { ...derived, ...theme.tokens } : derived
}

/**
 * Token values with every `oklch()` colour written as `#rrggbb`.
 *
 * For a host whose stylesheet, tests or native shell speak hex: the catalogue's
 * roles are `oklch()` strings, and this is the one conversion, gamut-mapped by the
 * catalogue's own `oklchToHex`. A value that is already hex, carries alpha
 * (`rgba()`), or is not a plain colour (`color-mix()`, `var()`) is left byte for
 * byte, because converting would either lose the alpha or be a guess. Suitable as
 * `ThemeProvider`'s `transformTokens`.
 */
export function tokensAsHex(tokens: Readonly<Record<string, string>>): Record<string, string> {
  const converted: Record<string, string> = {}
  for (const [name, value] of Object.entries(tokens)) {
    const trimmed = value.trim()
    // `parseOklch` discards alpha, so a translucent oklch() stays as written.
    const opaque = trimmed.startsWith('oklch(') && !trimmed.includes('/')
    const parsed = opaque ? parseColor(trimmed) : undefined
    converted[name] = parsed ? oklchToHex(parsed) : value
  }
  return converted
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
