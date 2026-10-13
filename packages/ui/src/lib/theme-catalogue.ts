/**
 * The full theme engine, backed by the whole catalogue.
 *
 * This is the module a provider loads when it needs more than the default pair — and,
 * for `ThemeProvider`, always. It imports `lib/themes` (which imports the catalogue)
 * and nothing imports it statically except the eager provider, so a bundler can put
 * it, and the catalogue behind it, in a chunk of its own for the lazy provider.
 */
import {
  accentRolesForSelection,
  accentVariables,
  builtinThemes,
  isCatalogueVariant,
  themeAccentsFor,
  themeCssVariables,
} from './themes'
import type { ThemeEngine } from './theme-engine'

export const catalogueThemeEngine: ThemeEngine = {
  builtinThemes,
  isCatalogueVariant,
  themeCssVariables,
  accentVariables,
  accentRolesForSelection,
  themeAccentsFor,
}
