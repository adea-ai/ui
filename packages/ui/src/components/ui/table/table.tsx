import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Table.
 *
 * Semantic markup, not a grid of divs. A `<table>` with a caption, a header
 * scope and cells is navigable by a screen reader in ways a flex layout cannot
 * be reproduced into, and it is what makes "row 3 of 12, Name column" work.
 *
 * Two decisions worth keeping:
 *
 *   - The header is sticky by default. A scrollable table whose header leaves
 *     the viewport makes every row below it anonymous.
 *   - Numbers are right-aligned and tabular. `text-end` plus `tabular-nums` is
 *     what lets a column of figures be compared by eye; a proportional font
 *     with ragged digits is unreadable at a glance.
 *
 * `TableNumericCell` exists so callers do not have to remember the second
 * half of that rule.
 */
export function Table(props: ComponentProps<'table'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div data-slot="table-container" class="relative w-full overflow-x-auto">
      <table data-slot="table" class={cn('w-full caption-bottom text-sm', local.class)} {...rest} />
    </div>
  )
}

export function TableHeader(props: ComponentProps<'thead'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <thead
      data-slot="table-header"
      class={cn(
        '[&_tr]:border-b [&_tr]:border-border sticky top-0 z-(--z-docked) bg-background',
        local.class
      )}
      {...rest}
    />
  )
}

export function TableBody(props: ComponentProps<'tbody'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <tbody data-slot="table-body" class={cn('[&_tr:last-child]:border-0', local.class)} {...rest} />
  )
}

export function TableFooter(props: ComponentProps<'tfoot'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <tfoot
      data-slot="table-footer"
      class={cn(
        'bg-surface-hover border-t border-border font-medium [&>tr]:last:border-b-0',
        local.class
      )}
      {...rest}
    />
  )
}

export function TableRow(props: ComponentProps<'tr'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <tr
      data-slot="table-row"
      class={cn(
        'border-b border-border transition-colors ease-out',
        'hover:bg-surface-hover data-[state=selected]:bg-primary-subtle',
        local.class
      )}
      {...rest}
    />
  )
}

export function TableHead(props: ComponentProps<'th'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <th
      data-slot="table-head"
      scope={props.scope ?? 'col'}
      class={cn(
        'text-muted-foreground h-9 px-3 text-start align-middle text-xs font-medium whitespace-nowrap',
        local.class
      )}
      {...rest}
    />
  )
}

export function TableCell(props: ComponentProps<'td'>) {
  const [local, rest] = splitProps(props, ['class'])
  return <td data-slot="table-cell" class={cn('px-3 py-2 align-middle', local.class)} {...rest} />
}

export function TableNumericCell(props: ComponentProps<'td'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <td
      data-slot="table-cell"
      class={cn('px-3 py-2 text-end align-middle tabular-nums', local.class)}
      {...rest}
    />
  )
}

export function TableCaption(props: ComponentProps<'caption'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <caption
      data-slot="table-caption"
      class={cn('text-muted-foreground mt-3 text-sm', local.class)}
      {...rest}
    />
  )
}
