import type { AccentPreset, AdeaTheme, AdeaThemeRecord } from '@adea-ai/themes'

export type AppearanceDraft = Readonly<{
  mode: 'system' | 'light' | 'dark'
  lightThemeId: string
  darkThemeId: string
  /** Theme default, a canonical preset id, or the host's custom accent draft. */
  accent: string
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
  class?: string
}

export type AppearancePopoverProps = AppearanceEditorProps & {
  open: boolean
  onOpen: () => void
  onDismiss: () => void
}
