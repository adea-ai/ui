import { catalogueThemeEngine } from '../../lib/theme-catalogue'
import type { AccentRoles } from '../../lib/accent-roles'
import type { ThemeVariant } from '../../lib/themes'
import { accentRolesForStateWith, type ThemeSelection } from './theme-state-core'

export * from './theme-state-core'

/**
 * The roles an accent paints over a variant, for `ThemeContextValue.accentRolesFor`,
 * resolved against the whole catalogue.
 *
 * Resolved against the committed selection's theme pair, so an `ansi-*` accent means
 * the same colour here as it does on `<html>`. The lazy provider uses
 * {@link accentRolesForStateWith} with the engine it has.
 */
export function accentRolesForState(
  accent: string | null,
  variantId: string | undefined,
  state: {
    selection: ThemeSelection
    variant: ThemeVariant
    registry: readonly ThemeVariant[]
    accentContrastFloor?: number
  }
): AccentRoles | undefined {
  return accentRolesForStateWith(catalogueThemeEngine, accent, variantId, state)
}
