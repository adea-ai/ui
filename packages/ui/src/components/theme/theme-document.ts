import { catalogueThemeEngine } from '#lib/theme-catalogue'
import {
  applyThemeToRootWith,
  themeDocumentTokensWith,
  type ThemeDocumentOptions,
  type ThemeDocumentState,
  type ThemeRoot,
} from './theme-document-core'

export {
  applyWithoutTransitions,
  type ThemeDocumentOptions,
  type ThemeDocumentState,
  type ThemeRoot,
  type TransitionDocument,
} from './theme-document-core'

/**
 * The custom properties a state paints, resolved against the whole catalogue: the
 * variant's roles, with the accent selection laid over them, the pinned terminal
 * palette over that, the surface alpha, then `transformTokens`. See
 * {@link themeDocumentTokensWith} for the rules.
 */
export function themeDocumentTokens(
  state: ThemeDocumentState,
  options: ThemeDocumentOptions = {}
): { tokens: Record<string, string>; accented: boolean } {
  return themeDocumentTokensWith(catalogueThemeEngine, state, options)
}

/**
 * Write a state onto a root and report which custom properties it owns, resolved
 * against the whole catalogue. See {@link applyThemeToRootWith} for the rules.
 */
export function applyThemeToRoot(
  root: ThemeRoot,
  state: ThemeDocumentState,
  options: ThemeDocumentOptions = {},
  previous?: ReadonlySet<string>
): ReadonlySet<string> {
  return applyThemeToRootWith(catalogueThemeEngine, root, state, options, previous)
}
