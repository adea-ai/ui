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
 * which is also where the reasoning behind each component is written down. An
 * optional-peer component lives on its documented component subpath rather than here.
 */

/* --- Primitives ---------------------------------------------------------- */
export * from './components/ui/accordion'
export * from './components/ui/alert'
export * from './components/ui/alert-dialog'
export * from './components/ui/attachment'
export * from './components/ui/annotation-surface'
export * from './components/ui/aspect-ratio'
export * from './components/ui/avatar'
export * from './components/ui/board'
export * from './components/ui/bubble'
export * from './components/ui/badge'
export * from './components/ui/breadcrumb'
export * from './components/ui/button'
export * from './components/ui/button-group'
export * from './components/ui/calendar'
export * from './components/ui/card'
export * from './components/ui/checkbox'
export * from './components/ui/collapsible'
export * from './components/ui/combobox'
export * from './components/ui/code-block'
export * from './components/ui/command'
export * from './components/ui/context-menu'
export * from './components/ui/dialog'
export * from './components/ui/diff-block'
export * from './components/ui/detail-panel'
export * from './components/ui/drawer'
export * from './components/ui/dropdown-menu'
export * from './components/ui/entity-icon'
export * from './components/ui/empty'
export * from './components/ui/field'
export * from './components/ui/hover-card'
export * from './components/ui/input'
export * from './components/ui/item'
export * from './components/ui/input-group'
export * from './components/ui/input-otp'
export * from './components/ui/kbd'
export * from './components/ui/label'
export * from './components/ui/marker'
export * from './components/ui/menubar'
export * from './components/ui/message'
export * from './components/ui/modal-dialog'
export * from './components/ui/navigation-menu'
export * from './components/ui/pagination'
export * from './components/ui/popover'
export * from './components/ui/progress'
export * from './components/ui/questionnaire'
export * from './components/ui/radio-group'
export * from './components/ui/resizable'
export * from './components/ui/scroll-area'
export * from './components/ui/select'
export * from './components/ui/native-select'
export * from './components/ui/separator'
export * from './components/ui/sheet'
export * from './components/ui/skeleton'
export * from './components/ui/slider'
export * from './components/ui/status-chip'
export * from './components/ui/spinner'
export * from './components/ui/switch'
export * from './components/ui/table'
export * from './components/ui/tabs'
export * from './components/ui/textarea'
export * from './components/ui/text-link'
export * from './components/ui/toast'
export * from './components/ui/toggle'
export * from './components/ui/toggle-group'
export * from './components/ui/trace'
export * from './components/ui/tooltip'
export * from './components/ui/typography'

/* --- Motion -------------------------------------------------------------- */
export * from './components/motion'

/* --- Layout -------------------------------------------------------------- */
export * from './components/layout/split-layout'
export * from './components/layout/floating-preview'
export * from './components/layout/orbit-layout'
export * from './components/layout/virtual-window'
export * from './components/layout/app-shell'
export * from './components/layout/page'
export * from './components/layout/panel'
export * from './components/layout/side-rail'
export * from './components/layout/sidebar-nav'
export * from './components/layout/contextual-sidebar'
export * from './components/layout/status-bar'
export * from './components/layout/top-bar'

/* --- Conversation -------------------------------------------------------- */
export * from './components/conversation'

/* --- Theming ------------------------------------------------------------- */
export * from './components/theme'

/* --- Composites ---------------------------------------------------------- */
export * from './components/composites/account-menu'
export * from './components/composites/action-button'
export * from './components/composites/catalog-browser'
export * from './components/composites/list-row'
export * from './components/composites/message-scroller'
export * from './components/composites/chat'
export * from './components/composites/chain-of-thought'
export * from './components/composites/checkpoint'
export * from './components/composites/confirmation'
export * from './components/composites/context'
export * from './components/composites/file-tree'
export * from './components/composites/inline-citation'
export * from './components/composites/model-selector'
export * from './components/composites/plan'
export * from './components/composites/queue'
export * from './components/composites/reasoning'
export * from './components/composites/sources'
export * from './components/composites/stack-trace'
export * from './components/composites/subagent'
export * from './components/composites/suggestion'
export * from './components/composites/task'
export * from './components/composites/terminal'
export * from './components/composites/test-results'
export * from './components/composites/tool'
export * from './components/composites/tree'
export * from './components/composites/settings'
export * from './components/composites/scene-controls'
export * from './components/composites/stat'
export * from './components/composites/appearance-editor'
export * from './components/composites/update-dialog'
export * from './components/composites/about-dialog'
export * from './components/composites/help-center'
export * from './components/composites/workspace-mark'

/* --- Library ------------------------------------------------------------- */
export { cn } from './lib/utils'
export {
  isCustomAccent,
  normalizeCustomAccent,
  paintAccentRoles,
  resolveAccentRoles,
  type AccentRoles,
  type AccentTarget,
} from './lib/accent-roles'
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
  appearancePreviewThemes,
  builtinThemes,
  contrastRatio,
  defaultDarkThemeId,
  defaultLightThemeId,
  editorPaletteFor,
  isThemeAccentId,
  resolveAccentPreset,
  resolveVariant,
  terminalCssVariables,
  themeAccentsFor,
  themeById,
  themeCssVariables,
  themeFamilies,
  themeRecordById,
  themeRecords,
  themesForAppearance,
  tokensAsHex,
  validateTheme,
  validateThemeRegistry,
  variantFromRecord,
  withAccent,
  type EditorRolesMode,
  type ThemeAppearance,
  type ThemeColors,
  type ThemeCssVariableOptions,
  type ThemeEditorPalette,
  type ThemeFinding,
  type ThemeProvenance,
  type ThemeTerminalPalette,
  type ThemeVariant,
} from './lib/themes'
export { fontZoomShortcut, stepAppearanceFontSizes, type FontZoomIntent } from './lib/font-zoom'
export {
  REDUCED_TRANSPARENCY_QUERY,
  normalizeSurface,
  resolveSurface,
  resolveSurfaceState,
  surfaceAlpha,
  themeSurfaces,
  type SurfaceEnvironment,
  type SurfaceState,
} from './lib/theme-surface'
export {
  defaultPreferenceStorage,
  quarantineRecord,
  readLegacyValue,
  readVersionedRecord,
  recoveryEnvelope,
  recoveryKeyFor,
  writeVersionedRecord,
  type PreferenceStorage,
  type RecoveryEnvelope,
  type RecoveryReason,
  type VersionedRead,
  type VersionedRecordSchema,
} from './lib/preference-store'
export { keyedRows, type KeyedRow } from './lib/keyed-rows'
export { writeClipboardText } from './lib/clipboard'
export { formatBytes, formatReleaseDate, plainTextFromMarkdown } from './lib/version-notes'
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
