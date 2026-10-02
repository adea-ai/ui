import { Tooltip as KobalteTooltip, useTooltipContext } from '@kobalte/core/tooltip'
import type { ComponentProps } from 'solid-js'
import {
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  splitProps,
  useContext,
} from 'solid-js'
import { isServer } from 'solid-js/web'
import { tooltipTip } from '#lib/overlay'
import { cn } from '#lib/utils'

/**
 * The provider sets the *timing* defaults for every tooltip below it.
 *
 * Timing is the part of a tooltip that has to agree across an app: one that
 * opens in 200ms in a toolbar and 700ms in a sidebar reads as a bug. The
 * provider is where that agreement lives. It is optional — a tooltip outside a
 * provider falls back to the same defaults — so a consumer can drop it in
 * without restructuring anything.
 */
type TooltipTiming = {
  openDelay: number
  closeDelay: number
  skipDelayDuration: number
}

const tooltipDefaults: TooltipTiming = {
  /** Long enough that a pointer crossing a toolbar does not strobe tooltips. */
  openDelay: 400,
  /** Short, because the pointer has already left the control. */
  closeDelay: 80,
  /**
   * After a tooltip has been seen, the next one opens immediately for this
   * long. This is what makes moving along a row of icons feel like one
   * gesture instead of four separate waits.
   */
  skipDelayDuration: 500,
}

const TooltipTimingContext = createContext<TooltipTiming>(tooltipDefaults)

type TooltipInteraction = {
  id: string
  trigger: () => HTMLElement | undefined
  setTrigger: (element: HTMLElement) => void
  isOpen: () => boolean
  isDisabled: () => boolean
  isTriggerFocused: () => boolean
  markOpenIntent: () => void
  clearOpenIntent: () => void
  requestCloseFromAnotherTooltip: () => void
  markPointerCloseIntent: () => void
  clearPointerCloseIntent: () => void
  markCloseIntent: () => void
}

const TooltipInteractionContext = createContext<TooltipInteraction>()
const openTooltipInteractions = new Set<TooltipInteraction>()
let pendingTooltipOpenId: string | undefined
let tooltipScrollListenerAttached = false

function clearPendingTooltipOpen(id: string) {
  if (pendingTooltipOpenId === id) pendingTooltipOpenId = undefined
}

function tooltipScrollContainsTrigger(event: Event, trigger: HTMLElement) {
  const target = event.target
  return target === window || (target instanceof Node && target.contains(trigger))
}

function handleTooltipScroll(event: Event) {
  for (const interaction of openTooltipInteractions) {
    const trigger = interaction.trigger()
    if (interaction.isOpen() && trigger && tooltipScrollContainsTrigger(event, trigger)) {
      interaction.markCloseIntent()
    }
  }
}

function handleTooltipPointerMove(event: PointerEvent) {
  for (const interaction of openTooltipInteractions) {
    const trigger = interaction.trigger()
    const target = event.target
    if (
      interaction.isOpen() &&
      interaction.isTriggerFocused() &&
      trigger &&
      !(target instanceof Node && trigger.contains(target))
    ) {
      interaction.markPointerCloseIntent()
    }
  }
}

function setTooltipInteractionOpen(interaction: TooltipInteraction, open: boolean) {
  if (isServer) return

  if (open) {
    if (openTooltipInteractions.has(interaction)) return
    openTooltipInteractions.add(interaction)
    if (!tooltipScrollListenerAttached) {
      tooltipScrollListenerAttached = true
      // Register before Kobalte's global listeners so intentional scroll
      // dismissal can be distinguished from its delayed pointer dismissal.
      window.addEventListener('scroll', handleTooltipScroll, true)
      document.addEventListener('pointermove', handleTooltipPointerMove, true)
    }
  } else {
    openTooltipInteractions.delete(interaction)
    if (openTooltipInteractions.size === 0 && tooltipScrollListenerAttached) {
      tooltipScrollListenerAttached = false
      window.removeEventListener('scroll', handleTooltipScroll, true)
      document.removeEventListener('pointermove', handleTooltipPointerMove, true)
    }
  }
}

function registerTooltipInteraction(interaction: TooltipInteraction) {
  onCleanup(() => {
    setTooltipInteractionOpen(interaction, false)
    clearPendingTooltipOpen(interaction.id)
  })
}

function invokeEventHandler(handler: unknown, event: Event) {
  if (Array.isArray(handler)) {
    const [callback, data] = handler as [(data: unknown, event: Event) => void, unknown]
    callback(data, event)
  } else if (typeof handler === 'function') {
    const callback = handler as (event: Event) => void
    callback(event)
  }
}

