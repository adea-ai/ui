import { createLazyCatalogue } from './theme-catalogue-source'
import { ThemeProviderCore, type ThemeProviderProps } from './theme-provider-core'

export { loadThemeCatalogue } from './theme-catalogue-source'

/**
 * ThemeProvider, with the theme catalogue out of the start-up path.
 *
 * Same props, same context and same behaviour as `ThemeProvider` for everything the
 * shipped default pair covers: the default light and dark themes, a host's own
 * `themes`, every accent preset and custom colour, the surface axis, fonts and
 * density. Only the 32 other catalogue themes are not in the start-up chunk. The first
 * time the selection (or a preview) names one, or a theme-derived `ansi-*` accent over
 * such a pair, this provider imports the catalogue in a chunk of its own:
 *
 *   - until it arrives the document keeps what is on it (set before first paint by
 *     `themeScript`, painted by the stylesheet under `palette="stylesheet"`), and
 *     `variant()` is the default of the appearance;
 *   - when it arrives the provider re-resolves and paints the stored theme, and
 *     `useTheme().catalogueReady()` turns true;
 *   - a preview of a theme that has not loaded starts the load and shows when it ends.
 *
 * Pair it with `palette="stylesheet"` and `themeScript`: inline palettes of catalogue
 * themes need the catalogue to compute, so under the default `inline` palette every
 * stored theme but the defaults waits for the import.
 *
 * `useTheme().themes` and `allThemes()` list only the default pair until
 * `catalogueReady()`; a picker calls `useTheme().loadCatalogue()` when it mounts.
 */
export function ThemeProvider(props: ThemeProviderProps) {
  // Hoisted: a JSX prop expression is re-evaluated on every read, and this source owns signals.
  const catalogue = createLazyCatalogue()
  return <ThemeProviderCore {...props} catalogue={catalogue} />
}
