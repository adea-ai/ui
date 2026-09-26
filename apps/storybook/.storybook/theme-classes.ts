import { builtinThemes } from '@adea-ai/ui/lib/themes'

/**
 * The `theme` global's value → the class `addon-themes` applies.
 *
 * This is small enough to live in `preview.tsx`, and it did — but it is the one
 * piece of workshop configuration that can crash the preview at render time, so it
 * is separated to be testable. `tests/unit/preview-config.test.ts` pins it.
 *
 * ## Why it must cover every id
 *
 * `withThemeByClassName` does two things with the object it is given: it registers
 * the `theme` global from `Object.keys(themes)`, and at render time it looks the
 * *selected* id up here and splits the result into classes:
 *
 * ```js
 * let newThemeClasses = classStringToArray(themes[selectedThemeName])
 * // classStringToArray = (s) => s.split(' ')   ← undefined.split throws
 * ```
 *
 * So a map that does not cover every id the global can hold throws
 * `Cannot read properties of undefined (reading 'split')` **the moment someone picks
 * the missing one** — the story renders as an error instead of a component, and the
 * message names neither the theme nor this file. It was a hand-written
 * `{ light: 'light', dark: 'dark' }` until a catalogue of 27 met it.
 *
 * Deriving it from the catalogue is what makes that impossible rather than unlikely:
 * a theme added to `@adea-ai/themes` is in this map by construction, and the test
 * fails loudly if the derivation is ever replaced by a literal. The two aliases below
 * cover the other vocabulary a caller writes by hand.
 *
 * ## Why the value is the appearance
 *
 * The addon's job here is Storybook's own chrome, which knows two states — the
 * `dark` class on the docs container and the manager. The *variant* is applied by
 * the library's `ThemeProvider` in `withWorkshopTheme`, which is the real mechanism.
 * So the value is `light`/`dark`, not the variant id, and every theme in a family
 * maps to the appearance it declares.
 */
export const themeClasses: Record<string, string> = {
  ...Object.fromEntries(builtinThemes.map((theme) => [theme.id, theme.appearance])),
  /**
   * The two conventional aliases, which are not catalogue ids and are exactly what
   * someone writes by hand.
   *
   * They are here because the failure this map exists to prevent is not limited to
   * the toolbar: a `globals=theme:dark` in a URL — which the interaction lane uses —
   * reaches the same lookup, and an id that is missing from the map throws the same
   * `Cannot read properties of undefined (reading 'split')`.
   *
   * That happened. Deriving the map from the catalogue fixed the toolbar and broke
   * the interaction lane in the same commit, because the lane had been passing the
   * bare `dark` that the *old* two-entry map happened to accept. The map therefore
   * has to cover both vocabularies, not just the one the toolbar offers.
   */
  light: 'light',
  dark: 'dark',
}
