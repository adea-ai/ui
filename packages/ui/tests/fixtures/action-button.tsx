import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { ActionButton } from '../../src/components/composites/action-button/action-button'
import '../../src/styles/globals.css'

function Fixture() {
  const [busy, setBusy] = createSignal(true)
  const [activations, setActivations] = createSignal(0)

  return (
    <main>
      <ActionButton
        aria-label="Save workspace"
        busy={busy()}
        busyLabel="Saving workspace"
        onClick={() => setActivations((count) => count + 1)}
      >
        Save
      </ActionButton>
      <ActionButton as="a" href="#target" tooltip="Open details" variant="outline">
        Details
      </ActionButton>
      <button type="button" onClick={() => setBusy(false)}>
        Finish save
      </button>
      <output aria-label="Activations">{activations()}</output>
    </main>
  )
}

render(() => <Fixture />, document.body)
