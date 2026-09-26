import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { MessageComposer } from '../../src/components/conversation/message-composer'
import '../../src/styles/globals.css'

function Fixture() {
  const [draft, setDraft] = createSignal('A draft')
  const [sends, setSends] = createSignal(0)
  const [mounted, setMounted] = createSignal(true)
  return (
    <main>
      <button type="button" onClick={() => setMounted((value) => !value)}>
        Toggle composer
      </button>
      <Show when={mounted()}>
        <MessageComposer
          value={draft()}
          onValueChange={setDraft}
          onSubmit={() => {
            setSends((value) => value + 1)
          }}
        />
      </Show>
      <output aria-label="Send count">{sends()}</output>
    </main>
  )
}
render(() => <Fixture />, document.body)
