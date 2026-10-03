import { createSignal } from 'solid-js'
import {
  AppearanceFontSettingsGroup,
  type AppearanceEditorFontSettings,
} from '../../src/components/composites/appearance-editor/font-settings-group'
import { DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS } from '../../src/lib/appearance-font-settings'

export function AppearanceFontSettingsFixture() {
  const [settings, setSettings] = createSignal<AppearanceEditorFontSettings>({
    ...DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS,
  })

  return (
    <div class="w-full max-w-lg" data-appearance-font-settings-fixture>
      <AppearanceFontSettingsGroup settings={settings()} onChange={setSettings} />
      <output data-testid="appearance-font-settings-value" class="sr-only">
        {JSON.stringify(settings())}
      </output>
    </div>
  )
}
