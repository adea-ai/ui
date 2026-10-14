/**
 * What a host needs to turn a canonical theme record into the values it stores.
 *
 * Adea imports user themes: a file is validated, repaired toward the readable floor,
 * and projected onto the hex values the host persists. That projection is the
 * catalogue's own (`shadcnVariables`, the xterm adapter, the editor roles), so it is
 * re-exported here and the host depends on this package alone for it — the pin
 * between this package and `@adea-ai/themes` cannot drift from the host's.
 *
 * Its own module, with no catalogue data and no definition of its own beyond the two
 * default records, so that:
 *
 * - a host's start-up path never reaches it (it is for an importer loaded on demand);
 * - `lib/themes.ts`, which holds the 34-theme table, is not the place a host has to
 *   import from to get a record-shaped helper.
 */
import adeaDark from '@adea-ai/themes/themes/adea-dark'
import adeaLight from '@adea-ai/themes/themes/adea-light'
import {
  themeAccentPresets,
  type AccentPreset,
  type AdeaTheme,
  type AdeaThemeRecord,
} from '@adea-ai/themes'

export { editorRolesHex, syntaxRolesHex } from '@adea-ai/themes'
export { oklchToHex, parseColor as parseOklchColor } from '@adea-ai/themes/oklch'
export { shadcnDestructiveProjection, shadcnVariables } from '@adea-ai/themes/adapters/shadcn'
export { toXtermTheme } from '@adea-ai/themes/adapters/xterm'

/**
 * The default theme of an appearance as a canonical record: the roles an imported
 * theme falls back to for anything its file does not carry.
 *
 * `defaultVariantFor` is the same theme as a runtime variant; a record keeps the
 * catalogue's own roles (`surfaceActive`, `textSubtle`, the ANSI ramp) that a variant
 * folds together.
 */
export function defaultThemeRecord(appearance: 'light' | 'dark'): AdeaThemeRecord {
  return appearance === 'dark' ? adeaDark : adeaLight
}

/**
 * The accents a light/dark pair of records carries itself, beside the presets.
 *
 * For a host whose pair is not in the catalogue — an imported theme — where
 * `themeAccentsFor` (which looks the pair up by id) cannot answer. A slot is offered
 * only when both themes clear the catalogue's accent floors.
 */
export function themeAccentsForRecords(light: AdeaTheme, dark: AdeaTheme): readonly AccentPreset[] {
  return themeAccentPresets(light, dark)
}
