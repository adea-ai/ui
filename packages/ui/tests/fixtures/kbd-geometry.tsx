import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button/button'
import { Kbd, KbdChord, KbdGroup } from '../../src/components/ui/kbd/kbd'
import {
  applyAppearanceFontSettings,
  DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS,
} from '../../src/lib/appearance-font-settings'
import '../../src/styles/globals.css'
import '../../src/styles/appearance-font-settings.css'

applyAppearanceFontSettings(document.documentElement, DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS)
Object.assign(window, {
  setKbdAppearanceFontSettings: (settings: unknown) =>
    applyAppearanceFontSettings(document.documentElement, settings),
})

render(
  () => (
    <main class="flex flex-col items-start gap-2 p-2">
      <Kbd data-cap="default">K</Kbd>
      <Kbd size="compact" data-cap="compact">
        K
      </Kbd>
      <KbdGroup data-group="default">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
      <KbdGroup size="compact" data-group="compact">
        <Kbd size="compact">⌘</Kbd>
        <Kbd size="compact">K</Kbd>
      </KbdGroup>
      <KbdChord data-chord="default" keys="⇧⌘P" />
      <KbdChord size="compact" data-chord="compact" keys="⇧⌘P" />
      <Button variant="outline" size="sm" data-host aria-keyshortcuts="Meta+K">
        Search projects
        <KbdChord size="compact" keys="⌘K" />
      </Button>
    </main>
  ),
  document.body
)
