import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { MoreHorizontal, Plus } from 'lucide-solid'
import { ActionButton } from '../../src/components/composites/action-button/action-button'
import { Button } from '../../src/components/ui/button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../src/components/ui/dropdown-menu/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from '../../src/components/ui/popover/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../src/components/ui/tooltip/tooltip'
import '../../src/styles/globals.css'

const documentPointerMoveListeners = new Set<EventListenerOrEventListenerObject>()
const windowScrollListeners = new Set<EventListenerOrEventListenerObject>()
const popperPositioningScrollListeners = new Set<EventListenerOrEventListenerObject>()
const [activeTooltipListeners, setActiveTooltipListeners] = createSignal('0 document / 0 window')
const [activePopperPositioningListeners, setActivePopperPositioningListeners] = createSignal(0)
const documentAddEventListener = document.addEventListener.bind(document)
const documentRemoveEventListener = document.removeEventListener.bind(document)
const windowAddEventListener = window.addEventListener.bind(window)
const windowRemoveEventListener = window.removeEventListener.bind(window)

function updateTooltipListenerCount() {
  setActiveTooltipListeners(
    `${documentPointerMoveListeners.size} document / ${windowScrollListeners.size} window`
  )
  setActivePopperPositioningListeners(popperPositioningScrollListeners.size)
}

document.addEventListener = ((
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
) => {
  if (type === 'pointermove' && listener) {
    documentPointerMoveListeners.add(listener)
    updateTooltipListenerCount()
  }
  documentAddEventListener(type, listener, options)
}) as typeof document.addEventListener
document.removeEventListener = ((
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | EventListenerOptions
) => {
  if (type === 'pointermove' && listener) {
    documentPointerMoveListeners.delete(listener)
    updateTooltipListenerCount()
  }
  documentRemoveEventListener(type, listener, options)
}) as typeof document.removeEventListener
window.addEventListener = ((
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
) => {
  if (type === 'scroll' && listener) {
    // Kobalte's Popper keeps Floating UI autoUpdate scroll listeners for its
    // mounted positioner. Track those separately from the dismissal listeners
    // that must be removed when tooltips close.
    if ((new Error().stack ?? '').includes('autoUpdate')) {
      popperPositioningScrollListeners.add(listener)
    } else {
      windowScrollListeners.add(listener)
    }
    updateTooltipListenerCount()
  }
  windowAddEventListener(type, listener, options)
}) as typeof window.addEventListener
window.removeEventListener = ((
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | EventListenerOptions
) => {
  if (type === 'scroll' && listener) {
    windowScrollListeners.delete(listener)
    popperPositioningScrollListeners.delete(listener)
    updateTooltipListenerCount()
  }
  windowRemoveEventListener(type, listener, options)
}) as typeof window.removeEventListener

function Fixture() {
  const [busy, setBusy] = createSignal(true)
  const [statusOpen, setStatusOpen] = createSignal(false)
  const [activations, setActivations] = createSignal(0)
  const [rejectedTooltipRequests, setRejectedTooltipRequests] = createSignal(0)
  const [controlledTooltipOpen, setControlledTooltipOpen] = createSignal(false)
  const [controlledCloseAccepted, setControlledCloseAccepted] = createSignal(false)
  const [controlledCloseRequests, setControlledCloseRequests] = createSignal(0)
  const [handoffTooltipsMounted, setHandoffTooltipsMounted] = createSignal(true)
  const captureClickProps = {
    'oncapture:click': () => setActivations((count) => count + 1),
  }

  return (
    <main>
      <h1 class="visually-hidden">Action button test page</h1>
      <section
        aria-label="Comfortable touch target examples"
        class="flex max-w-full flex-wrap gap-2"
      >
        <Button
          id="touch-target-plain"
          size="icon-md"
          touchTarget="comfortable"
          aria-label="Plain action"
        >
          <Plus />
        </Button>
        <ActionButton
          id="touch-target-tooltip"
          size="icon-md"
          touchTarget="comfortable"
          aria-label="Tooltip action"
          tooltip="Open action details"
          tooltipIcon={<Plus />}
        >
          <Plus />
        </ActionButton>
        <ActionButton
          as="a"
          id="touch-target-polymorphic-tooltip"
          href="#comfortable-link"
          size="icon-md"
          touchTarget="comfortable"
          aria-label="Polymorphic tooltip link"
          tooltip="Open the linked action details"
        >
          <Plus />
        </ActionButton>
        <DropdownMenu>
          <DropdownMenuTrigger
            as={Button}
            id="touch-target-menu-trigger"
            size="icon-md"
            touchTarget="comfortable"
            aria-label="Open comfortable menu"
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent hideArrow>
            <DropdownMenuItem>Open settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </section>
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
      <Tooltip open={false} onOpenChange={() => setRejectedTooltipRequests((count) => count + 1)}>
        <TooltipTrigger as={Button} aria-label="Rejected tooltip trigger">
          Rejected tooltip
        </TooltipTrigger>
        <TooltipContent>Rejected tooltip content</TooltipContent>
      </Tooltip>
      <Show when={handoffTooltipsMounted()}>
        <Tooltip
          open={controlledTooltipOpen()}
          onOpenChange={(open) => {
            if (open) {
              setControlledTooltipOpen(true)
            } else {
              setControlledCloseRequests((count) => count + 1)
              if (controlledCloseAccepted()) setControlledTooltipOpen(false)
            }
          }}
        >
          <TooltipTrigger as={Button} aria-label="Controlled tooltip handoff source">
            Controlled tooltip
          </TooltipTrigger>
          <TooltipContent>Controlled tooltip help</TooltipContent>
        </Tooltip>
        <ActionButton aria-label="Tooltip handoff target" tooltip="Handoff target help">
          Handoff target
        </ActionButton>
      </Show>
      <button type="button" onClick={() => setHandoffTooltipsMounted(false)}>
        Unmount tooltip handoff fixture
      </button>
      <button
        type="button"
        onClick={() => {
          setControlledCloseAccepted(true)
          setControlledTooltipOpen(false)
        }}
      >
        Accept tooltip close
      </button>
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
      <output aria-label="Rejected tooltip requests">{rejectedTooltipRequests()}</output>
      <output aria-label="Controlled tooltip close requests">{controlledCloseRequests()}</output>
      <output aria-label="Active tooltip dismissal listeners">{activeTooltipListeners()}</output>
      <output aria-label="Active popper positioning listeners">
        {activePopperPositioningListeners()}
      </output>
      <input aria-label="Start tooltip button focus order" size={10} />
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
        Action
      </ActionButton>
    </main>
  )
}

render(() => <Fixture />, document.body)
