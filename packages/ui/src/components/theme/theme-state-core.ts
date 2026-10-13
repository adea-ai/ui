import {
  DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS,
  normalizeAppearanceEditorFontSettings,
  type AppearanceEditorFontSettings,
} from '#lib/appearance-font-settings'
import type { AccentPreset } from '@adea-ai/themes'
import { normalizeCustomAccent, type AccentRoles } from '#lib/accent-roles'
import { stepAppearanceFontSizes, type FontZoomIntent } from '#lib/font-zoom'
import type { ThemeSurface } from '#lib/theme-surface'
import { defaultDarkThemeId, defaultLightThemeId, resolveVariant } from '#lib/theme-defaults'
import type { ThemeEngine } from '#lib/theme-engine'
import type { ThemeAppearance, ThemeVariant } from '#lib/themes'

/**
 * The pure half of the theme provider: what a selection is, how two selections
 * merge, and what a selection resolves to.
 *
 * Nothing here touches the document, storage or a signal, so each rule can be
 * tested by calling it. `ThemeProvider` owns the reactivity and wires these to it;
 * `theme-document.ts` owns the writes; `theme-persistence.ts` owns the store.
 *
 * This is the catalogue-free half: it imports no catalogue code or data, so the lazy
 * provider can use it at start-up. `theme-state.ts` re-exports it and adds
 * {@link accentRolesForState} bound to the full catalogue.
 */

/**
 * Four independent choices, and keeping them independent is the point:
 *
 *   - **appearance** — light, dark, or follow the system.
 *   - **a theme per appearance** — so a user can run Catppuccin Mocha by night and
 *     Solarized Light by day without re-choosing when the system flips.
 *   - **an accent** — adea's six presets, or one of the accents the selected theme
 *     pair carries itself (`ansi-blue`…), which re-colour the interactive roles on
 *     top of whichever theme is active.
 *   - **fonts** — separate family and size choices for UI, content and code.
 */
export type ThemeSelection = {
  /** `system` follows `prefers-color-scheme` and updates when it changes. */
  appearance: ThemeAppearance | 'system'
  /** The variant to use when the resolved appearance is light. */
  lightThemeId: string
  /** The variant to use when the resolved appearance is dark. */
  darkThemeId: string
  /**
   * An `accentPresets` id, a theme accent id from `themeAccents()` (`ansi-blue`…),
   * `theme` for the variant's own primary, or a custom colour as `#rrggbb`. A theme
   * accent the current pair does not offer falls back to the variant's own primary.
   *
   * A custom colour is stored lower case and is raised to the contrast floor when it
   * is painted, never when it is stored: the selection keeps what the user chose.
   * Anything else that is not an id is dropped at paint, not rejected here.
   */
  accent: string
  /** UI-family alias for consumers of the original single-font preference. */
  font: string
  /** UI, content and code font settings. Omitted legacy records are migrated from `font`. */
  fonts?: AppearanceEditorFontSettings
  /**
   * `comfortable` is the system's default geometry; `compact` moves the control
   * ladder down one rung.
   *
   * Optional, and defaulted on read, so a preference stored before density existed
   * keeps working and `ThemeSelection` stays assignable without it.
   */
  density?: ThemeDensity
  /**
   * The terminal either follows the interface theme (`theme`, or absent) or is pinned
   * to another theme's terminal palette by that theme's id. The pin is written over
   * the interface variant's own `--terminal-*` properties, so a light interface can
   * carry a dark terminal.
   *
   * An id the registry does not hold paints the interface palette and stays in the
   * selection, the same rule as an unknown theme id.
   *
   * Optional and not defaulted: see {@link defaultThemeSelection}.
   */
  terminalThemeId?: string
  /**
   * How opaque elevated panels are. Written to `<html>` only when the provider's
   * `surface` prop is on or this is set; absent, a host paints no surface axis at
   * all. Resolved against the OS and the host's capability before it is painted —
   * see `resolveSurface` — so the value stored is a preference, never the outcome.
   */
  surface?: ThemeSurface
  /**
   * The user's own Reduce Transparency switch, which forces the `opaque` surface the
   * same way the operating system's setting does.
   */
  reduceTransparency?: boolean
}

/**
 * The two density rungs.
 *
 * `comfortable` is the geometry in `theme.css`, so it is the absence of an
 * attribute rather than a value: a document that ships no `data-density` at all
 * renders correctly, which is what keeps this additive.
 */
export type ThemeDensity = 'comfortable' | 'compact'

/**
 * Deliberately lists only the fields every consumer has always had. A field added
 * to {@link ThemeSelection} later gets no default here: `JSON.stringify` drops an
 * `undefined`, so a store written by a consumer that never sets the field stays
 * byte-identical to what it was before the field existed.
 */
