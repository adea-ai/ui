import { Show, splitProps, type ComponentProps, type JSX, type ValidComponent } from 'solid-js'
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
 * button cannot receive pointer or keyboard events, so explanatory text for a
 * disabled action should remain visible beside it rather than relying on a
 * tooltip.
 */
export type ActionButtonProps<T extends ValidComponent = 'button'> = ButtonProps<T> & {
  /** A short explanation, also shown on keyboard focus. The Button still needs its own name. */
  tooltip?: string
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  /** Disables the action and announces the busy label through a polite status region. */
  busy?: boolean
  /** The activity announced while busy. The Button's accessible name stays unchanged. */
  busyLabel?: string
}

function guardedClick(handler: unknown, disabled: () => boolean) {
  return (event: MouseEvent) => {
    if (disabled()) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }

    if (Array.isArray(handler)) {
      const [callback, data] = handler as [(data: unknown, event: MouseEvent) => void, unknown]
      callback(data, event)
    } else if (typeof handler === 'function') {
      const callback = handler as (event: MouseEvent) => void
      callback(event)
    }
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
    'class',
    'children',
    'disabled',
    'aria-busy',
    'tooltip',
    'tooltipSide',
    'busy',
    'busyLabel',
  ])
  const busy = () => local.busy ?? false
  const disabled = () => busy() || !!local.disabled
  const busyStatus = () => local.busyLabel ?? 'Working'
  const PolymorphicButton = Button as (buttonProps: ButtonProps<T>) => JSX.Element
  const PolymorphicButtonTarget = ButtonTarget as (targetProps: ButtonTargetProps<T>) => JSX.Element

  const buttonProps = () => ({
    ...rest,
    variant: local.variant,
    size: local.size,
    class: local.class,
    disabled: disabled(),
    'aria-disabled': local.as === 'a' && disabled() ? true : rest['aria-disabled'],
    tabIndex: local.as === 'a' && disabled() ? -1 : rest.tabIndex,
    role: local.as === 'a' && disabled() ? 'link' : rest.role,
    href: local.as === 'a' && disabled() ? undefined : (rest as { href?: string }).href,
    'aria-busy': busy() || local['aria-busy'],
    onClick: guardedClick(rest.onClick, disabled),
    onClickCapture: guardedClick((rest as { onClickCapture?: unknown }).onClickCapture, disabled),
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
        when={local.tooltip && !disabled()}
        fallback={
          <PolymorphicButton
            as={(local.as ?? 'button') as T}
            {...(buttonProps() as unknown as ButtonProps<T>)}
          >
            {contents()}
          </PolymorphicButton>
        }
      >
        <Tooltip>
          <TooltipTrigger
            as={PolymorphicButtonTarget}
            {...(buttonProps() as unknown as ComponentProps<typeof PolymorphicButtonTarget>)}
            actionAs={(local.as ?? 'button') as T}
          >
            {contents()}
          </TooltipTrigger>
          <TooltipContent side={local.tooltipSide}>{local.tooltip}</TooltipContent>
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
