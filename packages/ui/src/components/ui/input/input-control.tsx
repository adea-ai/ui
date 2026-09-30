import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * InputControl.
 *
 * A styled native input with no optional suggestion-list behavior. Use this
 * when a consumer needs only the control; `Input` adds native datalist
 * suggestions for forms that need them.
 */
export type InputControlProps = ComponentProps<'input'>

export function InputControl(props: InputControlProps) {
  const [local, rest] = splitProps(props, ['class', 'type'])

  return (
    <input
      data-slot="input"
      type={local.type ?? 'text'}
      class={cn(
        'h-control-md w-full min-w-0 rounded-md border border-input bg-transparent px-control-md py-1 text-sm',
        'transition-[color,box-shadow,border-color] ease-out outline-none',
        'placeholder:text-muted-foreground',
        'selection:bg-primary selection:text-primary-foreground',
        'file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        /* A pointer click on a text field is a typing affordance, so the ring
         appears where the user agent already matches :focus-visible. */
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive-subtle',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'read-only:bg-surface-hover',
        local.class
      )}
      {...rest}
    />
  )
}
