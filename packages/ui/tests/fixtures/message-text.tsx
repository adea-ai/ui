import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { MessageText } from '../../src/components/ui/message'
import '../../src/styles/globals.css'

/**
 * Hostile model output rendered through `MessageText`. Every payload that could
 * run script sets `window.pwned`; the spec asserts it never does, and that no
 * element outside the allowed set reaches the DOM.
 */
type FixtureWindow = Window & {
  pwned?: string[]
  setStreamText?: (text: string) => void
  setStreaming?: (streaming: boolean) => void
}
const fixture = window as FixtureWindow
fixture.pwned = []
const trip = (what: string) => fixture.pwned?.push(what)
// Every sink a payload could reach.
window.alert = () => trip('alert')
window.confirm = () => (trip('confirm'), false)
window.prompt = () => (trip('prompt'), null)

const hostile = `# Heading <img src=x onerror="window.pwned.push('heading')">

<script>window.pwned.push('script')</script>

<img src=x onerror="window.pwned.push('img')"> and <svg onload="window.pwned.push('svg')"></svg>

[click me](javascript:window.pwned.push('link')) and [again](JaVaScRiPt:alert(1)) and [data](data:text/html,<script>alert(1)</script>)

[tab](java\tscript:alert(1)) [space](https://example.com/a b) [vb](vbscript:msgbox(1))

![image](https://example.com/tracker.png) <a href="javascript:alert(1)">raw anchor</a>

**bold <b onmouseover="window.pwned.push('b')">hover</b>** and _em <i>x</i>_ and \`code <u>u</u>\`

> quote <iframe src="javascript:alert(1)"></iframe>

- item <style>body{display:none}</style>
- [ok](https://example.com/ok) and [mail](mailto:person@example.com)

\`\`\`"><img src=x onerror="window.pwned.push('lang')">
<script>window.pwned.push('code')</script>
\`\`\`

\`\`\`html
<img src=x onerror="window.pwned.push('code2')">
\`\`\`

\`\`\`js
never closed <script>window.pwned.push('open')</script>`

const [stream, setStream] = createSignal('')
const [streaming, setStreaming] = createSignal(true)
fixture.setStreamText = setStream
fixture.setStreaming = setStreaming

render(
  () => (
    <main class="flex w-xl max-w-full flex-col gap-6 p-4">
      <MessageText id="hostile" text={hostile} />
      <MessageText id="hostile-streaming" text={hostile} streaming />
      <MessageText id="stream" text={stream()} streaming={streaming()} />
    </main>
  ),
  document.body
)
