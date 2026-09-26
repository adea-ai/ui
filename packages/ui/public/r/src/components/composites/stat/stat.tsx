import { ArrowDownRight, ArrowUpRight } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { cn } from '../../../lib/utils'

/**
 * Stat.
 *
 * A single measured number with its label and, optionally, its change. The
 * whole component is a decision about honesty: a value shown without its
 * comparison is not information, so `delta` carries the direction, the amount
 * and — through `deltaTone` — whether the direction is *good*. A rising number
 * is not always a rising outcome, and only the caller knows which way is which.
 *
 * `tabular-nums` on the value is what lets two stats in a row be compared
 * without the digits shifting under the reader.
 */
export type StatProps = ComponentProps<'div'> & {
  label: string
  value: JSX.Element
  /** A unit or qualifier after the value, e.g. "ms", "of 10". */
  unit?: string
  /** The change, e.g. "+12% from last week". */
  delta?: string
  /** Whether the change is an improvement. Decides the arrow and the colour. */
  deltaTone?: 'up' | 'down' | 'neutral'
  /** Draws the leading accent rule used for a row of headline numbers. */
  accent?: boolean
}

export function Stat(props: StatProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'label',
    'value',
    'unit',
    'delta',
    'deltaTone',
    'accent',
    'children',
  ])

  return (
    <div
      data-slot="stat"
      class={cn(
        'flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-3',
        { 'border-t-2 border-t-primary': local.accent },
        local.class
      )}
      {...rest}
    >
      <div class="text-muted-foreground truncate text-xs font-medium">{local.label}</div>
      <div class="flex items-baseline gap-1">
        <span class="text-xl font-semibold tabular-nums tracking-tight">{local.value}</span>
        <Show when={local.unit}>
          <span class="text-muted-foreground text-xs">{local.unit}</span>
        </Show>
      </div>
      <Show when={local.delta}>
        <div
          class={cn('flex items-center gap-1 text-xs', {
            'text-success': local.deltaTone === 'up',
            'text-destructive': local.deltaTone === 'down',
            'text-muted-foreground': local.deltaTone === undefined || local.deltaTone === 'neutral',
          })}
        >
          <Show when={local.deltaTone === 'up' || local.deltaTone === 'down'}>
            <Dynamic
              component={local.deltaTone === 'down' ? ArrowDownRight : ArrowUpRight}
              aria-hidden="true"
              class="size-3"
            />
          </Show>
          <span class="tabular-nums">{local.delta}</span>
        </div>
      </Show>
      {local.children}
    </div>
  )
}

/** A row of stats that shares one gap and wraps as the window narrows. */
export function StatGroup(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="stat-group"
      class={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', local.class)}
      {...rest}
    />
  )
}

/**
 * PropertyList.
 *
 * A definition list for read-only metadata: the details of a file, a session, a
 * build. This is a `<dl>`, not a table and not a grid of divs, because the
 * relationship being expressed is term-and-definition and the platform has an
 * element for exactly that.
 *
 * Values are selectable by default. Metadata is the thing users copy most and
 * get the least often: a commit hash behind a drag-to-select gesture is a small
 * daily failure.
 */
export function PropertyList(props: ComponentProps<'dl'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <dl
      data-slot="property-list"
      class={cn('grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm', local.class)}
      {...rest}
    />
  )
}

export function PropertyTerm(props: ComponentProps<'dt'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <dt
      data-slot="property-term"
      class={cn('text-muted-foreground whitespace-nowrap', local.class)}
      {...rest}
    />
  )
}

export function PropertyValue(props: ComponentProps<'dd'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <dd
      data-slot="property-value"
      class={cn('min-w-0 break-words select-text', local.class)}
      {...rest}
    />
  )
}

/** A single term/value pair, for a list built one row at a time. */
export function PropertyRow(props: ComponentProps<'div'> & { term: string }) {
  const [local, rest] = splitProps(props, ['class', 'term', 'children'])

  return (
    <div
      data-slot="property-row"
      class={cn('flex items-baseline justify-between gap-4 text-sm', local.class)}
      {...rest}
    >
      <span class="text-muted-foreground shrink-0">{local.term}</span>
      <span class="min-w-0 truncate text-end select-text">{local.children}</span>
    </div>
  )
}
