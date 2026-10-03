import { render } from 'solid-js/web'
import { MessageBody } from '../../src/components/conversation/message-row'
import {
  applyAppearanceFontSettings,
  DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS,
} from '../../src/lib/appearance-font-settings'
import '../../src/styles/globals.css'
import '../../src/styles/appearance-font-settings.css'

// Keep the transcript fixture on the same explicit opt-in contract as a host:
// globals.css alone retains its historical theme font fallback.
applyAppearanceFontSettings(document.documentElement, DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS)
Object.assign(window, {
  setAppearanceFontSettings: (value: unknown) =>
    applyAppearanceFontSettings(document.documentElement, value),
})

const fenced = [
  'Before the fence.',
  '```ts',
  'const answer = 42',
  '```',
  '',
  'After the fence.',
  '',
  'A second paragraph.',
].join('\n')

render(
  () => (
    <main class="w-96 p-4">
      <MessageBody id="fenced" text={fenced} />
    </main>
  ),
  document.body
)
