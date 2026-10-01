import { createSignal, onCleanup, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { ModalDialog } from '../../src/components/ui/modal-dialog/modal-dialog'
import { Sheet, SheetContent, SheetTitle } from '../../src/components/ui/sheet/sheet'
import '../../src/styles/globals.css'

declare global {
  interface Window {
    closeSheetAndRemoveOpener?: () => void
    closeSheetIntoNewDialog?: () => void
    unmountSheetOwner?: () => void
  }
}

function Fixture() {
  const [open, setOpen] = createSignal(false)
  const [showSheetOwner, setShowSheetOwner] = createSignal(true)
  const [nestedDialogOpen, setNestedDialogOpen] = createSignal(false)
  const [nestedDialogModal, setNestedDialogModal] = createSignal(false)
  const [returnFocusToSheetRoot, setReturnFocusToSheetRoot] = createSignal(false)
  const [customOpenAutoFocus, setCustomOpenAutoFocus] = createSignal(false)
  const [customCloseAutoFocus, setCustomCloseAutoFocus] = createSignal(false)
  let opener: HTMLButtonElement | undefined
  let sheetContent: HTMLElement | undefined

  window.closeSheetAndRemoveOpener = () => {
    setOpen(false)
    opener?.remove()
  }
  window.closeSheetIntoNewDialog = () => {
    setShowSheetOwner(false)
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
  window.unmountSheetOwner = () => setShowSheetOwner(false)

  onCleanup(() => {
    delete window.closeSheetAndRemoveOpener
    delete window.closeSheetIntoNewDialog
    delete window.unmountSheetOwner
    document.querySelector('[role="dialog"][aria-label="Follow-up dialog"]')?.remove()
  })

  return (
    <>
      <main id="app-root">
        <button
          type="button"
          onClick={() => setCustomOpenAutoFocus((enabled) => !enabled)}
          aria-pressed={customOpenAutoFocus()}
        >
          Toggle custom open autofocus
        </button>
        <button
          type="button"
          onClick={() => setCustomCloseAutoFocus((enabled) => !enabled)}
          aria-pressed={customCloseAutoFocus()}
        >
          Toggle custom close autofocus
        </button>
        <button
          id="sheet-opener"
          type="button"
          ref={(element) => (opener = element)}
          onClick={() => {
            // Simulate an external workspace command whose menu has already
            // closed and left focus on body before it opens the controlled sheet.
            opener?.blur()
            setShowSheetOwner(true)
            setOpen(true)
          }}
        >
          Open workspace navigation
        </button>
        <button id="focus-outside-sheet" type="button">
          New focus owner
        </button>
        <button id="caller-close-focus" type="button">
          Caller close destination
        </button>
      </main>
      <Show when={showSheetOwner()}>
        <Sheet open={open()} onOpenChange={setOpen}>
          <SheetContent
            ref={(element: HTMLElement) => (sheetContent = element)}
            tabIndex={-1}
            aria-label="Workspace navigation"
            restoreFocusRef={() => opener}
            onOpenAutoFocus={(event) => {
              if (!customOpenAutoFocus()) return
              event.preventDefault()
              document.getElementById('sheet-last-action')?.focus()
            }}
            onCloseAutoFocus={(event) => {
              if (!customCloseAutoFocus()) return
              event.preventDefault()
              document.getElementById('caller-close-focus')?.focus()
            }}
          >
            <SheetTitle>Workspace navigation</SheetTitle>
            <button type="button">First sheet action</button>
            {/* WebKit grants click focus only to controls that opt in with an
                explicit tabindex; a plain button would leave focus on the
                scrollable sheet content and the nested dialog would capture
                that div as its opener instead of the trigger. */}
            <button
              type="button"
              tabindex="0"
              onClick={() => {
                setNestedDialogModal(false)
                setReturnFocusToSheetRoot(false)
                setNestedDialogOpen(true)
              }}
            >
              Open nested non-modal action
            </button>
            <button
              type="button"
              tabindex="0"
              onClick={() => {
                setNestedDialogModal(true)
                setReturnFocusToSheetRoot(false)
                setNestedDialogOpen(true)
              }}
            >
              Open nested modal action
            </button>
            <button
              type="button"
              tabindex="0"
              onClick={() => {
                setNestedDialogModal(false)
                setReturnFocusToSheetRoot(true)
                setNestedDialogOpen(true)
              }}
            >
              Open nested action returning to the Sheet root
            </button>
            <button id="sheet-last-action" type="button">
              Last sheet action
            </button>
          </SheetContent>
        </Sheet>
        <Show when={nestedDialogOpen()}>
          <ModalDialog
            open={nestedDialogOpen()}
            onClose={() => setNestedDialogOpen(false)}
            title={nestedDialogModal() ? 'Nested modal action' : 'Nested non-modal action'}
            modal={nestedDialogModal()}
            onCloseAutoFocus={(event: Event) => {
              if (!returnFocusToSheetRoot()) return
              event.preventDefault()
              sheetContent?.focus({ preventScroll: true })
            }}
          >
            <button type="button" autofocus>
              Finish nested action
            </button>
          </ModalDialog>
        </Show>
      </Show>
    </>
  )
}

render(Fixture, document.body)