export const defaultThemeSelection: ThemeSelection = {
  appearance: 'system',
  lightThemeId: defaultLightThemeId,
  darkThemeId: defaultDarkThemeId,
  accent: 'theme',
  font: 'system',
  fonts: DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS,
  density: 'comfortable',
}

/**
 * A stored selection's density, defaulted.
 *
 * The stored value is read through here rather than trusted, because a preference
 * written before density existed has no `density` key and a hand-edited store may
 * hold anything.
 */
export function resolvedDensity(selection: ThemeSelection): ThemeDensity {
  return selection.density === 'compact' ? 'compact' : 'comfortable'
}

export type ThemeContextValue = {
  /** The preference as stored. A {@link ThemeContextValue.preview} does not change it. */
  selection: () => ThemeSelection
  /** What the preference resolves to right now, after `system`. */
  resolvedAppearance: () => ThemeAppearance
  /** The variant in use. */
  variant: () => ThemeVariant
  /** Update part of the preference. */
  setSelection: (patch: Partial<ThemeSelection>) => void
  /**
   * The built-in catalogue, so a picker does not import it separately. A plain
   * array: {@link ThemeContextValue.allThemes} is the one that follows a host's
   * extra themes. Under the lazy provider it holds only the default pair until
   * {@link ThemeContextValue.catalogueReady}; read it again afterwards.
   */
  themes: readonly ThemeVariant[]
  /**
   * The accents the selected light/dark pair carries, offered beside the presets.
   * Follows the selection: a different theme pair may offer different slots.
   */
  themeAccents: () => readonly AccentPreset[]
  /**
   * The built-in catalogue followed by the provider's `themes` prop. Reactive when
   * that prop is a function that reads signals.
   */
  allThemes: () => readonly ThemeVariant[]
  /**
   * Paint the document from `draft` laid over the stored selection, without
   * persisting it or changing what {@link ThemeContextValue.selection} returns.
   * `undefined` ends the preview. A {@link ThemeContextValue.setSelection} ends it
   * too, because the committed selection is then what should be showing.
   */
  preview: (draft: Partial<ThemeSelection> | undefined) => void
  /** True while a {@link ThemeContextValue.preview} draft is on the document. */
  previewing: () => boolean
  /**
   * The roles `accent` paints over `variantId` (default: the variant in use), held
   * to the provider's `accentContrastFloor`, for an element-scoped override with
   * `paintAccentRoles` — a workspace that carries its own colour. `undefined` for
   * `null`, for `theme`, for an id that resolves to nothing, and for a variant the
   * registry does not hold: each means "keep the inherited accent".
   */
  accentRolesFor: (accent: string | null, variantId?: string) => AccentRoles | undefined
  /**
   * The surface the committed selection paints, after Reduce Transparency and the
   * host's translucency capability. `opaque` when the axis is off. Follows the
   * committed selection, not a preview, like {@link ThemeContextValue.variant}.
   */
  effectiveSurface: () => ThemeSurface
  /**
   * True while the operating system or the selection's `reduceTransparency` forces
   * opaque surfaces. Always false when the surface axis is off, because nothing is
   * then listening to the operating system.
   */
  reduceTransparencyActive: () => boolean
  /**
   * Step the three text sizes together, or put them back to the defaults: what the
   * `fontZoom` prop's chords do, for a host that binds its own keys or a menu. Goes
   * through {@link ThemeContextValue.setSelection}, so it persists and ends a preview.
   */
  zoomFonts: (intent: FontZoomIntent) => void
  /**
   * True when `themes`, `allThemes()` and the variants they resolve are backed by the
   * whole catalogue. Always true under `ThemeProvider`. Under the lazy provider
   * (`@adea-ai/ui/components/theme/lazy`) it turns true once the catalogue has loaded,
   * and until then only the default light and dark themes are available: a stored
   * theme beyond them resolves to its appearance's default (the document keeps painting
   * what the stylesheet gave it) until `catalogueReady()` is true. Absent on a context
   * a host builds itself, where it should be read as true.
   */
  catalogueReady?: () => boolean
  /**
   * Start loading the whole catalogue (idempotent) and resolve when it is available.
   * A picker, a preview or a settings page calls it when it mounts. A no-op under
   * `ThemeProvider`, whose catalogue is already loaded.
   */
  loadCatalogue?: () => Promise<void>
}

/** A selection with the `undefined` keys of a patch left out. */
function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>
}

/** Keep the deprecated single-font view synchronized with the UI axis. */
export function mergeThemeSelection(
  base: ThemeSelection,
  patch: Partial<ThemeSelection>
): ThemeSelection {
  const merged = { ...base, ...patch }
  let fonts: AppearanceEditorFontSettings

  if (patch.fonts !== undefined) {
    fonts = normalizeAppearanceEditorFontSettings(patch.fonts).settings
  } else if (patch.font !== undefined) {
    const currentFonts = normalizeAppearanceEditorFontSettings(base.fonts, base.font).settings
    fonts = normalizeAppearanceEditorFontSettings({
      ...currentFonts,
      ui: { ...currentFonts.ui, family: patch.font },
    }).settings
  } else {
    fonts = normalizeAppearanceEditorFontSettings(merged.fonts, merged.font).settings
  }

  return {
    ...merged,
    // One spelling for a custom colour, so equal choices compare and store equal.
    accent: normalizeCustomAccent(merged.accent) ?? merged.accent,
    fonts,
    font: fonts.ui.family,
  }
}

