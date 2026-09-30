import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { EmptyState } from '../../src/components/ui/empty/empty-state'
import { TooltipProvider } from '../../src/components/ui/tooltip/tooltip'
import '../../src/styles/globals.css'

function Fixture() {
  const [retries, setRetries] = createSignal(0)
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
      </main>
    </TooltipProvider>
  )
}

render(() => <Fixture />, document.body)
