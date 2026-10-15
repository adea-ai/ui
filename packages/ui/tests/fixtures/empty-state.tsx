import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { EmptyState } from '../../src/components/ui/empty/empty-state'
import { TooltipProvider } from '../../src/components/ui/tooltip/tooltip'
import '../../src/styles/globals.css'

function Fixture() {
  const [retries, setRetries] = createSignal(0)
  const [settings, setSettings] = createSignal(0)
  return (
    <TooltipProvider openDelay={0}>
      <main>
        <EmptyState
          title="Loading graph"
          detail="Mapping linked documents."
          announceAs="status"
          busy
        />
        <EmptyState
          title="Graph unavailable"
          detail="Check the connection and retry."
          announceAs="alert"
          actionLabel="Try again"
          actionTooltip="Retry loading the graph"
          action={() => setRetries((count) => count + 1)}
        />
        <output aria-label="Retries">{retries()}</output>
        <EmptyState
          headingLevel={2}
          title="Sync health unavailable"
          detail="The status snapshot did not load."
          announceAs="alert"
          actionLabel="Retry status"
          action={() => setRetries((count) => count + 10)}
          secondaryActionLabel="Open settings"
          secondaryActionTooltip="Review configuration and resolve setup requirements."
          secondaryAction={() => setSettings((count) => count + 1)}
          data-testid="two-actions"
        />
        <output aria-label="Settings opened">{settings()}</output>
      </main>
    </TooltipProvider>
  )
}

render(() => <Fixture />, document.body)
