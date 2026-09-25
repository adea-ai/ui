/**
 * @adea-ai/ui — the Adea design system.
 *
 * The public surface, grouped by layer. The split matters when reading an
 * import list: `ui` is a primitive you theme with variants, `layout` places a
 * region of the window, and `composites` are opinionated assemblies of both.
 *
 *   import { Button, Dialog, AppShell, SideRail, SettingsSection } from '@adea-ai/ui'
 *   import '@adea-ai/ui/globals.css'
 *   import '@adea-ai/ui/fonts.css'
 *
 * Everything here is covered by the Storybook workshop in `apps/storybook`,
 * which is also where the reasoning behind each component is written down. If a
 * component is not exported here, it is not part of the contract.
 */

/* --- Primitives ---------------------------------------------------------- */
export * from './components/ui/accordion'
export * from './components/ui/alert'
export * from './components/ui/alert-dialog'
export * from './components/ui/aspect-ratio'
export * from './components/ui/avatar'
export * from './components/ui/badge'
export * from './components/ui/breadcrumb'
export * from './components/ui/button'
export * from './components/ui/button-group'
export * from './components/ui/card'
export * from './components/ui/checkbox'
export * from './components/ui/collapsible'
export * from './components/ui/combobox'
export * from './components/ui/command'
export * from './components/ui/context-menu'
export * from './components/ui/dialog'
export * from './components/ui/drawer'
export * from './components/ui/dropdown-menu'
export * from './components/ui/empty'
export * from './components/ui/field'
export * from './components/ui/hover-card'
export * from './components/ui/input'
export * from './components/ui/item'
export * from './components/ui/input-group'
export * from './components/ui/input-otp'
export * from './components/ui/kbd'
export * from './components/ui/label'
export * from './components/ui/menubar'
export * from './components/ui/pagination'
export * from './components/ui/popover'
export * from './components/ui/progress'
export * from './components/ui/radio-group'
export * from './components/ui/resizable'
export * from './components/ui/scroll-area'
export * from './components/ui/select'
export * from './components/ui/separator'
export * from './components/ui/sheet'
export * from './components/ui/skeleton'
export * from './components/ui/slider'
export * from './components/ui/spinner'
export * from './components/ui/switch'
export * from './components/ui/table'
export * from './components/ui/tabs'
export * from './components/ui/textarea'
export * from './components/ui/toast'
export * from './components/ui/toggle'
export * from './components/ui/toggle-group'
export * from './components/ui/tooltip'

/* --- Motion -------------------------------------------------------------- */
export * from './components/motion'

/* --- Layout -------------------------------------------------------------- */
export * from './components/layout/app-shell'
export * from './components/layout/page'
export * from './components/layout/panel'
export * from './components/layout/side-rail'
export * from './components/layout/sidebar-nav'
export * from './components/layout/status-bar'
export * from './components/layout/top-bar'

/* --- Conversation -------------------------------------------------------- */
export * from './components/conversation'

/* --- Theming ------------------------------------------------------------- */
export * from './components/theme'

/* --- Composites ---------------------------------------------------------- */
export * from './components/composites/list-row'
export * from './components/composites/settings'
export * from './components/composites/stat'

/* --- Library ------------------------------------------------------------- */
export { cn } from './lib/utils'
export {
  controlInteractive,
  controlSize,
  controlSizeIcon,
  controlSizes,
  cva,
  surfaceInteractive,
  type ControlSize,
  type VariantProps,
} from './lib/variants'
export {
  builtinThemes,
  contrastRatio,
  defaultDarkThemeId,
  defaultLightThemeId,
  themeById,
  themeCssVariables,
  themeFamilies,
  themesForAppearance,
  validateTheme,
  validateThemeRegistry,
  type ThemeAppearance,
  type ThemeColors,
  type ThemeEditorPalette,
  type ThemeFinding,
  type ThemeProvenance,
  type ThemeTerminalPalette,
  type ThemeVariant,
} from './lib/themes'
export {
  accentPresets,
  allTokens,
  colorTokens,
  densityTokens,
  designTokens,
  elevationTokens,
  fontOptions,
  motionTokens,
  radiusTokens,
  typographyTokens,
  undocumentedTokenAliases,
  zIndexTokens,
  type AccentPreset,
  type FontOption,
  type TokenDefinition,
  type TokenKind,
} from './lib/tokens'
