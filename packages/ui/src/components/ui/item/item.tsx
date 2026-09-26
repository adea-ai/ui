import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'

/**
 * Item.
 *
 * The general row: a leading slot, a body, and a trailing slot. It is the shape
 * almost every list in an application takes — a file, a member, a setting, a
 * search result — and it exists as a component because a row is where inconsistency
 * is most visible: twenty of them make any drift in height, padding or alignment
 * obvious at a glance.
 *
 * The difference from `ListRow` is what it is *for*. `ListRow` is one row in a list
 * of like things, sized by the row ladder and meant to be scanned down a column.
 * `Item` is a self-contained block — it has a border, its own surface, an optional
 * title and description — and is meant to stand alone or sit in a grid. A list uses
 * `ListRow`; a search result or a settings card uses `Item`.
 *
 * `variant="outline"` and `"muted"` exist because the two questions a caller
 * actually has are "does this need an edge" and "is it on the canvas or inset".
 */
export const itemVariants = cva('flex w-full items-center gap-3 rounded-lg text-sm', {
  variants: {
    variant: {
      default: 'bg-transparent',
      /** On the canvas, with an edge — the search-result shape. */
      outline: 'border border-border bg-card',
      /** Inset: a code well, a disabled row, a quoted message. */
      muted: 'bg-muted',
    },
    size: {
      sm: 'min-h-row-sm px-3 py-1.5',
      md: 'min-h-row-md px-3 py-2',
      lg: 'min-h-row-lg px-4 py-2.5',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

type ItemVariantProps = VariantProps<typeof itemVariants>

export type ItemProps = ComponentProps<'div'> &
  ItemVariantProps & {
    /** A media slot: an icon, an avatar, a thumbnail. */
    media?: JSX.Element
    /** A trailing slot: a badge, a timestamp, a menu trigger. */
    trailing?: JSX.Element
  }

export function Item(props: ItemProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'variant',
    'size',
    'media',
    'trailing',
    'children',
  ])

  return (
    <div
      data-slot="item"
      class={cn(itemVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    >
      <Show when={local.media}>
        <span
          data-slot="item-media"
          class="flex size-8 shrink-0 items-center justify-center [&_svg]:size-4"
        >
          {local.media}
        </span>
      </Show>
      <div data-slot="item-body" class="flex min-w-0 flex-1 flex-col gap-0.5">
        {local.children}
      </div>
      <Show when={local.trailing}>
        <span data-slot="item-trailing" class="flex shrink-0 items-center gap-2">
          {local.trailing}
        </span>
      </Show>
    </div>
  )
}

export function ItemTitle(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return <div data-slot="item-title" class={cn('truncate font-medium', local.class)} {...rest} />
}

export function ItemDescription(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="item-description"
      class={cn('text-muted-foreground line-clamp-2 text-xs text-pretty', local.class)}
      {...rest}
    />
  )
}

/**
 * A group of items with an optional heading. It is a real `role="list"` with
 * `role="listitem"` children, so a screen reader reports the count — which is how a
 * user knows how many results there are without counting them.
 */
export function ItemGroup(
  props: ComponentProps<'div'> & {
    label?: string
    /** The list's accessible name. */ listLabel?: string
  }
) {
  const [local, rest] = splitProps(props, ['class', 'label', 'listLabel', 'children'])

  return (
    <div data-slot="item-group" class={cn('flex flex-col gap-2', local.class)} {...rest}>
      <Show when={local.label}>
        <div class="text-muted-foreground text-2xs font-medium tracking-wide uppercase">
          {local.label}
        </div>
      </Show>
      <div role="list" aria-label={local.listLabel ?? local.label} class="flex flex-col gap-2">
        {local.children}
      </div>
    </div>
  )
}

/** An item inside an `ItemGroup`, which is what makes it a list item. */
export function ItemGroupEntry(props: ItemProps) {
  return <Item role="listitem" {...props} />
}

/** A centred message for a group with nothing in it. */
export function ItemEmpty(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="item-empty"
      class={cn('text-muted-foreground py-6 text-center text-sm', local.class)}
      {...rest}
    />
  )
}
