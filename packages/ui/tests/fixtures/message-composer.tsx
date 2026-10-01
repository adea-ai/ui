import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import {
  ComposerAttachmentButton,
  MessageComposer,
} from '../../src/components/conversation/message-composer'
import '../../src/styles/globals.css'

function Fixture() {
  const [draft, setDraft] = createSignal('A draft')
  const [sends, setSends] = createSignal(0)
  const [mounted, setMounted] = createSignal(true)
  const [rejectNext, setRejectNext] = createSignal(false)
  let messageField: HTMLTextAreaElement | undefined
  return (
    <main>
      <button type="button" onClick={() => setMounted((value) => !value)}>
        Toggle composer
      </button>
      <button type="button" onClick={() => messageField?.focus()}>
        Focus message
      </button>
      <button type="button" onClick={() => setRejectNext(true)}>
        Reject next send
      </button>
      <Show when={mounted()}>
        <MessageComposer
          inputRef={(element) => {
            messageField = element
          }}
          inputId="message-draft"
          inputLabel="Message"
          inputDescription="Messages support Markdown."
          inputDescribedBy="message-instructions"
          leading={<ComposerAttachmentButton />}
          replyTo={{ label: 'Ada Lovelace', onDismiss: () => undefined }}
          value={draft()}
          onValueChange={setDraft}
          onSubmit={() => {
            setSends((value) => value + 1)
            if (rejectNext()) {
              setRejectNext(false)
              throw new Error('Synthetic send failure')
            }
          }}
        />
      </Show>
      <p id="message-instructions">Do not include secrets in a message.</p>
      <output aria-label="Send count">{sends()}</output>
    </main>
  )
}
render(() => <Fixture />, document.body)
