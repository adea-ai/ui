/**
 * The accents a theme carries, beside the six presets.
 *
 * `@adea-ai/themes` offers two kinds of accent. The presets (`ACCENTS`) are brand
 * colours, the same six on every theme. Since 0.9 the catalogue also offers the
 * accent-shaped colours a theme carries itself — its ANSI blue, magenta, cyan and
 * green, paired across a light and a dark theme and kept only when they clear the
 * catalogue's accent floors — through `themeAccentPresets`. Those read as part of
 * the palette rather than as visitors on it, which is why they are offered here.
 *
 * Their ids are role-shaped (`ansi-blue`), not value-shaped: a stored theme accent
 * survives switching themes and resolves to the *new* theme's blue. That has one
 * consequence a consumer must handle, and this module is where it is handled once:
 * a stored theme accent may name a slot the current pair does not offer, and then
 * it resolves to nothing and the theme's own primary applies — the same fallback a
 * stale preset id gets.
 *
 * This module imports no catalogue: it works on whatever theme records it is
 * given, so the appearance editor can use it without loading every palette.
 */
import {
  ANSI_KEYS,
  getAccent,
  themeAccentPresets,
  type AccentPreset,
  type AdeaTheme,
} from '@adea-ai/themes'

/** The prefix the catalogue gives every theme-derived accent id. */
const THEME_ACCENT_PREFIX = 'ansi-'

const THEME_ACCENT_IDS: ReadonlySet<string> = new Set(
  ANSI_KEYS.map((key) => `${THEME_ACCENT_PREFIX}${key}`)
)

/**
 * Whether an id names a theme-derived accent slot.
 *
 * Deliberately wider than what any one pair offers: the id is valid to *store*
 * whenever it names a slot, because the next theme may offer it even if this one
 * does not. Whether it resolves is {@link resolveAccentPreset}'s question.
 */
export function isThemeAccentId(id: string): boolean {
  return THEME_ACCENT_IDS.has(id)
}

/**
 * An accent id resolved against a theme pair: a preset, a theme accent the pair
 * offers, or `undefined` for `theme`, an unknown id, or a slot this pair cannot
 * offer — each of which means "use the theme's own primary".
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
