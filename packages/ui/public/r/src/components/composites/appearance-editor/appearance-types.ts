import type { AccentPreset, AdeaTheme, AdeaThemeRecord } from '@adea-ai/themes'
import type { AppearanceEditorFontSettings } from '../../../lib/appearance-font-settings'

export type AppearanceDraft = Readonly<{
  mode: 'system' | 'light' | 'dark'
  lightThemeId: string
  darkThemeId: string
  /**
   * The terminal palette: `'theme'` follows the interface theme, a theme id
   * pins that theme's terminal colours. Optional so a host without a terminal
   * preference renders no terminal row — the row's presence is this field's
   * presence, not a second prop that could disagree with the draft.
   */
  terminalThemeId?: string
  /** Theme default, a canonical preset id, or the host's custom accent draft. */
  accent: string
  /**
   * The UI, content and code typeface axes. Optional for compatibility with
   * hosts upgrading from the earlier appearance contract; omitted means the
   * shared System defaults.
   */
  fonts?: AppearanceEditorFontSettings
  surface: 'theme' | 'frosted' | 'opaque'
  reduceTransparency: boolean
}>

export type AppearanceEditorProps = {
  draft: AppearanceDraft
  /** Resolved preview themes, including the host's validated accent overlay. */
  lightTheme: AdeaTheme
  darkTheme: AdeaTheme
  resolvedAppearance: 'light' | 'dark'
  themes: readonly AdeaThemeRecord[]
  accentOptions: readonly AccentPreset[]
  /**
   * The accents the previewed light/dark pair carries itself, offered after
   * `accentOptions` — `themeAccentsFor(lightThemeId, darkThemeId)` from
   * `@adea-ai/ui`. Supplied by the host because computing them measures through
   * the catalogue's normalization, which the editor does not load. Omitted, the
   * row offers the presets only.
   */
  themeAccentOptions?: readonly AccentPreset[]
  onChange: (patch: Partial<AppearanceDraft>) => void
  onSave: () => void
  onCancel: () => void
  onReset: () => void
  customAccentError?: string
  customAccentValue?: string
  saveDisabledReason?: string
  saving?: boolean
  recoveryNotice?: string
  surfaceCapability: { frosted: boolean; reason?: string; themeDefaultDescription?: string }
  /** Undefined means theme import is unavailable, never a working-looking action. */
  onManageThemes?: () => void
  /** Mount nested font menus inside the containing overlay when one exists. */
  menuPortalMount?: HTMLElement
  class?: string
  /** Leave Reset/Cancel/Save to the host, which renders `AppearanceEditorActions`. */
  hideActions?: boolean
  /**
   * Where the typeface settings sit in the option list. `inline` — the default
   * — renders them between the accent and glass rows, where they read as one
   * more palette choice. `end` closes the list with them: hosts whose option
   * order is palette-and-surface first, text last, pass `end` instead of
   * recomposing the editor.
   */
  fontSettingsPlacement?: 'inline' | 'end'
  /**
   * How the accent row renders its choices. `swatches` — the default — paints
   * each choice as a colour circle. `labels` renders every choice as a named
   * chip, for hosts whose accent contract is textual rather than chromatic.
   */
  accentEntryStyle?: 'swatches' | 'labels'
  /**
   * Whether the accent row leads with a "Theme default" swatch. Default on.
   * Hosts whose default accent already is one of the catalogue presets pass
   * `false`: the extra entry would duplicate the preset's own colour.
   */
  showThemeDefaultAccent?: boolean
  /**
   * Whether the swatch accent style captions its custom-colour entry. Default
   * on. `false` leaves the custom chip to name itself — for hosts where the
   * caption reads as a second "Custom" label on the control.
   */
  showCustomAccentCaption?: boolean
}

export type AppearancePopoverProps = AppearanceEditorProps & {
  open: boolean
  onOpen: () => void
  onDismiss: () => void
}
