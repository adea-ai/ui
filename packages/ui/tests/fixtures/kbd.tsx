import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button'
import { Kbd, KbdGroup, ShortcutKeys } from '../../src/components/ui/kbd'
import '../../src/styles/globals.css'

render(
  () => (
    <main class="flex flex-col items-start gap-4 p-4">
      <h1>Keyboard hints</h1>
      <Button variant="outline" aria-keyshortcuts="Shift+Meta+P">
        Switch project <ShortcutKeys keys="⇧⌘P" />
      </Button>
      <p>
        Close with <Kbd>Esc</Kbd>.
      </p>
      <KbdGroup aria-label="Command and Escape">
        <Kbd>⌘</Kbd>
        <Kbd>Esc</Kbd>
      </KbdGroup>
      <KbdGroup size="sm" aria-label="Control and Enter">
        <Kbd size="sm">Ctrl</Kbd>
        <Kbd size="sm">Enter</Kbd>
      </KbdGroup>
    </main>
  ),
  document.body
)
