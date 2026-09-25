import { Checkbox as KobalteCheckbox } from '@kobalte/core/checkbox'
import { Check, Minus } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Checkbox.
 *
 * Three states: unchecked, checked, and indeterminate. Indeterminate is what a
 * "select all" box shows when only some rows are selected; Kobalte expresses
 * it through `checked="indeterminate"` rather than a second boolean, so there
 * is no way to render a box that is both.
 *
 * The paint is `Control` and the value is a real hidden `Input`, so the control
 * participates in a form submission and in native validation while looking
 * nothing like a browser checkbox. Focus is tracked by the input, which is why
 * the ring lives on the control and reads the input's focus state.
 */
export type CheckboxProps = Omit<ComponentProps<typeof KobalteCheckbox>, 'children'> & {
  controlClass?: string
  labelClass?: string
  descriptionClass?: string
  /**
   * Replaces the control and label. Omit it to get the default control beside
   * `label` and `description`; supply it to compose the parts yourself.
   */
  children?: JSX.Element
}

export function Checkbox(props: CheckboxProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'controlClass',
    'labelClass',
    'descriptionClass',
    'children',
    'indeterminate',
    'aria-label',
    'aria-labelledby',
  ])

  return (
    <KobalteCheckbox class={cn('group/checkbox flex items-start gap-2.5', local.class)} {...rest}>
      {/*
       * The name goes on the input, which is what carries the value and takes
       * focus. On the Root it would land on a plain div and name nothing — the
       * box would announce its state with no subject.
       */}
      <KobalteCheckbox.Input
        aria-label={local['aria-label']}
        aria-labelledby={local['aria-labelledby']}
      />
      <KobalteCheckbox.Control
        class={cn(
          'border-input bg-transparent flex size-4 shrink-0 items-center justify-center rounded-sm border',
          'transition-[color,box-shadow,border-color,background-color] ease-out outline-none',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
          'data-[checked]:bg-primary data-[checked]:border-primary data-[checked]:text-primary-foreground',
          'data-[indeterminate]:bg-primary data-[indeterminate]:border-primary data-[indeterminate]:text-primary-foreground',
          'data-[invalid]:border-destructive data-[invalid]:ring-3 data-[invalid]:ring-destructive-subtle',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          local.controlClass
        )}
      >
        <KobalteCheckbox.Indicator class="flex items-center justify-center">
          {local.indeterminate ? <Minus class="size-3" /> : <Check class="size-3" />}
        </KobalteCheckbox.Indicator>
      </KobalteCheckbox.Control>
      {local.children ?? (
        <div class="grid gap-0.5 leading-none">
          <KobalteCheckbox.Label class={cn('text-sm font-medium', local.labelClass)} />
          <KobalteCheckbox.Description
            class={cn('text-muted-foreground text-sm', local.descriptionClass)}
          />
        </div>
      )}
    </KobalteCheckbox>
  )
}

/**
 * The box's own label. Valid only inside a `<Checkbox>`, for the same reason as
 * `SwitchLabel`: outside its root there is no control to associate with.
 */
export function CheckboxLabel(props: ComponentProps<typeof KobalteCheckbox.Label>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteCheckbox.Label class={cn('text-sm font-medium', local.class)} {...rest} />
}

export function CheckboxDescription(props: ComponentProps<typeof KobalteCheckbox.Description>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteCheckbox.Description
      class={cn('text-muted-foreground text-sm', local.class)}
      {...rest}
    />
  )
}
