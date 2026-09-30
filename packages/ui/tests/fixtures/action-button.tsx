import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { ActionButton } from '../../src/components/composites/action-button/action-button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from '../../src/components/ui/popover/popover'
import '../../src/styles/globals.css'

function Fixture() {
  const [busy, setBusy] = createSignal(true)
  const [statusOpen, setStatusOpen] = createSignal(false)
  const [activations, setActivations] = createSignal(0)
  const captureClickProps = {
    'oncapture:click': () => setActivations((count) => count + 1),
  }

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
      <ActionButton
        as="a"
        aria-label="Export report"
        href="#busy-link-navigation"
        busy
        busyLabel="Exporting report"
        tooltip="Wait for the current export to finish"
        onClick={() => setActivations((count) => count + 1)}
      >
        Export
      </ActionButton>
      <ActionButton
        aria-label="Delete workspace"
        disabled
        tooltip="Ask a workspace owner to restore access before deleting"
        on:click={() => setActivations((count) => count + 1)}
      >
        Delete
      </ActionButton>
      <ActionButton
        aria-label="Archive workspace"
        disabled
        tooltip="Ask a workspace owner to restore access before archiving"
        {...(captureClickProps as {})}
      >
        Archive
      </ActionButton>
      <Popover open={statusOpen()} onOpenChange={setStatusOpen}>
        <PopoverTrigger
          as={ActionButton}
          variant="ghost"
          size="icon-sm"
          aria-label="Open system status"
          tooltip="View the current system status"
        >
          System status
        </PopoverTrigger>
        <PopoverContent aria-label="System status">
          <PopoverTitle>System status</PopoverTitle>
          <p>All systems operational.</p>
        </PopoverContent>
      </Popover>
      <button type="button" onClick={() => setBusy(false)}>
        Finish save
      </button>
      <output aria-label="Activations">{activations()}</output>
      <input aria-label="Start tooltip button focus order" />
      <ActionButton aria-label="Available action" tooltip="Available action help">
        Available action
      </ActionButton>
      <ActionButton aria-label="Unavailable action" disabled tooltip="Unavailable action help">
        Unavailable action
      </ActionButton>
      <ActionButton
        aria-label="Programmatic-only action"
        tabIndex={-1}
        tooltip="Programmatic-only action help"
      >
        Programmatic-only action
      </ActionButton>
    </main>
  )
}

render(() => <Fixture />, document.body)
