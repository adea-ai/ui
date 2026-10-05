import {
  Show,
  createSignal,
  splitProps,
  type ComponentProps,
  type JSX,
  type ValidComponent,
} from 'solid-js'
import { Button, type ButtonProps } from '../../ui/button'
import { Spinner } from '../../ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'

/**
 * ActionButton.
 *
 * A Button with optional explanatory tooltip and busy feedback. Use it for a
 * simple action that needs these states; actions with product-specific rules
 * should compose Button directly.
 *
 * The tooltip trigger renders the polymorphic Button itself. A disabled native
 * control cannot receive pointer or keyboard events. When a tooltip is set,
 * disabled actions therefore use focusable `aria-disabled` semantics and guard
 * activation; without a tooltip, native buttons retain native disabling.
 * Custom polymorphic components must forward aria, event, and href props for
 * these guarantees to apply.
 */
export type ActionButtonProps<T extends ValidComponent = 'button'> = ButtonProps<T> & {
  /** A short explanation, also shown on keyboard focus. The Button still needs its own name. */
  tooltip?: string
  /** Placement of the explanation; icon actions live in bars, so it defaults below the control. */
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  /**
   * A leading icon repeated inside the explanation, forwarded to the shared
   * tooltip's `icon` slot so a bar of icon actions gets the icon+label tip
   * without hand-composing Button and Tooltip. Decorative by contract: the tip
   * is never the accessible name, so the icon must not carry meaning the label
   * lacks. Size it by leaving the svg bare; the slot fixes it to control size.
   */
  tooltipIcon?: JSX.Element
  /** Disables the action and announces the busy label through a polite status region. */
  busy?: boolean
  /** The activity announced while busy. The Button's accessible name stays unchanged. */
  busyLabel?: string
}

function invokeHandler(handler: unknown, event: Event) {
  if (Array.isArray(handler)) {
    const [callback, data] = handler as [(data: unknown, event: Event) => void, unknown]
    callback(data, event)
  } else if (typeof handler === 'function') {
    const callback = handler as (event: Event) => void
    callback(event)
  }
}

function chainedHandler(handler: unknown, before: (event: Event) => void) {
  return (event: Event) => {
    before(event)
    invokeHandler(handler, event)
  }
}

function guardedClick(
  handler: unknown,
  disabled: () => boolean,
  onActivate: (event: MouseEvent) => void = () => {}
) {
  return (event: MouseEvent) => {
    if (disabled()) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }

    onActivate(event)
    invokeHandler(handler, event)
  }
}

type ButtonTargetProps<T extends ValidComponent = 'button'> = Omit<ButtonProps<T>, 'as'> & {
  actionAs?: T
}

/** Adapter keeps TooltipTrigger's `as` separate from Button's polymorphic `as`. */
function ButtonTarget<T extends ValidComponent = 'button'>(props: ButtonTargetProps<T>) {
  const [local, rest] = splitProps(props as ButtonTargetProps, ['actionAs'])
  const PolymorphicButton = Button as (targetProps: ButtonProps<T>) => JSX.Element
  return <PolymorphicButton as={(local.actionAs ?? 'button') as T} {...(rest as ButtonProps<T>)} />
}

export function ActionButton<T extends ValidComponent = 'button'>(props: ActionButtonProps<T>) {
  const [local, rest] = splitProps(props as ActionButtonProps, [
    'as',
    'variant',
    'size',
    'touchTarget',
    'class',
    'children',
    'disabled',
    'aria-busy',
    'tooltip',
    'tooltipSide',
    'tooltipIcon',
    'busy',
    'busyLabel',
  ])
  const busy = () => local.busy ?? false
  const disabled = () => busy() || !!local.disabled
  const busyStatus = () => local.busyLabel ?? 'Working'
  const [tooltipOpen, setTooltipOpen] = createSignal(false)
  const [tooltipSuppression, setTooltipSuppression] = createSignal<'pointer' | 'focus' | null>(null)
  const onClickCapture = (rest as { onClickCapture?: unknown }).onClickCapture
  const PolymorphicButton = Button as (buttonProps: ButtonProps<T>) => JSX.Element
  const PolymorphicButtonTarget = ButtonTarget as (targetProps: ButtonTargetProps<T>) => JSX.Element

  const buttonProps = () => ({
    ...rest,
    variant: local.variant,
    size: local.size,
    touchTarget: local.touchTarget,
    class: [local.class, local.tooltip && disabled() && 'aria-disabled:pointer-events-auto']
      .filter(Boolean)
      .join(' '),
    disabled: disabled() && !local.tooltip,
    'aria-disabled': disabled() ? true : rest['aria-disabled'],
    // Make tooltip-bearing native controls explicit tab stops in WebKit configurations that
    // otherwise skip implicit button stops. A caller's tabIndex remains authoritative.
    tabIndex:
      rest.tabIndex ??
      (local.as === 'a' && disabled() ? (local.tooltip ? 0 : -1) : local.tooltip ? 0 : undefined),
    role: local.as === 'a' && disabled() ? 'link' : rest.role,
    href: local.as === 'a' && disabled() ? undefined : (rest as { href?: string }).href,
    'aria-busy': busy() || local['aria-busy'],
    onClick: guardedClick(rest.onClick, disabled, (event) => {
      if (!local.tooltip) return
      setTooltipSuppression(event.detail > 0 ? 'pointer' : 'focus')
      setTooltipOpen(false)
    }),
    onPointerLeave: chainedHandler(rest.onPointerLeave, () => {
      if (tooltipSuppression() === 'pointer') setTooltipSuppression(null)
    }),
    onBlur: chainedHandler(rest.onBlur, () => {
      if (tooltipSuppression() === 'focus') setTooltipSuppression(null)
    }),
    onClickCapture: onClickCapture ? guardedClick(onClickCapture, disabled) : undefined,
    'on:click': guardedClick((rest as Record<string, unknown>)['on:click'], disabled),
    'oncapture:click': guardedClick((rest as Record<string, unknown>)['oncapture:click'], disabled),
  })

  const contents = () => (
    <>
      <Show when={busy()}>
        <Spinner size="sm" label={false} aria-hidden="true" data-icon="inline-start" />
      </Show>
      {local.children}
    </>
  )

  return (
    <>
      <Show
        when={local.tooltip}
        fallback={
          <PolymorphicButton
            as={(local.as ?? 'button') as T}
            {...(buttonProps() as unknown as ButtonProps<T>)}
          >
            {contents()}
          </PolymorphicButton>
        }
      >
        <Tooltip
          placement={local.tooltipSide ?? 'bottom'}
          open={tooltipOpen()}
          onOpenChange={(open) => {
            if (open && tooltipSuppression()) return
            setTooltipOpen(open)
          }}
        >
          <TooltipTrigger
            as={PolymorphicButtonTarget}
            {...(buttonProps() as unknown as ComponentProps<typeof PolymorphicButtonTarget>)}
            actionAs={(local.as ?? 'button') as T}
          >
            {contents()}
          </TooltipTrigger>
          <TooltipContent icon={local.tooltipIcon}>{local.tooltip}</TooltipContent>
        </Tooltip>
      </Show>
      <Show when={busy()}>
        <span role="status" aria-live="polite" class="visually-hidden">
          {busyStatus()}
        </span>
      </Show>
    </>
  )
}
