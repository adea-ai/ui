import {
  Pagination as KobaltePagination,
  type PaginationRootOptions,
} from '@kobalte/core/pagination'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * Pagination.
 *
 * Page navigation for a list the server pages, not for a list the client already
 * holds — slicing an array you have is a filter, and it should not spend a round
 * trip.
 *
 * Kobalte computes the visible page window and the ellipsis positions and emits
 * `aria-current="page"`, so the control announces which page is active instead of
 * leaving it to colour alone.
 *
 * The item and ellipsis renderers are *supplied here*, not required of the caller.
 * Kobalte's root makes them mandatory because it has no opinion about how a page
 * number should look; a design system does, so the only thing a caller has to pass
 * is `count` — while still being able to override either renderer when a view
 * needs to.
 */
export type PaginationProps = Omit<PaginationRootOptions, 'itemComponent' | 'ellipsisComponent'> & {
  itemComponent?: PaginationRootOptions['itemComponent']
  ellipsisComponent?: PaginationRootOptions['ellipsisComponent']
  class?: string
  children?: JSX.Element
}

const paginationControl = cn(
  'inline-flex h-control-md min-w-(--control-height-md) items-center justify-center gap-1 rounded-md border border-transparent px-2 text-sm tabular-nums',
  'transition-colors ease-out outline-none select-none',
  'hover:bg-surface-hover',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
  'disabled:pointer-events-none disabled:opacity-50',
  '[&_svg]:pointer-events-none [&_svg]:size-4'
)

export function Pagination(props: PaginationProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'itemComponent',
    'ellipsisComponent',
    'children',
  ])

  return (
    <KobaltePagination
      itemComponent={
        local.itemComponent ??
        ((itemProps) => <PaginationItem page={itemProps.page}>{itemProps.page}</PaginationItem>)
      }
      ellipsisComponent={local.ellipsisComponent ?? (() => <PaginationEllipsis />)}
      class={cn('flex w-full items-center justify-center gap-1', local.class)}
      {...rest}
    >
      <Show when={local.children} fallback={<DefaultPaginationControls />}>
        {local.children}
      </Show>
    </KobaltePagination>
  )
}

/** Previous, the numbered run, next: the arrangement every list view wants. */
function DefaultPaginationControls() {
  return (
    <>
      <PaginationPrevious />
      <KobaltePagination.Items />
      <PaginationNext />
    </>
  )
}

export function PaginationPrevious(props: ComponentProps<typeof KobaltePagination.Previous>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobaltePagination.Previous class={cn(paginationControl, 'ps-1.5', local.class)} {...rest}>
      {local.children ?? (
        <>
          <ChevronLeft class="size-4" />
          <span class="hidden sm:inline">Previous</span>
        </>
      )}
    </KobaltePagination.Previous>
  )
}

export function PaginationNext(props: ComponentProps<typeof KobaltePagination.Next>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobaltePagination.Next class={cn(paginationControl, 'pe-1.5', local.class)} {...rest}>
      {local.children ?? (
        <>
          <span class="hidden sm:inline">Next</span>
          <ChevronRight class="size-4" />
        </>
      )}
    </KobaltePagination.Next>
  )
}

export function PaginationItem(props: ComponentProps<typeof KobaltePagination.Item>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobaltePagination.Item
      class={cn(
        paginationControl,
        'data-[current]:border-border data-[current]:bg-surface-active data-[current]:font-medium',
        local.class
      )}
      {...rest}
    >
      {local.children}
    </KobaltePagination.Item>
  )
}

export function PaginationEllipsis(
  props: ComponentProps<typeof KobaltePagination.Ellipsis> & { children?: JSX.Element }
) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobaltePagination.Ellipsis
      class={cn('flex size-control-md items-center justify-center', local.class)}
      {...rest}
    >
      {local.children ?? (
        <>
          <MoreHorizontal class="size-4" />
          <span class="visually-hidden">More pages</span>
        </>
      )}
    </KobaltePagination.Ellipsis>
  )
}
