import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { writeClipboardText } from '../../src/lib/clipboard'

function Fixture() {
  const [result, setResult] = createSignal('')
  return (
    <main>
      <button id="copy-origin" type="button">
        Copy source
      </button>
      <button
        id="copy-trigger"
        type="button"
        onClick={async () => {
          try {
            await writeClipboardText('sensitive context')
            setResult('Copied')
          } catch (error) {
            setResult(error instanceof Error ? error.message : String(error))
          }
        }}
      >
        Copy text
      </button>
      <output id="copy-result">{result()}</output>
    </main>
  )
}

render(() => <Fixture />, document.body)
