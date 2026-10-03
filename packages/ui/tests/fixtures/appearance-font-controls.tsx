import { render } from 'solid-js/web'
import {
  applyAppearanceFontSettings,
  DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS,
} from '../../src/lib/appearance-font-settings'
import { Button } from '../../src/components/ui/button/button'
import { Input } from '../../src/components/ui/input/input'
import '../../src/styles/globals.css'
import '../../src/styles/appearance-font-settings.css'

declare global {
  interface Window {
    setAppearanceFontSize: (size: number) => void
  }
}

window.setAppearanceFontSize = (size) =>
  applyAppearanceFontSettings(document.documentElement, {
    ...DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS,
    ui: { family: 'system', size },
  })

window.setAppearanceFontSize(DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS.ui.size)

render(
  () => (
    <main>
      <section
        aria-label="Shared controls outside Appearance"
        class="flex flex-wrap items-center gap-2"
      >
        <Button size="sm" variant="outline" data-testid="global-font-button-sm">
          Small action
        </Button>
        <Button size="md" variant="outline" data-testid="global-font-button-md">
          Form action
        </Button>
        <Input aria-label="Global font preference field" value="Sample preference" class="w-48" />
      </section>
    </main>
  ),
  document.body
)
