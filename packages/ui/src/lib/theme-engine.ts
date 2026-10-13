/**
 * The catalogue-dependent operations a provider performs, as one seam.
 *
 * `ThemeProvider` needs to ask a handful of questions that only the catalogue can
 * answer in general: the built-in variants, a variant's custom properties, the roles
 * an accent paints over it, the accents a theme pair offers. Two engines answer them.
 *
 *   - {@link catalogueThemeEngine} (`lib/theme-catalogue`) is the full answer, backed by
 *     the whole catalogue. It is what `ThemeProvider` uses and what the lazy provider
 *     switches to once the catalogue has loaded.
 *   - {@link lightThemeEngine} (`lib/theme-engine-light`) answers from the data that ships with the
 *     provider (`theme-defaults`): the default light/dark pair, host variants that are
 *     not in the catalogue, and nothing else. It imports no catalogue data, which is
 *     the point: a host that keeps the default pair never pays for the other 32
 *     themes. A question outside that set throws {@link CatalogueRequired}; the lazy
 *     provider asks {@link needsCatalogue} first and loads the catalogue instead.
 *
 * `tests/theme-engine.test.ts` holds the two to the same answers wherever the light
 * engine can answer.
 */
import type { AccentPreset } from '@adea-ai/themes'
import type { AccentRoles } from './accent-roles'
import { isThemeAccentId } from './theme-accents'
import {
  defaultDarkThemeId,
  defaultLightThemeId,
  isCatalogueThemeId,
  isDefaultThemeId,
} from './theme-defaults'
import type {
  AccentVariableOptions,
  ThemeAppearance,
  ThemeCssVariableOptions,
  ThemeVariant,
} from './themes'

export type ThemeEngine = {
  /** The built-in variants. A plain array, in catalogue order. */
  readonly builtinThemes: readonly ThemeVariant[]
  /** True for the catalogue's own variant, not a host's copy that merely shares its id. */
  isCatalogueVariant(variant: ThemeVariant): boolean
  /** The custom properties a variant sets. */
  themeCssVariables(
    variant: ThemeVariant,
    options?: ThemeCssVariableOptions
  ): Record<string, string>
  /**
   * The custom properties an accent selection overrides on the document (`--primary`, its
   * foreground, hover and ring), or `undefined` when it overrides nothing.
   */
  accentVariables(
    accentId: string,
    appearance: ThemeAppearance,
    pair: { lightThemeId: string; darkThemeId: string },
    options?: AccentVariableOptions
  ): Record<string, string> | undefined
  /** An accent selection resolved to its full roles against a theme pair, or `undefined`. */
  accentRolesForSelection(
    accentId: string,
    appearance: ThemeAppearance,
    pair: { lightThemeId: string; darkThemeId: string },
    options?: AccentVariableOptions
  ): AccentRoles | undefined
  /** The accents a light/dark pair offers beside the presets. */
  themeAccentsFor(lightThemeId: string, darkThemeId: string): readonly AccentPreset[]
}

/** Thrown by the light engine for a question that needs the whole catalogue. */
export class CatalogueRequired extends Error {
  constructor(what: string) {
    super(`${what} needs the theme catalogue, which has not been loaded`)
    this.name = 'CatalogueRequired'
  }
}

/** The ids an id resolves to when the catalogue lacks it, as `getTheme ?? default` does. */
export function pairIds(lightThemeId: string, darkThemeId: string): [string, string] {
  return [
    isCatalogueThemeId(lightThemeId) ? lightThemeId : defaultLightThemeId,
    isCatalogueThemeId(darkThemeId) ? darkThemeId : defaultDarkThemeId,
  ]
}

/** A catalogue id other than the two defaults: its data is not in the light engine. */
export const needsData = (id: string) => isCatalogueThemeId(id) && !isDefaultThemeId(id)

/**
 * Whether answering for this selection needs the catalogue.
 *
 * True when the variant being shown, the pinned terminal theme, or (for a
 * theme-derived `ansi-*` accent) either theme of the pair is a catalogue theme other
 * than the two defaults. Everything else — the default pair, a host's own variants,
 * every preset and custom accent — the light engine answers from shipped data.
 */
export function needsCatalogue(
  selection: {
    lightThemeId: string
    darkThemeId: string
    accent: string
    terminalThemeId?: string
  },
  appearance: ThemeAppearance
): boolean {
  const shown = appearance === 'dark' ? selection.darkThemeId : selection.lightThemeId
  if (needsData(shown)) return true
  if (selection.terminalThemeId !== undefined && needsData(selection.terminalThemeId)) return true
  return (
    isThemeAccentId(selection.accent) &&
    (needsData(selection.lightThemeId) || needsData(selection.darkThemeId))
  )
}
