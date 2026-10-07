import { render } from 'solid-js/web'
import { CodeBlock } from '../../src/components/ui/code-block/code-block'
import '../../src/styles/globals.css'

const tall = Array.from({ length: 60 }, (_, index) => `const line${index + 1} = ${index + 1}`).join(
  '\n'
)
const long = `$ bun run check:packed-settings-navigation --reporter=line --retries=0 --workers=1 --grep=strip
error: expected the selected row to be revealed inside its scroller, but it was clipped`

render(
  () => (
    <main class="flex w-96 flex-col gap-4 p-2">
      <CodeBlock id="default-block" code={tall} language="ts" />
      <CodeBlock id="capped-px" code={tall} language="ts" maxHeight={200} />
      <CodeBlock id="capped-length" code={tall} language="ts" maxHeight="10rem" />
      <CodeBlock id="unwrapped" code={long} language="sh" />
      <CodeBlock id="wrapped" code={long} language="sh" wrap />
      <CodeBlock id="wrapped-numbered" code={long} language="sh" wrap showLineNumbers />
      <CodeBlock
        id="wrapped-highlight"
        code={long}
        language="sh"
        wrap
        highlight={(code) => <pre class="m-0 font-code text-code whitespace-pre">{code}</pre>}
      />
    </main>
  ),
  document.body
)
