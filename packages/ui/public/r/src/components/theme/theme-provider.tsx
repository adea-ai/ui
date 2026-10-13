import { catalogueThemeEngine } from '../../lib/theme-catalogue'
import {
  ThemeProviderCore,
  type ThemeCatalogueSource,
  type ThemeProviderProps,
} from './theme-provider-core'

export { useOptionalTheme, useTheme } from './theme-context'
export {
  createVersionedPersistence,
  localStoragePersistence,
  type ThemePersistence,
  type ThemeStorageSchema,
  type VersionedCodec,
  type VersionedPersistenceOptions,
} from './theme-persistence'
export type { ThemeSurface } from '../../lib/theme-surface'
export type { EditorRolesMode } from '../../lib/themes'
export type { ThemeProviderProps } from './theme-provider-core'
export { inlineScriptLiteral, themeScript, type ThemeScriptOptions } from './theme-script'
export {
  defaultThemeSelection,
  resolvedDensity,
  type ThemeContextValue,
  type ThemeDensity,
  type ThemeSelection,
} from './theme-state-core'

/** The whole catalogue, already imported: nothing to load, nothing to wait for. */
const eagerCatalogue: ThemeCatalogueSource = {
  engine: () => catalogueThemeEngine,
  loaded: () => true,
  failed: () => false,
  load: () => Promise.resolve(),
}

/**
 * ThemeProvider.
 *
 * Owns the appearance preference and applies it to the document. One provider near
 * the root; everything below reads it. See {@link ThemeProviderProps} for the
 * options, and `ThemeProviderCore` for how a selection is resolved and applied.
 *
 * This provider imports the whole theme catalogue (about 129 KB raw, 34 KB gzipped)
 * so that `useTheme().themes` is a complete array on the first render. A host that
 * paints its theme from a stylesheet (`palette="stylesheet"`), keeps the default
 * pair, and wants the catalogue out of its start-up chunk imports the lazy provider
 * from `@adea-ai/ui/components/theme/lazy` instead; the props are the same.
 */
export function ThemeProvider(props: ThemeProviderProps) {
  return <ThemeProviderCore {...props} catalogue={eagerCatalogue} />
}
