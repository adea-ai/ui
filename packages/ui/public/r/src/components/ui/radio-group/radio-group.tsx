import { RadioGroup as KobalteRadioGroup } from '@kobalte/core/radio-group'
import { Circle } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { useFormFieldControl } from '../../../lib/form-field'
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
  const [local, rest] = splitProps(props, [
    'class',
    'id',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-invalid',
    'aria-errormessage',
  ])
  const field = useFormFieldControl('group', {
    id: local.id,
    'aria-label': local['aria-label'],
    'aria-labelledby': local['aria-labelledby'],
    'aria-describedby': local['aria-describedby'],
    'aria-invalid': local['aria-invalid'],
    'aria-errormessage': local['aria-errormessage'],
  })
  return (
    <KobalteRadioGroup
      data-slot="radio-group"
      id={field?.id ?? local.id}
      aria-label={local['aria-label']}
      aria-labelledby={field?.['aria-labelledby'] ?? local['aria-labelledby']}
      aria-describedby={field?.['aria-describedby'] ?? local['aria-describedby']}
      aria-invalid={field?.['aria-invalid'] ?? local['aria-invalid']}
      aria-errormessage={field?.['aria-errormessage'] ?? local['aria-errormessage']}
      class={cn('grid gap-2', local.class)}
      {...rest}
    />
  )
}

export type RadioGroupItemProps = ComponentProps<typeof KobalteRadioGroup.Item> & {
  controlClass?: string
  /**
   * The option's visible label. A radio with no accessible name is unreachable
   * by a screen reader and by voice control, so supply this, a labelled child,
   * `aria-label`, or `aria-labelledby`.
   */
  label?: string
  description?: string
  /**
   * `card` draws the option as a bordered, selectable card — for a choice
   * whose options need a sentence each (a source type, a sync budget), where a
   * bare radio row reads as a form field rather than a decision. The whole card
   * is the hit target, and the selected card takes the primary edge.
   */
  variant?: 'default' | 'card'
  /** A leading icon or `EntityIcon` between the radio and the text, for `card`. */
  media?: JSX.Element
}

/**
 * A card option's label stretches an invisible layer over the whole card, so a
 * click anywhere on it — padding, media, description — selects the option
 * through the label's native association with the radio input. Wrapping the
 * card in a `<label>` would nest the item's own label inside another.
 */
export function RadioGroupItem(props: RadioGroupItemProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'controlClass',
    'label',
    'description',
    'variant',
    'media',
    'children',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-invalid',
    'aria-busy',
    'title',
  ])
  const card = () => local.variant === 'card'

  return (
    <KobalteRadioGroup.Item
      data-slot="radio-group-item"
      data-variant={card() ? 'card' : undefined}
      title={local.title}
      class={cn(
        'group/radio flex items-start gap-2.5',
        {
          'relative rounded-lg border border-border bg-card px-3 py-2.5 transition-[color,box-shadow,border-color,background-color] ease-out hover:bg-surface-hover data-[checked]:border-primary data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-card':
            card(),
          'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-primary-subtle':
            card(),
        },
        local.class
      )}
      {...rest}
    >
      <KobalteRadioGroup.ItemInput
        aria-label={local['aria-label']}
        aria-labelledby={local['aria-labelledby']}
        aria-describedby={local['aria-describedby']}
        aria-invalid={local['aria-invalid']}
        aria-busy={local['aria-busy']}
        title={local.title}
      />
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
      {local.media ? (
        <span data-slot="radio-group-item-media" class="flex shrink-0 items-center">
          {local.media}
        </span>
      ) : null}
      {local.children ?? (
        <div class="grid gap-0.5 leading-none">
          {local.label ? (
            <KobalteRadioGroup.ItemLabel
              class={cn('text-sm font-medium', card() && 'after:absolute after:inset-0')}
            >
              {local.label}
            </KobalteRadioGroup.ItemLabel>
          ) : null}
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