/**
 * The selection a provider starts from: the defaults, then whatever the store
 * returned, then `initial`.
 *
 * `initial` wins over the store on every mount. That precedence is part of the
 * contract Cortana relies on (its `initial` pins `appearance` and `font`), and it
 * is why the store's answer is only the middle layer. A store that returned
 * nothing, or threw, or answered with explicit `undefined`s, leaves the defaults
 * standing for those fields.
 */
export function initialThemeSelection(
  stored: Partial<ThemeSelection> | undefined,
  initial: Partial<ThemeSelection> | undefined
): ThemeSelection {
  const base = mergeThemeSelection(defaultThemeSelection, definedOnly(stored ?? {}))
  return mergeThemeSelection(base, initial ?? {})
}

/** `system` resolved against what the operating system reports. */
export function resolveAppearance(
  preference: ThemeSelection['appearance'],
  system: ThemeAppearance
): ThemeAppearance {
  return preference === 'system' ? system : preference
}

/** The theme id the selection names for a resolved appearance. */
export function selectedThemeId(selection: ThemeSelection, appearance: ThemeAppearance): string {
  return appearance === 'dark' ? selection.darkThemeId : selection.lightThemeId
}

/**
 * What a selection paints: the resolved appearance and the variant for it.
 *
 * An id the registry does not hold resolves to the appearance's default rather than
 * being rewritten (see `resolveVariant`), so the selection a host stores is never
 * changed by being unresolvable.
 */
export function resolveThemeState(
  selection: ThemeSelection,
  system: ThemeAppearance,
  registry: readonly ThemeVariant[]
): { appearance: ThemeAppearance; variant: ThemeVariant } {
  const appearance = resolveAppearance(selection.appearance, system)
  return {
    appearance,
    variant: resolveVariant(registry, selectedThemeId(selection, appearance), appearance),
  }
}

/**
 * The variant whose terminal palette is pinned, or `undefined` when the terminal
 * follows the interface theme.
 *
 * `theme`, an absent id and an id the registry does not hold all mean the interface
 * palette: a terminal must never resolve to a blank or half-painted palette because a
 * theme was deleted after it was pinned.
 */
export function resolveTerminalVariant(
  terminalThemeId: string | undefined,
  registry: readonly ThemeVariant[]
): ThemeVariant | undefined {
  if (terminalThemeId === undefined || terminalThemeId === 'theme') return undefined
  return registry.find((candidate) => candidate.id === terminalThemeId)
}

/**
 * The font settings a zoom chord asks for: one pixel up or down on every axis, or
 * the defaults for `reset`.
 */
export function zoomedFontSettings(
  selection: ThemeSelection,
  intent: FontZoomIntent
): AppearanceEditorFontSettings {
  if (intent === 'reset') return { ...DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS }
  return stepAppearanceFontSizes(selection.fonts, intent === 'in' ? 1 : -1)
}

/**
 * The registry a provider resolves against: the catalogue, then the host's extras.
 *
 * The catalogue wins an id collision, because it is listed first and `resolveVariant`
 * takes the first match: a host's variant can add a theme but cannot shadow one.
 */
export function mergeRegistry(
  builtin: readonly ThemeVariant[],
  extra: readonly ThemeVariant[] | undefined
): readonly ThemeVariant[] {
  return extra && extra.length > 0 ? [...builtin, ...extra] : builtin
}

/**
 * The roles an accent paints over a variant, for {@link ThemeContextValue.accentRolesFor}.
 *
 * Resolved against the committed selection's theme pair, so an `ansi-*` accent means
 * the same colour here as it does on `<html>`. `engine` answers the catalogue
 * questions; `theme-state.ts` binds the full catalogue for callers that have none.
 */
export function accentRolesForStateWith(
  engine: Pick<ThemeEngine, 'accentRolesForSelection'>,
  accent: string | null,
  variantId: string | undefined,
  state: {
    selection: ThemeSelection
    variant: ThemeVariant
    registry: readonly ThemeVariant[]
    accentContrastFloor?: number
  }
): AccentRoles | undefined {
  if (accent === null) return undefined
  const variant =
    variantId === undefined
      ? state.variant
      : state.registry.find((candidate) => candidate.id === variantId)
  if (!variant) return undefined
  return engine.accentRolesForSelection(accent, variant.appearance, state.selection, {
    background: variant.colors.background,
    floor: state.accentContrastFloor,
    variantId: variant.id,
  })
}
