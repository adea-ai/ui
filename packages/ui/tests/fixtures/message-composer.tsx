import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import {
  ComposerAttachmentButton,
  MessageComposer,
} from '../../src/components/conversation/message-composer'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

function Fixture() {
  const [draft, setDraft] = createSignal('A draft')
  const [sends, setSends] = createSignal(0)
  const [mounted, setMounted] = createSignal(true)
  const [replyAction, setReplyAction] = createSignal(false)
  const [rejectNext, setRejectNext] = createSignal(false)
  const [deferNext, setDeferNext] = createSignal(false)
  let messageField: HTMLTextAreaElement | undefined
  let confirmPendingSend: (() => void) | undefined
  let rejectPendingSend: (() => void) | undefined
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
      <button type="button" onClick={() => setReplyAction(true)}>
        Use reply action
      </button>
      <button type="button" onClick={() => setDeferNext(true)}>
        Hold next send
      </button>
      <button type="button" onClick={() => confirmPendingSend?.()}>
        Confirm pending send
      </button>
      <button type="button" onClick={() => rejectPendingSend?.()}>
        Reject pending send
      </button>
      <Show when={mounted()}>
        <MessageComposer
          inputRef={(element) => {
            messageField = element
          }}
          inputId="message-draft"
          inputLabel={replyAction() ? undefined : 'Message'}
          inputDescription="Messages support Markdown."
          inputDescribedBy="message-instructions"
          leading={<ComposerAttachmentButton />}
          menu={
            <Button
              type="button"
              onKeyDown={(event) => {
                if (event.key === 'Escape') event.preventDefault()
              }}
            >
              Suggestion
            </Button>
          }
          replyTo={{ label: 'Ada Lovelace', onDismiss: () => undefined }}
          submitLabel={replyAction() ? 'Reply' : undefined}
          value={draft()}
          onValueChange={setDraft}
          onSubmit={() => {
            setSends((value) => value + 1)
            if (deferNext()) {
              setDeferNext(false)
              return new Promise<void>((resolve, reject) => {
                confirmPendingSend = () => {
                  setDraft('')
                  confirmPendingSend = undefined
                  rejectPendingSend = undefined
                  resolve()
                }
                rejectPendingSend = () => {
                  confirmPendingSend = undefined
                  rejectPendingSend = undefined
                  reject(new Error('Synthetic deferred send failure'))
                }
              })
            }
            if (rejectNext()) {
              setRejectNext(false)
              return Promise.reject(new Error('Synthetic send failure'))
            }
            setDraft('')
          }}
        />
      </Show>
      <p id="message-instructions">Do not include secrets in a message.</p>
      <output aria-label="Send count">{sends()}</output>
    </main>
  )
}
render(() => <Fixture />, document.body)
