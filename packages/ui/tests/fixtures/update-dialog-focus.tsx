import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import {
  UpdateDialog,
  type UpdateAdapter,
  type UpdateState,
} from '../../src/components/composites/update-dialog'
import '../../src/styles/globals.css'

const current: UpdateState = { phase: 'current', currentVersion: '0.71.1' }

const adapter: UpdateAdapter = {
  getStatus: async () => current,
  check: async () => current,
  install: async () => current,
  isDesktopRuntime: () => true,
}

function Fixture() {
  const [open, setOpen] = createSignal(false)
  let opener: HTMLButtonElement | undefined

  const openFromMenu = () => {
    // A menu selection closes its layer before the controlled dialog opens, so
    // the active element can be body even though the stable opener still exists.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setOpen(true)
  }

  return (
    <main>
      <button ref={(element) => (opener = element)} onClick={openFromMenu}>
        Open updates from user menu
      </button>
      <Show when={open()}>
        <UpdateDialog
          adapter={adapter}
          appName="Adea"
          open={open()}
          onOpenChange={setOpen}
          restoreFocusRef={() => opener}
        />
      </Show>
    </main>
  )
}

render(Fixture, document.body)
