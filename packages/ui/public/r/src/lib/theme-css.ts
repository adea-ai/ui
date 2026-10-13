/**
 * The mapping from a variant's roles to this system's custom properties, without the
 * catalogue.
 *
 * `themeCssVariables` needs two things only the catalogue can measure for a theme:
 * the strength of its `--primary-subtle` tint and its floor-projected editor ramp.
 * Those are the `hooks`, so this module imports no catalogue data and a host that
 * never loads the catalogue can still paint a variant it already holds. `lib/themes`
 * binds the hooks to the catalogue and keeps exporting the same
 * `themeCssVariables`; `lib/theme-engine` binds them to the precomputed default pair.
 */
import { primaryHover } from '@adea-ai/themes'
import { oklchToHex, parseColor } from '@adea-ai/themes/oklch'
import type {
  EditorRolesMode,
  ThemeCssVariableOptions,
  ThemeEditorPalette,
  ThemeVariant,
} from './themes'

/** What a variant's custom properties need that depends on the catalogue. */
export type ThemeCssHooks = {
  /** The `--primary-subtle` expression of a variant. */
  primarySubtle(theme: Pick<ThemeVariant, 'id' | 'appearance'>): string
  /** The editor ramp of a variant under a projection. */
  editor(theme: ThemeVariant, mode: EditorRolesMode): ThemeEditorPalette
}

/**
 * The roles a variant sets, as CSS custom properties.
 *
 * The one place that knows the mapping from a theme's roles to this system's variable
 * names. A provider applies this; nothing else repeats it. The `--terminal-*` and
 * `--editor-*` ramps are presentations of the catalogue's ANSI and syntax data rather
 * than separate roles, which is why they are built here and not in the catalogue.
 *
 * `options.editor` picks the `--editor-*` projection ({@link EditorRolesMode}).
 * Absent it, the result is what it has always been; the generated `theme-variants.css`
 * and the design-system artifact are built without it.
 */
export function themeCssVariablesWith(
  hooks: ThemeCssHooks,
  theme: ThemeVariant,
  options: ThemeCssVariableOptions = {}
): Record<string, string> {
  const c = theme.colors
  const t = theme.terminal
  const e = hooks.editor(theme, options.editor ?? 'syntax')
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
    '--primary-subtle': hooks.primarySubtle(theme),
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
    ...terminalVariables(t),
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

function terminalVariables(t: ThemeVariant['terminal']): Record<string, string> {
  return {
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
  }
}

/**
 * The `--terminal-*` properties of a variant: the palette a terminal paints.
 *
 * What a pinned terminal theme writes over the interface variant's own. The names
 * are the ones {@link themeCssVariablesWith} writes, and a custom variant's verbatim
 * `tokens` still win, so they can never drift from what the interface variant would
 * have written for the same palette. Built from the terminal palette alone: it needs
 * neither the catalogue nor the rest of the variant's roles.
 */
export function terminalCssVariables(theme: ThemeVariant): Record<string, string> {
  const properties = terminalVariables(theme.terminal)
  if (!theme.tokens) return properties
  for (const [name, value] of Object.entries(theme.tokens)) {
    if (name.startsWith('--terminal-')) properties[name] = value
  }
  return properties
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
