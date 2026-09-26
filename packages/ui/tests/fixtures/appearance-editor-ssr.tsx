import adeaLight from '@adea-ai/themes/themes/adea-light'
import adeaDark from '@adea-ai/themes/themes/adea-dark'
import { ACCENTS } from '@adea-ai/themes'
import { renderToString } from 'solid-js/web'
import { AppearanceEditor } from '../../src/components/composites/appearance-editor'

export function renderAppearance() {
  const light = adeaLight
  const dark = adeaDark
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
