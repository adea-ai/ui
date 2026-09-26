import { ACCENTS, getTheme } from '@adea-ai/themes'
import { renderToString } from 'solid-js/web'
import { AppearanceEditor } from '../../src/components/composites/appearance-editor'

export function renderAppearance() {
  const light = getTheme('adea-light')!
  const dark = getTheme('adea-dark')!
  return renderToString(() => (
    <AppearanceEditor
      draft={{
        mode: 'system',
        lightThemeId: light.id,
        darkThemeId: dark.id,
        accent: 'theme',
        surface: 'theme',
        reduceTransparency: false,
      }}
      lightTheme={light}
      darkTheme={dark}
      resolvedAppearance="dark"
      themes={[light, dark]}
      accentOptions={ACCENTS}
      surfaceCapability={{ frosted: false }}
      onChange={() => {}}
      onSave={() => {}}
      onCancel={() => {}}
      onReset={() => {}}
    />
  ))
}
