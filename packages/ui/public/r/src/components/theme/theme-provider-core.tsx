import { themeContext } from './theme-context'
import {
  createThemeContextValue,
  type ThemeCatalogueSource,
  type ThemeProviderProps,
} from './theme-provider-value'

export type { ThemeCatalogueSource, ThemeProviderProps } from './theme-provider-value'
export {
  createVersionedPersistence,
  localStoragePersistence,
  type ThemePersistence,
  type ThemeStorageSchema,
  type VersionedCodec,
  type VersionedPersistenceOptions,
} from './theme-persistence'
export { useOptionalTheme, useTheme } from './theme-context'
export type { ThemeSurface } from '../../lib/theme-surface'
export type { EditorRolesMode } from '../../lib/themes'
export { inlineScriptLiteral, themeScript, type ThemeScriptOptions } from './theme-script'
export {
  defaultThemeSelection,
  resolvedDensity,
  type ThemeContextValue,
  type ThemeDensity,
  type ThemeSelection,
} from './theme-state-core'

/**
 * The provider, parameterised by where its catalogue comes from.
 *
 * `ThemeProvider` (`theme-provider.tsx`) and the lazy `ThemeProvider`
 * (`theme-provider-lazy.tsx`) are this component with a source; the work is
 * `createThemeContextValue`. It imports no catalogue code or data.
 */
export function ThemeProviderCore(props: ThemeProviderProps & { catalogue: ThemeCatalogueSource }) {
  const value = createThemeContextValue(props)
  const Context = themeContext()
  return <Context.Provider value={value}>{props.children}</Context.Provider>
}
