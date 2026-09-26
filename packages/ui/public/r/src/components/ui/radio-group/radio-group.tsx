import { RadioGroup as KobalteRadioGroup } from '@kobalte/core/radio-group'
import { Circle } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * RadioGroup.
 *
 * A single choice from a small, visible set. The group owns the value and the
 * arrow-key navigation, so a caller sets `value` once instead of wiring a
 * `name` and a handler onto every item.
 *
 * Below about five options a Select hides the choices behind a click, which is
 * the wrong trade; above about seven, radios become a wall and the Select wins.
 * That call belongs to the caller, and both controls are drawn from the same
 * tokens so either choice sits correctly next to the other.
 */
export function RadioGroup(props: ComponentProps<typeof KobalteRadioGroup>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteRadioGroup class={cn('grid gap-2', local.class)} {...rest} />
}

export type RadioGroupItemProps = ComponentProps<typeof KobalteRadioGroup.Item> & {
  controlClass?: string
  /**
   * The option's visible label. A radio with no accessible name is unreachable
   * by a screen reader and by voice control, so supply this or a child.
   */
  label?: string
  description?: string
}

export function RadioGroupItem(props: RadioGroupItemProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'controlClass',
    'label',
    'description',
    'children',
  ])

  return (
    <KobalteRadioGroup.Item
      class={cn('group/radio flex items-start gap-2.5', local.class)}
      {...rest}
    >
      <KobalteRadioGroup.ItemInput />
      <KobalteRadioGroup.ItemControl
        class={cn(
          'border-input bg-transparent flex size-4 shrink-0 items-center justify-center rounded-full border',
          'transition-[color,box-shadow,border-color,background-color] ease-out outline-none',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
          'data-[checked]:border-primary data-[checked]:text-primary',
          'data-[invalid]:border-destructive data-[invalid]:ring-3 data-[invalid]:ring-destructive-subtle',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          local.controlClass
        )}
      >
        <KobalteRadioGroup.ItemIndicator class="flex items-center justify-center">
          <Circle class="size-2 fill-current" />
        </KobalteRadioGroup.ItemIndicator>
      </KobalteRadioGroup.ItemControl>
      {local.children ?? (
        <div class="grid gap-0.5 leading-none">
          <KobalteRadioGroup.ItemLabel class="text-sm font-medium">
            {local.label}
          </KobalteRadioGroup.ItemLabel>
          {local.description ? (
            <KobalteRadioGroup.ItemDescription class="text-muted-foreground text-sm">
              {local.description}
            </KobalteRadioGroup.ItemDescription>
          ) : null}
        </div>
      )}
    </KobalteRadioGroup.Item>
  )
}
