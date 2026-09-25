import { Tooltip as KobalteTooltip } from '@kobalte/core/tooltip'
import type { ComponentProps } from 'solid-js'
import { createContext, splitProps, useContext } from 'solid-js'
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

  return (
    <KobalteTooltip
      openDelay={props.openDelay ?? timing.openDelay}
      closeDelay={props.closeDelay ?? timing.closeDelay}
      skipDelayDuration={props.skipDelayDuration ?? timing.skipDelayDuration}
      {...props}
    />
  )
}

export function TooltipTrigger(props: ComponentProps<typeof KobalteTooltip.Trigger>) {
  return <KobalteTooltip.Trigger {...props} />
}

export type TooltipContentProps = ComponentProps<typeof KobalteTooltip.Content> & {
  /** Hide the caret pointing at the trigger. */
  hideArrow?: boolean
}

export function TooltipContent(props: TooltipContentProps) {
  const [local, rest] = splitProps(props, ['class', 'hideArrow', 'children'])

  return (
    <KobalteTooltip.Portal>
      <KobalteTooltip.Content
        class={cn(
          'bg-scrim text-scrim-foreground z-(--z-tooltip) w-fit max-w-64 rounded-md px-2 py-1 text-xs',
          'origin-(--kb-tooltip-content-transform-origin) text-balance',
          'data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95',
          'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          'data-expanded:duration-150 data-closed:duration-100',
          local.class
        )}
        {...rest}
      >
        {local.children}
        <KobalteTooltip.Arrow />
      </KobalteTooltip.Content>
    </KobalteTooltip.Portal>
  )
}
