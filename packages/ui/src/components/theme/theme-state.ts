import {
  DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS,
  normalizeAppearanceEditorFontSettings,
  type AppearanceEditorFontSettings,
} from '#lib/appearance-font-settings'
import type { AccentPreset } from '@adea-ai/themes'
import {
  defaultDarkThemeId,
  defaultLightThemeId,
  resolveVariant,
  type ThemeAppearance,
  type ThemeVariant,
} from '#lib/themes'

/**
 * The pure half of the theme provider: what a selection is, how two selections
 * merge, and what a selection resolves to.
 *
 * Nothing here touches the document, storage or a signal, so each rule can be
 * tested by calling it. `ThemeProvider` owns the reactivity and wires these to it;
 * `theme-document.ts` owns the writes; `theme-persistence.ts` owns the store.
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
   * or `theme` for the variant's own primary. A theme accent the current pair does
   * not offer falls back to the variant's own primary.
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
   * extra themes.
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

  return { ...merged, fonts, font: fonts.ui.family }
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
