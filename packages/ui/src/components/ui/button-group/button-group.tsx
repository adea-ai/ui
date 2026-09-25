import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import { Separator } from '../separator/separator'

/**
 * ButtonGroup.
 *
 * Several controls acting as one. The point is the *join*: the items share a
 * border, collapse the seam between them, and round only at the ends, so a row of
 * buttons reads as a single object with segments rather than as buttons that happen
 * to be adjacent.
 *
 * The joining lives on the group, through child selectors, so an item never has to
 * know whether it sits at an end — which is also where the border collapse belongs.
 * A caller composing a group out of `Button`, `Select` and `InputGroup` therefore
 * gets the same treatment without those components knowing about it.
 *
 * The group is a `role="group"` with a label, because a screen reader announcing
 * four unrelated buttons where the sighted user sees one control is the failure
 * this prevents.
 */
export type ButtonGroupProps = ComponentProps<'div'> & {
  /** The group's accessible name. Required: a group with no name is announced as loose buttons. */
  label: string
  orientation?: 'horizontal' | 'vertical'
}

export function ButtonGroup(props: ButtonGroupProps) {
  const [local, rest] = splitProps(props, ['class', 'label', 'orientation', 'children'])

  const horizontal = () => local.orientation !== 'vertical'

  return (
    <div
      data-slot="button-group"
      role="group"
      aria-label={local.label}
      class={cn(
        'flex w-fit items-stretch',
        horizontal() ? 'flex-row' : 'flex-col',
        /* Ends keep their outer radius; everything between them is squared, and the
           seam is collapsed by pulling each item back over its neighbour's border. */
        horizontal()
          ? '[&>*:first-child]:rounded-e-none [&>*:last-child]:rounded-s-none [&>*:not(:first-child):not(:last-child)]:rounded-none [&>*:not(:first-child)]:-ms-px'
          : '[&>*:first-child]:rounded-b-none [&>*:last-child]:rounded-t-none [&>*:not(:first-child):not(:last-child)]:rounded-none [&>*:not(:first-child)]:-mt-px',
        local.class
      )}
      {...rest}
    >
      {local.children}
    </div>
  )
}

/**
 * A separator inside a group. `orientation` follows the group: a vertical rule in a
 * horizontal group, and the reverse.
 */
export function ButtonGroupSeparator(
  props: ComponentProps<typeof Separator> & { orientation?: 'horizontal' | 'vertical' }
) {
  const [local, rest] = splitProps(props, ['class', 'orientation'])

  return (
    <Separator
      orientation={local.orientation ?? 'vertical'}
      class={cn('self-stretch', local.class)}
      {...rest}
    />
  )
}

/**
 * Static text in a group — a unit, a label, a readout that is not a control. It
 * takes the group's border and height so it sits in the row as a peer, but it is
 * not focusable and does not pretend to be.
 */
export function ButtonGroupText(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      data-slot="button-group-text"
      class={cn(
        'bg-muted text-muted-foreground flex items-center gap-2 rounded-md border border-border px-control-sm text-sm',
        local.class
      )}
      {...rest}
    />
  )
}
