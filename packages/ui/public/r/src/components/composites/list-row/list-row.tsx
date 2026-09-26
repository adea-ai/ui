import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { Polymorphic } from '@kobalte/core/polymorphic'
import type { ComponentProps, JSX, ValidComponent } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * ListRow.
 *
 * One row in a list of like things: a project, a session, a file, a person. It
 * is the highest-frequency component in an application of this shape, and the
 * one where a half-pixel of drift is most visible — twenty rows of a sidebar
 * make any inconsistency in height or padding obvious.
 *
 * The structure is fixed at four slots — `leading`, `children`, `meta`,
 * `trailing` — so rows that show an avatar, an icon, a status dot, a timestamp
 * and an overflow menu all sit at the same height without the caller doing
 * arithmetic.
 *
 * A row is only interactive when it is given an `as` that can be activated
 * (an anchor, a button) or an `onClick`. Without either it renders as a
 * `div` with no hover treatment, because a hover state on something that does
 * nothing is a lie.
 */
export type ListRowProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  {
    class?: string
    /** Marks the row as current. Sets `aria-current` for a link row. */
    selected?: boolean
    /** Draw the row at the compact height. */
    dense?: boolean
    /** Leading slot: an avatar, an icon, a checkbox. */
    leading?: JSX.Element
    /** Trailing slot: a count, a menu trigger, a timestamp. */
    trailing?: JSX.Element
    /** A dimmed second line under the main content. */
    description?: string
  }
>

export function ListRow<T extends ValidComponent = 'div'>(props: ListRowProps<T>) {
  const [local, rest] = splitProps(props as ListRowProps, [
    'class',
    'selected',
    'dense',
    'leading',
    'trailing',
    'description',
    'children',
  ])

  return (
    <Polymorphic
      as="div"
      aria-current={local.selected ? 'true' : undefined}
      data-selected={local.selected ? '' : undefined}
      class={cn(
        'group/row flex min-w-0 items-center gap-2.5 rounded-md px-2 text-sm',
        'transition-colors ease-out outline-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        { 'h-row-sm': local.dense, 'h-row-md': !local.dense },
        {
          'bg-primary-subtle text-foreground': local.selected,
          'hover:bg-surface-hover': !local.selected,
        },
        local.class
      )}
      {...(rest as ComponentProps<'div'>)}
    >
      <Show when={local.leading}>
        <span class="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
          {local.leading}
        </span>
      </Show>
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate">{local.children}</span>
        <Show when={local.description}>
          <span class="text-muted-foreground truncate text-xs">{local.description}</span>
        </Show>
      </span>
      <Show when={local.trailing}>
        <span class="ms-auto flex shrink-0 items-center gap-1 text-muted-foreground">
          {local.trailing}
        </span>
      </Show>
    </Polymorphic>
  )
}

/**
 * A group of rows with an optional heading and a scrolling body. The heading is
 * a plain label rather than a control: grouping is for reading, and a
 * disclosure on a list of five rows costs more attention than it saves.
 */
export function ListGroup(props: ComponentProps<'div'> & { label?: string; action?: JSX.Element }) {
  const [local, rest] = splitProps(props, ['class', 'label', 'action', 'children'])

  return (
    <div data-slot="list-group" class={cn('flex flex-col gap-0.5', local.class)} {...rest}>
      <Show when={local.label}>
        <div class="group/list-header flex items-center gap-1 px-2 py-1">
          <span class="min-w-0 flex-1 truncate text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            {local.label}
          </span>
          <Show when={local.action}>
            <span class="shrink-0 opacity-0 transition-opacity ease-out group-hover/list-header:opacity-100 focus-within:opacity-100">
              {local.action}
            </span>
          </Show>
        </div>
      </Show>
      <div class="flex flex-col gap-0.5">{local.children}</div>
    </div>
  )
}
