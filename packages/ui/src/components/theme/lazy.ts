/**
 * The theme provider with the catalogue out of the start-up path.
 *
 * Everything here is free of the 34-theme catalogue: `import` this entry instead of
 * `@adea-ai/ui/components/theme` in a host that paints its theme from a stylesheet.
 * The catalogue loads, in a chunk of its own, the first time a stored or previewed
 * theme needs it. See {@link ThemeProvider} for the rules and `docs/consumption.md`
 * for the setup.
 */
export { loadThemeCatalogue } from './theme-catalogue-source'
export { ThemeProvider } from './theme-provider-lazy'
export {
  createVersionedPersistence,
  defaultThemeSelection,
  inlineScriptLiteral,
  localStoragePersistence,
  resolvedDensity,
  themeScript,
  useOptionalTheme,
  useTheme,
  type EditorRolesMode,
  type ThemeCatalogueSource,
  type ThemeContextValue,
  type ThemeDensity,
  type ThemePersistence,
  type ThemeProviderProps,
  type ThemeScriptOptions,
  type ThemeSelection,
  type ThemeStorageSchema,
  type ThemeSurface,
  type VersionedCodec,
  type VersionedPersistenceOptions,
} from './theme-provider-core'
export { ThemeToggle, type ThemeToggleProps } from './theme-toggle'
export { ThemeModeToggle, type ThemeModeToggleProps } from './theme-mode-toggle'
