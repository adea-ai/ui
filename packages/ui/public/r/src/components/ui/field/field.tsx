import { TextField as KobalteTextField } from '@kobalte/core/text-field'
import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * Field.
 *
 * The wrapper that makes a form control describable and validatable: a label,
 * a description, an error message, and the ARIA relationships between them.
 *
 * It is built on Kobalte's TextField specifically so `aria-describedby`,
 * `aria-invalid` and `aria-errormessage` are wired by construction. Those three
 * attributes are the difference between "this field is required and empty" and
 * a red border that only a sighted user can perceive — and they are also the
 * first thing a hand-rolled form drops.
 *
 * `Field` owns the description and the error slot, so a form's controls line up
 * and its messages land in the same place regardless of which control is used.
 * Compose it with any control: `Field` wraps, `Label`/`Input`/`Select` fill it.
 */
export function Field(props: ComponentProps<typeof KobalteTextField>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteTextField class={cn('flex flex-col gap-1.5', local.class)} {...rest} />
}

export function FieldLabel(props: ComponentProps<typeof KobalteTextField.Label>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteTextField.Label class={cn('text-sm leading-none font-medium', local.class)} {...rest} />
  )
}

export function FieldDescription(props: ComponentProps<typeof KobalteTextField.Description>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteTextField.Description
      class={cn('text-muted-foreground text-sm', local.class)}
      {...rest}
    />
  )
}

export function FieldError(props: ComponentProps<typeof KobalteTextField.ErrorMessage>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteTextField.ErrorMessage class={cn('text-destructive text-sm', local.class)} {...rest} />
  )
}

export function FieldInput(props: ComponentProps<typeof KobalteTextField.Input>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteTextField.Input
      class={cn(
        'h-control-md w-full min-w-0 rounded-md border border-input bg-transparent px-control-md py-1 text-sm',
        'transition-[color,box-shadow,border-color] ease-out outline-none',
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive-subtle',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        local.class
      )}
      {...rest}
    />
  )
}

export function FieldTextArea(props: ComponentProps<typeof KobalteTextField.TextArea>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteTextField.TextArea
      class={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-control-md py-2 text-sm',
        'transition-[color,box-shadow,border-color] ease-out outline-none resize-y',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive-subtle',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        local.class
      )}
      {...rest}
    />
  )
}

/**
 * A labelled group of fields with a single legend, for a real `<fieldset>`.
 * Grouping is what lets a screen reader announce "Shipping address, group"
 * before reading the four fields inside it.
 */
export function FieldSet(props: ComponentProps<'fieldset'>) {
  const [local, rest] = splitProps(props, ['class'])
  return <fieldset class={cn('flex flex-col gap-4', local.class)} {...rest} />
}

export function FieldLegend(props: ComponentProps<'legend'> & { variant?: 'legend' | 'label' }) {
  const [local, rest] = splitProps(props, ['class', 'variant'])
  return (
    <legend
      class={cn(
        'mb-1',
        local.variant === 'label'
          ? 'text-sm font-medium'
          : 'text-base font-semibold tracking-tight',
        local.class
      )}
      {...rest}
    />
  )
}

/** A horizontal rule with a word in it, for "or continue with" separators. */
export function FieldSeparator(props: {
  class?: string
  children?: ComponentProps<'span'>['children']
}) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <div class={cn('relative flex items-center gap-3 py-1', local.class)} {...rest}>
      <span class="bg-border h-px flex-1" />
      <Show when={local.children}>
        <span class="text-muted-foreground text-2xs tracking-wide uppercase">{local.children}</span>
      </Show>
      <span class="bg-border h-px flex-1" />
    </div>
  )
}
