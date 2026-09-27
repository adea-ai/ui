import { createSignal, onCleanup, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { ModalDialog } from '../../src/components/ui/modal-dialog/modal-dialog'
import '../../src/styles/globals.css'

declare global {
  interface Window {
    completeModalDialogClose?: () => void
    completeModalDialogCloseIntoNewOverlay?: () => void
  }
}

function Fixture() {
  const [open, setOpen] = createSignal(false)
  const [showDialogOwner, setShowDialogOwner] = createSignal(false)
  const [modal, setModal] = createSignal(true)
  const [customLabel, setCustomLabel] = createSignal(false)
  const [externalLabel, setExternalLabel] = createSignal(false)
  const [explicitReturnFocus, setExplicitReturnFocus] = createSignal(false)
  const [closing, setClosing] = createSignal(false)
  const [customCloseFocus, setCustomCloseFocus] = createSignal(false)
  const [openDialogButton, setOpenDialogButton] = createSignal<HTMLButtonElement>()
  window.completeModalDialogClose = () => {
    setShowDialogOwner(false)
    setClosing(false)
  }
  window.completeModalDialogCloseIntoNewOverlay = () => {
    setShowDialogOwner(false)
    setClosing(false)
    const overlay = document.createElement('section')
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-label', 'Follow-up dialog')
    const button = document.createElement('button')
    button.id = 'follow-up-dialog-focus'
    button.textContent = 'Continue in follow-up'
    overlay.append(button)
    document.body.append(overlay)
    button.focus()
  }
  onCleanup(() => {
    delete window.completeModalDialogClose
    delete window.completeModalDialogCloseIntoNewOverlay
    document.querySelector('[role="dialog"][aria-label="Follow-up dialog"]')?.remove()
  })

  return (
    <>
      <main id="app-root">
        <button type="button" onClick={() => setModal(false)}>
          Use non-modal Kobalte layer
        </button>
        <button type="button" onClick={() => setCustomLabel(true)}>
          Use custom dialog label
        </button>
        <button type="button" onClick={() => setExternalLabel(true)}>
          Use external dialog label
        </button>
        <button type="button" onClick={() => setCustomCloseFocus(true)}>
          Use custom close focus
        </button>
        <button type="button" onClick={() => setCustomCloseFocus(false)}>
          Use default close focus
        </button>
        <button type="button" onClick={() => setExplicitReturnFocus(true)}>
          Use explicit return-focus target
        </button>
        <button
          type="button"
          ref={setOpenDialogButton}
          onClick={() => {
            setShowDialogOwner(true)
            setOpen(true)
          }}
        >
          Open workspace details
        </button>
        <button id="custom-close-focus-target" type="button">
          Follow-up action
        </button>
        <h2 id="external-dialog-label">External workspace name</h2>
        <output aria-label="Close status">{closing() ? 'Closing' : 'Open'}</output>
      </main>
      <Show when={showDialogOwner()}>
        <ModalDialog
          open={open()}
          onClose={() => setClosing(true)}
          modal={modal()}
          title="Workspace details"
          aria-label={
            externalLabel()
              ? 'Fallback custom workspace label'
              : customLabel()
                ? 'Custom workspace label'
                : undefined
          }
          aria-labelledby={externalLabel() ? 'external-dialog-label' : undefined}
          restoreFocusRef={explicitReturnFocus() ? openDialogButton : undefined}
          onCloseAutoFocus={(event: Event) => {
            if (!customCloseFocus()) return
            event.preventDefault()
            document.getElementById('custom-close-focus-target')?.focus()
          }}
        >
          <button type="button">Dialog action</button>
        </ModalDialog>
      </Show>
    </>
  )
}

render(Fixture, document.body)
