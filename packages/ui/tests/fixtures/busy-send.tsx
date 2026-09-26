import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  BusySendButton,
  type BusySendMode,
} from '../../src/components/conversation/busy-send-button'
import '../../src/styles/globals.css'

function Fixture() {
  const [mode, setMode] = createSignal<BusySendMode>('steer')
  const [disabled, setDisabled] = createSignal(true)
  const [blocked, setBlocked] = createSignal(false)
  const [fired, setFired] = createSignal('none')
  return (
    <main>
      <h1>Busy send fixture</h1>
      <BusySendButton
        mode={mode()}
        onModeChange={setMode}
        onFire={() => setFired(mode())}
        disabled={disabled()}
        unavailable={blocked() ? { queue: 'Queue operation unavailable' } : {}}
        alternateActionHint="Ctrl+Enter uses the other action"
      />
      {/* Keep the outside controls outside the open popup hit area. */}
      <div class="mt-64 flex flex-wrap gap-2">
        <button type="button" onClick={() => setDisabled(false)}>
          Enable send
        </button>
        <button type="button" onClick={() => setBlocked(true)}>
          Block queue
        </button>
        <button type="button" onClick={() => setMode('steer')}>
          Restore steer
        </button>
      </div>
      <output aria-label="Fired action">{fired()}</output>
    </main>
  )
}
render(Fixture, document.body)
