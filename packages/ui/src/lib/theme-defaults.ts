/**
 * What a provider knows about the catalogue without loading it.
 *
 * The catalogue (`@adea-ai/themes`, 34 themes) is the heavy part of the theme
 * system. Most hosts start on the default pair, paint a catalogue theme from a
 * stylesheet, and open a picker rarely, so this module holds the few facts needed
 * to start without it: the default ids, every catalogue id with its appearance (to
 * recognise a stored preference), and the default pair as complete variants.
 *
 * It imports no catalogue code and no catalogue data. The facts themselves are in
 * `theme-defaults.generated.ts`, copied from the catalogue by
 * `scripts/build-theme-defaults.ts` and checked against it by
 * `tests/theme-defaults.test.ts`.
 */
import type { ThemeAppearance, ThemeVariant } from './themes'
import { DEFAULT_VARIANTS, THEME_INDEX } from './theme-defaults.generated'

export {
  DEFAULT_FLOOR_EDITOR,
  DEFAULT_PRIMARY_SUBTLE,
  DEFAULT_THEME_ACCENTS,
  DEFAULT_VARIANTS,
  THEME_INDEX,
} from './theme-defaults.generated'

export const defaultLightThemeId = 'adea-light'
export const defaultDarkThemeId = 'adea-dark'

/** The appearance of a catalogue theme id, or `undefined` for an id the catalogue lacks. */
export function catalogueThemeAppearance(id: string): ThemeAppearance | undefined {
  return THEME_INDEX.find(([candidate]) => candidate === id)?.[1]
}

/** Whether the catalogue holds a theme with this id (loaded or not). */
export function isCatalogueThemeId(id: string): boolean {
  return catalogueThemeAppearance(id) !== undefined
}

/** Whether an id is one of the two default themes, whose data ships with the provider. */
export function isDefaultThemeId(id: string): id is keyof typeof DEFAULT_VARIANTS {
  return id === defaultLightThemeId || id === defaultDarkThemeId
}

/** The default variant of an appearance. */
export function defaultVariantFor(appearance: ThemeAppearance): ThemeVariant {
  return DEFAULT_VARIANTS[appearance === 'dark' ? defaultDarkThemeId : defaultLightThemeId]
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
