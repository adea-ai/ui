import { Layers } from 'lucide-solid'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../src/components/ui/tooltip/tooltip'
import '../../src/styles/globals.css'

function Fixture() {
  const [controlledOpen, setControlledOpen] = createSignal(false)

  return (
    <main>
      <h1 class="sr-only">Tooltip fixture</h1>
      <Tooltip openDelay={0} forceMount>
        <TooltipTrigger as="button" type="button">
          Focus to open the force-mounted tooltip
        </TooltipTrigger>
        <TooltipContent>Tooltip without a caret</TooltipContent>
      </Tooltip>
      <button type="button">Next action</button>
      <Tooltip openDelay={0} forceMount>
        <TooltipTrigger as="button" type="button" aria-label="Layers">
          <Layers />
        </TooltipTrigger>
        {/* The icon slot is the side rail's icon+label tip on the shared
            component; the trigger keeps its own accessible name. */}
        <TooltipContent icon={<Layers />}>Layer tree</TooltipContent>
      </Tooltip>
      <button type="button" onClick={() => setControlledOpen(true)}>
        Open controlled tooltip
      </button>
      <button type="button" onClick={() => setControlledOpen(false)}>
        Close controlled tooltip
      </button>
      <Tooltip open={controlledOpen()} onOpenChange={setControlledOpen} forceMount>
        <TooltipTrigger as="button" type="button">
          Controlled tooltip trigger
        </TooltipTrigger>
        <TooltipContent aria-hidden="false">Controlled tooltip description</TooltipContent>
      </Tooltip>
    </main>
  )
}

render(() => <Fixture />, document.body)
