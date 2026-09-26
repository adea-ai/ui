import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * InputGroup.
 *
 * A field with attached chrome: a leading icon, a unit, a trailing button, a
 * clear affordance. The point of the component is that the adornments and the
 * input share *one* border and *one* focus ring, so the group reads as a single
 * control. Two separate elements side by side always drift — the ring appears
 * on the wrong box, or the border doubles where they meet.
 *
 * The focus ring therefore lives on the group and follows `focus-within`. A
 * group containing several focusable things still reads as focused once, which
 * is the correct affordance: the user is somewhere inside it.
 */
export function InputGroup(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      data-slot="input-group"
      class={cn(
        'border-input flex h-control-md w-full min-w-0 items-center gap-1.5 rounded-md border bg-transparent px-control-sm',
        'transition-[color,box-shadow,border-color] ease-out',
        'focus-within:border-ring focus-within:ring-3 focus-within:ring-primary-subtle',
        'has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-3 has-[[aria-invalid=true]]:ring-destructive-subtle',
        'has-[input:disabled]:pointer-events-none has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50',
        local.class
      )}
      {...rest}
    />
  )
}

export function InputGroupInput(props: ComponentProps<'input'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <input
      data-slot="input-group-input"
      class={cn(
        'h-full min-w-0 flex-1 bg-transparent text-sm outline-none',
        'placeholder:text-muted-foreground',
        'disabled:cursor-not-allowed',
        local.class
      )}
      {...rest}
    />
  )
}

export type InputGroupAddonProps = ComponentProps<'span'> & {
  /** Which edge the adornment sits on; also sets the pointer-events rule. */
  align?: 'start' | 'end'
}

/**
 * A non-interactive adornment. `pointer-events-none` by default, because an
 * adornment that swallows a click makes the whole control feel dead just to
 * the left of the caret — the most annoying possible bug. Pass `align="end"`
 * and a real element when the adornment must be clickable.
 */
export function InputGroupAddon(props: InputGroupAddonProps) {
  const [local, rest] = splitProps(props, ['class', 'align', 'children'])

  return (
    <span
      data-slot="input-group-addon"
      class={cn(
        'text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm select-none',
        '[&_svg]:pointer-events-none [&_svg]:size-4',
        { 'order-first': local.align !== 'end', 'order-last': local.align === 'end' },
        local.class
      )}
      {...rest}
    >
      {local.children}
    </span>
  )
}

/** A clickable trailing button, sized to the group's height. */
export function InputGroupButton(props: ComponentProps<'button'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <button
      type="button"
      data-slot="input-group-button"
      class={cn(
        'text-muted-foreground -me-1 flex size-6 shrink-0 items-center justify-center rounded-sm',
        'transition-colors ease-out outline-none hover:bg-surface-hover hover:text-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:size-3.5',
        local.class
      )}
      {...rest}
    >
      {local.children}
    </button>
  )
}

/** Text that reads as a value but is not an input, e.g. a unit or a suffix. */
export function InputGroupText(props: ComponentProps<'span'> & { children?: JSX.Element }) {
  const [local, rest] = splitProps(props, ['class'])
  return <span class={cn('text-muted-foreground text-sm', local.class)} {...rest} />
}
