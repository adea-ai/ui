import { ToggleGroup as KobalteToggleGroup } from '@kobalte/core/toggle-group'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import type { VariantProps } from '../../../lib/variants'
import { cn } from '../../../lib/utils'
import { toggleVariants } from '../toggle/toggle'

/**
 * ToggleGroup.
 *
 * A set of related toggles that behave as one control: at most one pressed
 * (`multiple={false}`, the default) or any number (`multiple={true}`). The
 * group owns the selection and the roving focus, which is what makes arrow keys
 * move between items and a screen reader announce the position within the set.
 * A row of independent Toggles looks identical and does neither.
 *
 * `attached` joins the items into one rounded run for a segmented control. The
 * joining lives on the *group*, via child selectors, so an item never has to
 * know whether it sits at an end — which is also where the border collapse
 * (`-ms-px`) belongs.
 */
/**
 * `multiple` is optional here although Kobalte requires it: the primitive models
 * single and multiple selection as two shapes, which forces every caller to state
 * the obvious. Defaulting to single selection keeps the common case a one-word
 * component, and a caller that wants many passes `multiple`.
 */
export type ToggleGroupProps = Omit<ComponentProps<typeof KobalteToggleGroup>, 'multiple'> & {
  multiple?: boolean
  variant?: VariantProps<typeof toggleVariants>['variant']
  size?: VariantProps<typeof toggleVariants>['size']
  /** Join the items into one rounded run instead of a spaced row. */
  attached?: boolean
}

export function ToggleGroup(props: ToggleGroupProps) {
  const [local, rest] = splitProps(props, ['class', 'attached', 'multiple'])

  return (
    <KobalteToggleGroup
      multiple={local.multiple ?? false}
      class={cn(
        'flex w-fit flex-row items-center',
        local.attached
          ? '[&>*:first-child]:rounded-e-none [&>*:last-child]:rounded-s-none [&>*:not(:first-child):not(:last-child)]:rounded-none [&>*:not(:first-child)]:-ms-px'
          : 'gap-1',
        local.class
      )}
      {...rest}
    />
  )
}

export type ToggleGroupItemProps = ComponentProps<typeof KobalteToggleGroup.Item> &
  VariantProps<typeof toggleVariants>

export function ToggleGroupItem(props: ToggleGroupItemProps) {
  const [local, rest] = splitProps(props, ['class', 'variant', 'size'])

  return (
    <KobalteToggleGroup.Item
      class={cn(toggleVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    />
  )
}
