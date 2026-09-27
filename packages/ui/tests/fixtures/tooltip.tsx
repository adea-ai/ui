import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../src/components/ui/tooltip/tooltip'
import '../../src/styles/globals.css'

function Fixture() {
  const [hideArrow, setHideArrow] = createSignal(false)

  return (
    <main>
      <Tooltip openDelay={0}>
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
    </main>
  )
}

render(() => <Fixture />, document.body)