export type TooltipProviderProps = {
  children?: ComponentProps<'div'>['children']
  openDelay?: number
  closeDelay?: number
  skipDelayDuration?: number
}

export function TooltipProvider(props: TooltipProviderProps) {
  return (
    <TooltipTimingContext.Provider
      value={{
        openDelay: props.openDelay ?? tooltipDefaults.openDelay,
        closeDelay: props.closeDelay ?? tooltipDefaults.closeDelay,
        skipDelayDuration: props.skipDelayDuration ?? tooltipDefaults.skipDelayDuration,
      }}
    >
      {props.children}
    </TooltipTimingContext.Provider>
  )
}

export type TooltipRootProps = ComponentProps<typeof KobalteTooltip>

export function Tooltip(props: TooltipRootProps) {
  const timing = useContext(TooltipTimingContext)
  const [local, rest] = splitProps(props, ['open', 'defaultOpen', 'onOpenChange', 'disabled'])
  const id = createUniqueId()
  const controlled = () => local.open !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(local.defaultOpen ?? false)
  const isOpen = () => (controlled() ? (local.open ?? false) : uncontrolledOpen())
  const [trigger, setTrigger] = createSignal<HTMLElement>()
  let closeIntent = false
  let ignoreDuplicateClose = false
  let onOpenChange: (next: boolean, source?: 'handoff') => void
  let pointerCloseIntentUntil = 0
  let pointerCloseIntentTimeout: ReturnType<typeof setTimeout> | undefined
  const clearPointerCloseIntent = () => {
    pointerCloseIntentUntil = 0
    if (pointerCloseIntentTimeout) clearTimeout(pointerCloseIntentTimeout)
    pointerCloseIntentTimeout = undefined
  }
  const markPointerCloseIntent = () => {
    if (!isOpen()) return
    clearPointerCloseIntent()
    const closeDelay = props.closeDelay ?? timing.closeDelay
    pointerCloseIntentUntil = Date.now() + closeDelay + 50
    pointerCloseIntentTimeout = setTimeout(clearPointerCloseIntent, closeDelay + 50)
  }
  const markCloseIntent = () => {
    closeIntent = true
    clearPointerCloseIntent()
    queueMicrotask(() => {
      closeIntent = false
    })
  }
  const requestCloseFromAnotherTooltip = () => {
    if (!isOpen()) return

    // Another trigger is an explicit handoff, even when a focused tooltip has
    // a pending pointer-close intent that would otherwise suppress Kobalte's
    // close callback. Route the request through the same controlled/uncontrolled
    // state contract as Kobalte and ignore its duplicate callback for this turn.
    ignoreDuplicateClose = true
    queueMicrotask(() => {
      ignoreDuplicateClose = false
    })
    onOpenChange(false, 'handoff')
  }
  const interaction: TooltipInteraction = {
    id,
    trigger,
    setTrigger,
    isOpen,
    isDisabled: () => local.disabled ?? false,
    isTriggerFocused: () =>
      Boolean(trigger() && typeof document !== 'undefined' && trigger() === document.activeElement),
    markOpenIntent: () => {
      clearPointerCloseIntent()
      pendingTooltipOpenId = id
      // A focused tooltip ignores ordinary pointer movement, but entering or
      // focusing another tooltip is an explicit transfer.
      for (const openInteraction of openTooltipInteractions) {
        if (openInteraction.id !== id) openInteraction.requestCloseFromAnotherTooltip()
      }
    },
    clearOpenIntent: () => clearPendingTooltipOpen(id),
    requestCloseFromAnotherTooltip,
    markPointerCloseIntent,
    clearPointerCloseIntent,
    markCloseIntent,
  }
  registerTooltipInteraction(interaction)
  onCleanup(() => {
    clearPointerCloseIntent()
    ignoreDuplicateClose = false
  })
  if (isOpen()) setTooltipInteractionOpen(interaction, true)
  createEffect(() => setTooltipInteractionOpen(interaction, isOpen()))
  onOpenChange = (next: boolean, source) => {
    if (!next && source !== 'handoff' && ignoreDuplicateClose) return

    if (next) {
      clearPendingTooltipOpen(id)
      clearPointerCloseIntent()
      // Install this capture listener before Kobalte's open-state effect adds
      // its scroll listener later in the same update.
      setTooltipInteractionOpen(interaction, true)
    } else {
      const focusedTrigger = interaction.isTriggerFocused()
      const anotherTooltipOpening =
        pendingTooltipOpenId !== undefined && pendingTooltipOpenId !== id
      const pointerClosePending = Date.now() <= pointerCloseIntentUntil
      if (
        source !== 'handoff' &&
        focusedTrigger &&
        pointerClosePending &&
        !closeIntent &&
        !anotherTooltipOpening
      ) {
        clearPointerCloseIntent()
        return
      }
      closeIntent = false
      clearPointerCloseIntent()
      clearPendingTooltipOpen(id)
    }

    if (!controlled()) setUncontrolledOpen(next)
    local.onOpenChange?.(next)
    if (next) {
      // A controlled parent can reject the open request without changing its
      // signal, so the effect above would not rerun to release this listener.
      queueMicrotask(() => {
        if (!isOpen()) setTooltipInteractionOpen(interaction, false)
      })
    }
  }

  // Kobalte dismisses on Escape only when its content owns the top-most
  // layer, and a handoff keeps the previous tooltip's content mounted while
  // it exits — swallowing the key for the tooltip that just took over.
  // Listening on document (capture) closes this tooltip first; the layer's
  // own handler still runs for anything stacked above it.
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    markCloseIntent()
    onOpenChange(false)
  }
  createEffect(() => {
    if (isServer || !isOpen()) return
    document.addEventListener('keydown', handleKeyDown, true)
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown, true))
  })

  return (
    <TooltipInteractionContext.Provider value={interaction}>
      <KobalteTooltip
        open={isOpen()}
        onOpenChange={onOpenChange}
        disabled={local.disabled}
        openDelay={props.openDelay ?? timing.openDelay}
        closeDelay={props.closeDelay ?? timing.closeDelay}
        skipDelayDuration={props.skipDelayDuration ?? timing.skipDelayDuration}
        {...rest}
      />
    </TooltipInteractionContext.Provider>
  )
}

