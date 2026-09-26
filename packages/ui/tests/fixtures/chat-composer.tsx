import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  ChatComposer,
  type ChatComposerControl,
} from '../../src/components/conversation/chat-composer'
import '../../src/styles/globals.css'
import type { BusySendMode } from '../../src/components/conversation/busy-send-button'

function Fixture() {
  const [draft, setDraft] = createSignal('')
  const [changes, setChanges] = createSignal(0)
  const [collapsed, setCollapsed] = createSignal(false)
  const [fail, setFail] = createSignal(true)
  const [sent, setSent] = createSignal(0)
  const [busy, setBusy] = createSignal(false)
  const [references, setReferences] = createSignal(false)
  const [mode, setMode] = createSignal<BusySendMode>('steer')
  const [blocked, setBlocked] = createSignal(false)
  const [approvalFocus, setApprovalFocus] = createSignal(false)
  const [scope, setScope] = createSignal(0)
  const [waitDelivery, setWaitDelivery] = createSignal(false)
  const [lastAction, setLastAction] = createSignal('none')
  let rejectDelivery: ((reason: Error) => void) | undefined
  let control: ChatComposerControl | undefined
  return (
    <main>
      <h1>Composed input</h1>
      <ChatComposer
        value={draft()}
        onValueChange={(value) => {
          setDraft(value)
          setChanges(changes() + 1)
        }}
        sendableActions={references() ? { send: true, queue: true, steer: false } : undefined}
        resetKey={scope()}
        approvalFocus={approvalFocus()}
        approval={approvalFocus() ? <p role="status">Review the pending operation</p> : undefined}
        blockedReason={blocked() ? 'Reconnect before delivery' : undefined}
        busy={busy() ? { mode: mode(), onModeChange: setMode } : undefined}
        onSubmit={(input) => {
          setLastAction(input.action)
          if (waitDelivery())
            return new Promise<void>((_resolve, reject) => {
              rejectDelivery = reject
            })
          if (fail()) throw new Error('Fixture refused')
          setSent(sent() + 1)
          setDraft('')
        }}
        collapse={{ value: collapsed(), onChange: setCollapsed }}
        controlRef={(value) => {
          control = value
        }}
        knowledge={<p>Knowledge context</p>}
        followUps={<button type="button">Follow-up option</button>}
        band={<p>Adjacent composer tip</p>}
        attachments={<p>Staged file: notes.md</p>}
        context={<button type="button">Model context</button>}
      />
      <div class="mt-64 flex gap-2">
        <button type="button" onClick={() => setFail(false)}>
          Recover delivery
        </button>
        <button type="button" onClick={() => control?.expandAndFocus()}>
          Compose here
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" onClick={() => setReferences(true)}>
          Stage references
        </button>
        <button type="button" onClick={() => setBusy(true)}>
          Run busy
        </button>
        <button type="button" onClick={() => setMode('queue')}>
          Select queue
        </button>
        <button type="button" onClick={() => setBlocked(true)}>
          Disconnect
        </button>
        <button type="button" onClick={() => setApprovalFocus(true)}>
          Focus approval
        </button>
        <button type="button" onClick={() => setApprovalFocus(false)}>
          Return to input
        </button>
        <button type="button" onClick={() => setWaitDelivery(true)}>
          Delay delivery
        </button>
        <button
          type="button"
          onClick={() => {
            setScope(scope() + 1)
            setDraft('New scope draft')
          }}
        >
          Change scope
        </button>
        <button type="button" onClick={() => rejectDelivery?.(new Error('Old scope refused'))}>
          Refuse old delivery
        </button>
      </div>
      <output aria-label="Submitted action">{lastAction()}</output>
      <label>
        Other conversation
        <textarea aria-label="Other conversation" />
      </label>
      <output aria-label="Draft changes">{changes()}</output>
      <output aria-label="Sent">{sent()}</output>
    </main>
  )
}
render(Fixture, document.body)
