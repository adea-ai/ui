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
 * This module holds only the id test, and reads only the schema entry: the
 * appearance editor uses it, and the editor's packed renderer gate forbids the
 * catalogue and normalization modules that *computing* a theme accent needs
 * (`themeAccentPresets` measures through `normalize.js`). Resolution lives in
 * `lib/themes.ts`, beside the catalogue it reads.
 */
import { ANSI_KEYS } from '@adea-ai/themes/schema'

/** The prefix the catalogue gives every theme-derived accent id. */
const THEME_ACCENT_PREFIX = 'ansi-'

/**
 * Whether an id names a theme-derived accent slot.
 *
 * Deliberately wider than what any one pair offers: the id is valid to *store*
 * whenever it names a slot, because the next theme may offer it even if this one
 * does not. Whether it resolves is `resolveAccentPreset`'s question.
 */
export function isThemeAccentId(id: string): boolean {
  // Computed per call rather than held in a module-level set: a top-level
  // `new Set(...)` is a statement a bundler cannot prove pure, and it would keep
  // this module in every bundle that touches the root entry.
  return (
    id.startsWith(THEME_ACCENT_PREFIX) &&
    (ANSI_KEYS as readonly string[]).includes(id.slice(THEME_ACCENT_PREFIX.length))
  )
}
