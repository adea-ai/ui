import { createSignal, onCleanup } from 'solid-js'
import { render } from 'solid-js/web'
import { ModalDialog } from '../../src/components/ui/modal-dialog/modal-dialog'
import '../../src/styles/globals.css'

declare global {
  interface Window {
    completeModalDialogClose?: () => void
  }
}

function Fixture() {
  const [open, setOpen] = createSignal(false)
  const [modal, setModal] = createSignal(true)
  const [customLabel, setCustomLabel] = createSignal(false)
  const [closing, setClosing] = createSignal(false)
  window.completeModalDialogClose = () => {
    setOpen(false)
    setClosing(false)
  }
  onCleanup(() => delete window.completeModalDialogClose)

  return (
    <>
      <main id="app-root">
        <button type="button" onClick={() => setModal(false)}>
          Use non-modal Kobalte layer
        </button>
        <button type="button" onClick={() => setCustomLabel(true)}>
          Use custom dialog label
        </button>
        <button type="button" onClick={() => setOpen(true)}>
          Open workspace details
        </button>
        <output aria-label="Close status">{closing() ? 'Closing' : 'Open'}</output>
      </main>
      <ModalDialog
        open={open()}
        onClose={() => setClosing(true)}
        modal={modal()}
        title="Workspace details"
        aria-label={customLabel() ? 'Custom workspace label' : undefined}
      >
        <button type="button">Dialog action</button>
      </ModalDialog>
    </>
  )
}

render(Fixture, document.body)
