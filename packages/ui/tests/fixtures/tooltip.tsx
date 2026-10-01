import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../src/components/ui/tooltip/tooltip'
import '../../src/styles/globals.css'

function Fixture() {
  const [hideArrow, setHideArrow] = createSignal(false)
  const [controlledOpen, setControlledOpen] = createSignal(false)

  return (
    <main>
      <h1 class="sr-only">Tooltip fixture</h1>
      <Tooltip openDelay={0} forceMount>
        <TooltipTrigger
          as="button"
          type="button"
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === 'ArrowRight') setHideArrow((hidden) => !hidden)
          }}
        >
          Press ArrowRight to toggle the tooltip arrow
        </TooltipTrigger>
        <TooltipContent hideArrow={hideArrow()}>Tooltip with optional arrow</TooltipContent>
      </Tooltip>
      <output aria-label="Arrow visibility">{hideArrow() ? 'hidden' : 'shown'}</output>
      <button type="button">Next action</button>
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
