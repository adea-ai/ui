/**
 * The light theme engine: the catalogue questions answered from the data that ships
 * with the provider, with no catalogue code or data (see `lib/theme-engine`).
 */
import type { AccentPreset } from '@adea-ai/themes'
import { primarySubtleCss } from '@adea-ai/themes'
import {
  accentOverrideVariables,
  resolveAccentRoles,
  type AccentRoles,
  type AccentTarget,
} from './accent-roles'
import { isThemeAccentId } from './theme-accents'
import { themeCssVariablesWith } from './theme-css'
import {
  DEFAULT_FLOOR_EDITOR,
  DEFAULT_PRIMARY_SUBTLE,
  DEFAULT_THEME_ACCENTS,
  DEFAULT_VARIANTS,
  defaultDarkThemeId,
  defaultLightThemeId,
  isCatalogueThemeId,
  isDefaultThemeId,
} from './theme-defaults'
import { CatalogueRequired, needsData, pairIds, type ThemeEngine } from './theme-engine'
import type {
  AccentVariableOptions,
  EditorRolesMode,
  ThemeAppearance,
  ThemeVariant,
} from './themes'

const defaultVariantList: readonly ThemeVariant[] = [
  DEFAULT_VARIANTS[defaultLightThemeId],
  DEFAULT_VARIANTS[defaultDarkThemeId],
]

function lightEditor(theme: ThemeVariant, mode: EditorRolesMode) {
  if (mode !== 'floor' || DEFAULT_VARIANTS[theme.id as keyof typeof DEFAULT_VARIANTS] !== theme)
    return theme.editor
  return DEFAULT_FLOOR_EDITOR[theme.id] ?? theme.editor
}

function lightPrimarySubtle(theme: Pick<ThemeVariant, 'id' | 'appearance'>): string {
  const measured = DEFAULT_PRIMARY_SUBTLE[theme.id]
  if (measured) return measured
  if (isCatalogueThemeId(theme.id)) throw new CatalogueRequired(`the tint of ${theme.id}`)
  return primarySubtleCss(theme.appearance)
}

function lightThemeAccentsFor(lightThemeId: string, darkThemeId: string): readonly AccentPreset[] {
  const [light, dark] = pairIds(lightThemeId, darkThemeId)
  if (needsData(light) || needsData(dark))
    throw new CatalogueRequired(`the accents of ${light}/${dark}`)
  return DEFAULT_THEME_ACCENTS
}

export const lightThemeEngine: ThemeEngine = {
  builtinThemes: defaultVariantList,
  isCatalogueVariant: (variant) =>
    isDefaultThemeId(variant.id) && DEFAULT_VARIANTS[variant.id] === variant,
  themeCssVariables(variant, options = {}) {
    if (needsData(variant.id)) throw new CatalogueRequired(`the roles of ${variant.id}`)
    return themeCssVariablesWith(
      { primarySubtle: lightPrimarySubtle, editor: lightEditor },
      variant,
      options
    )
  },
  themeAccentsFor: lightThemeAccentsFor,
  accentVariables(accentId, appearance, pair, options = {}) {
    const roles = lightAccentRoles(accentId, appearance, pair, options)
    return roles ? accentOverrideVariables(roles) : undefined
  },
  accentRolesForSelection(accentId, appearance, pair, options = {}) {
    if (accentId === 'theme') return undefined
    const variantId = options.variantId
    if (variantId !== undefined && needsData(variantId))
      throw new CatalogueRequired(`the accent roles over ${variantId}`)
    const roles = lightAccentRoles(accentId, appearance, pair, options)
    const measured = variantId === undefined ? undefined : DEFAULT_PRIMARY_SUBTLE[variantId]
    if (!roles || measured === undefined) return roles
    // The theme's own tint strength is shipped for the defaults, and is the right one
    // whenever the accent was not repaired. A repaired accent's tint is measured against
    // the repaired primary, which only the catalogue can do.
    const ungated = lightAccentRoles(accentId, appearance, pair, {
      ...options,
      floor: Number.NEGATIVE_INFINITY,
    })
    if (ungated?.primary !== roles.primary)
      throw new CatalogueRequired(`the tint of a repaired accent over ${variantId}`)
    return { ...roles, primarySubtle: measured }
  },
}

/**
 * The accent's roles with the appearance standing in for the theme record. The four
 * document properties depend on the appearance alone; `primarySubtle` reads the record,
 * so callers that return it must correct it.
 */
function lightAccentRoles(
  accentId: string,
  appearance: ThemeAppearance,
  pair: { lightThemeId: string; darkThemeId: string },
  options: AccentVariableOptions
): AccentRoles | undefined {
  if (accentId === 'theme') return undefined
  const context: AccentTarget = {
    target: appearance,
    background: options.background,
    floor: options.floor,
    themeAccents: isThemeAccentId(accentId)
      ? lightThemeAccentsFor(pair.lightThemeId, pair.darkThemeId)
      : undefined,
  }
  return resolveAccentRoles(accentId, context)
}