export function TooltipTrigger(props: ComponentProps<typeof KobalteTooltip.Trigger>) {
  const interaction = useContext(TooltipInteractionContext)
  const [local, rest] = splitProps(props, [
    'ref',
    'onFocus',
    'onBlur',
    'onPointerEnter',
    'onPointerLeave',
    'onClick',
  ])

  return (
    <KobalteTooltip.Trigger
      {...rest}
      ref={(element) => {
        interaction?.setTrigger(element)
        if (typeof local.ref === 'function') local.ref(element)
      }}
      onFocus={(event) => {
        invokeEventHandler(local.onFocus, event)
        if (!event.defaultPrevented && !interaction?.isDisabled()) interaction?.markOpenIntent()
      }}
      onBlur={(event) => {
        invokeEventHandler(local.onBlur, event)
        interaction?.clearOpenIntent()
        interaction?.markCloseIntent()
      }}
      onPointerEnter={(event) => {
        invokeEventHandler(local.onPointerEnter, event)
        if (!event.defaultPrevented && !interaction?.isDisabled()) interaction?.markOpenIntent()
      }}
      onPointerLeave={(event) => {
        invokeEventHandler(local.onPointerLeave, event)
        interaction?.clearOpenIntent()
        interaction?.markPointerCloseIntent()
      }}
      onClick={(event) => {
        invokeEventHandler(local.onClick, event)
        interaction?.markCloseIntent()
      }}
    />
  )
}

export type TooltipContentProps = ComponentProps<typeof KobalteTooltip.Content>

export function TooltipContent(props: TooltipContentProps) {
  const interaction = useContext(TooltipInteractionContext)
  const [local, rest] = splitProps(props, [
    'class',
    'children',
    'aria-hidden',
    'onEscapeKeyDown',
    'onPointerDownOutside',
  ])
  const context = useTooltipContext()

  // Kobalte keeps force-mounted and exiting content present after close. Hide
  // that retained tooltip from assistive technology until it opens again.
  return (
    <KobalteTooltip.Portal>
      <KobalteTooltip.Content
        class={cn(
          tooltipTip,
          // The max width is a token, not a fixed measure: it has to fall
          // behind the viewport at large root font sizes or the tip — which
          // Kobalte can shift but never shrink — forces a horizontal scroll.
          'z-(--z-tooltip) w-fit max-w-(--tooltip-max-width) px-2 py-1',
          'origin-(--kb-tooltip-content-transform-origin) text-balance',
          'data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95',
          'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          'data-expanded:duration-150 data-closed:duration-100',
          local.class
        )}
        aria-hidden={context.isOpen() ? local['aria-hidden'] : true}
        onEscapeKeyDown={(event) => {
          invokeEventHandler(local.onEscapeKeyDown, event)
          if (!event.defaultPrevented) interaction?.markCloseIntent()
        }}
        onPointerDownOutside={(event) => {
          invokeEventHandler(local.onPointerDownOutside, event)
          if (!event.defaultPrevented) interaction?.markCloseIntent()
        }}
        {...rest}
      >
        {local.children}
      </KobalteTooltip.Content>
    </KobalteTooltip.Portal>
  )
}
