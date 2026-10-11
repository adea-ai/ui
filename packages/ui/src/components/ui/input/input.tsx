import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { useFormFieldControl } from '#lib/form-field'
import { cn } from '#lib/utils'

/**
 * Input.
 *
 * Deliberately a plain `<input>` rather than a Kobalte TextField part. The
 * styling contract is what a consumer needs from an input; validation,
 * description and error wiring come from `Field`, which composes this. Keeping
 * them separate is what lets an input sit inside a custom control without
 * inheriting a form's ARIA graph.
 *
 * Height comes from `h-control-md`; an input cannot be given a new height
 * without a new token, which is what keeps it aligned with Button and Select.
 */
export function Input(props: ComponentProps<'input'>) {
  const [local, rest] = splitProps(props, [
    'class',
    'type',
    'id',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-invalid',
    'aria-errormessage',
  ])
  const field = useFormFieldControl('control', {
    id: local.id,
    'aria-label': local['aria-label'],
    'aria-labelledby': local['aria-labelledby'],
    'aria-describedby': local['aria-describedby'],
    'aria-invalid': local['aria-invalid'],
    'aria-errormessage': local['aria-errormessage'],
  })

  return (
    <input
      data-slot="input"
      type={local.type ?? 'text'}
      id={field?.id ?? local.id}
      aria-label={local['aria-label']}
      aria-labelledby={field?.['aria-labelledby'] ?? local['aria-labelledby']}
      aria-describedby={field?.['aria-describedby'] ?? local['aria-describedby']}
      aria-invalid={field?.['aria-invalid'] ?? local['aria-invalid']}
      aria-errormessage={field?.['aria-errormessage'] ?? local['aria-errormessage']}
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
