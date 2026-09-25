import { createMemo, createSignal, For, Show, splitProps, type JSX } from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'

/**
 * Board.
 *
 * Columns of cards, with drag between them — the shape a task tracker, a CRM
 * pipeline, a support queue and a release plan all share. It is generic in the
 * one place that matters: the *column ids are the caller's*, and so is the rule
 * that decides which moves are legal. The component knows nothing about tasks.
 *
 * The transitions are a predicate rather than a derived table because the legal
 * moves in a real product are not "any column to any column". A task that is
 * `completed` may be archived but not re-queued; a lead may become a customer but
 * not a stranger again. A board that let you drop anything anywhere would encode
 * a state machine in the UI that the server rejects — so `canDrop` is required,
 * and a column that cannot receive the dragged card renders as unavailable rather
 * than silently accepting a drop that will fail.
 *
 * Three input methods, because a drag-only board is unusable by keyboard:
 * dragging with the pointer, `Ctrl`/`Cmd` + arrow keys to move a focused card
 * between columns, and whatever the caller wires into `actions`. The card is
 * focusable and its move is announced through a live region, so the board is
 * operable without a mouse.
 *
 * The card is rendered by the caller through `children`, given the item and a set
 * of drag props. That is deliberate: a card's contents are domain — a title, a
 * priority tag, an assignee — and a board that rendered them itself could only
 * ever serve one product.
 */

export type BoardColumn = Readonly<{
  id: string
  label: string
  /** A count or a limit, shown beside the label. */
  meta?: JSX.Element
  /** Dim the column and refuse drops — a lane that is closed or read-only. */
  disabled?: boolean
}>

export type BoardMove = Readonly<{
  itemId: string
  from: string
  to: string
}>

export type BoardProps<T> = {
  columns: readonly BoardColumn[]
  items: readonly T[]
  /** The item's stable id. */
  itemId: (item: T) => string
  /** The id of the column the item currently sits in. */
  itemColumn: (item: T) => string
  /** Whether `item` may move from `from` to `to`. Required: see the note above. */
  canDrop: (item: T, from: string, to: string) => boolean
  onMove: (move: BoardMove) => void
  /** The card body. `dragging` is true while this card is the one being dragged. */
  children: (item: T, state: { dragging: boolean }) => JSX.Element
  /** Shown when a column has no items. */
  emptyColumn?: (column: BoardColumn) => JSX.Element
  class?: string
}

const cardDragState = {
  idle: '',
  dragging: 'opacity-40',
} as const

export function Board<T>(props: BoardProps<T>) {
  const [local] = splitProps(props, [
    'columns',
    'items',
    'itemId',
    'itemColumn',
    'canDrop',
    'onMove',
    'children',
    'emptyColumn',
    'class',
  ])

  // The dragged item, not its id: `canDrop` takes the item itself, and the
  // pointer may leave the card before it is dropped.
  const [dragging, setDragging] = createSignal<T | null>(null)
  const [overColumn, setOverColumn] = createSignal<string | null>(null)
  const [announcement, setAnnouncement] = createSignal('')

  const byColumn = createMemo(() => {
    const grouped = new Map<string, T[]>()
    for (const column of local.columns) grouped.set(column.id, [])
    for (const item of local.items) grouped.get(local.itemColumn(item))?.push(item)
    return grouped
  })

  const accepts = (column: BoardColumn) => {
    const item = dragging()
    return Boolean(
      item && !column.disabled && local.canDrop(item, local.itemColumn(item), column.id)
    )
  }

  const drop = (column: BoardColumn) => {
    const item = dragging()
    const from = item ? local.itemColumn(item) : null
    setDragging(null)
    setOverColumn(null)
    if (!item || !from || from === column.id || !accepts(column)) return
    local.onMove({ itemId: local.itemId(item), from, to: column.id })
  }

  /**
   * Keyboard move. `Ctrl`/`Cmd` plus an arrow is the convention for "reorder this
   * thing within its container" that does not collide with scrolling or with the
   * text caret, and it is the same chord a browser tab or a spreadsheet uses.
   */
  const moveByKeyboard = (item: T, direction: -1 | 1) => {
    const from = local.itemColumn(item)
    const index = local.columns.findIndex((column) => column.id === from)
    const candidates = local.columns.slice(index + direction)
    const ordered = direction === 1 ? candidates : candidates.toReversed()
    const target = ordered.find(
      (column) => !column.disabled && local.canDrop(item, from, column.id)
    )
    if (!target) {
      setAnnouncement(`No column after ${from} accepts this item`)
      return
    }
    local.onMove({ itemId: local.itemId(item), from, to: target.id })
    setAnnouncement(`Moved to ${target.label}`)
  }

  return (
    <div class={cn('flex min-h-0 gap-4 overflow-x-auto pb-2', local.class)}>
      <For each={local.columns}>
        {(column) => {
          const items = () => byColumn().get(column.id) ?? []
          return (
            <section
              class={cn(
                'flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-border bg-muted/40 p-2',
                accepts(column) && 'border-ring bg-muted',
                overColumn() === column.id && !accepts(column) && 'border-dashed opacity-60',
                column.disabled && 'opacity-50'
              )}
              aria-label={column.label}
              onDragOver={(event) => {
                setOverColumn(column.id)
                if (accepts(column)) event.preventDefault()
              }}
              onDragLeave={() =>
                setOverColumn((current) => (current === column.id ? null : current))
              }
              onDrop={(event) => {
                event.preventDefault()
                drop(column)
              }}
            >
              <header class="flex items-center justify-between gap-2 px-1 py-0.5">
                <h3 class="text-xs font-semibold text-foreground">{column.label}</h3>
                <Show when={column.meta}>
                  <span class="text-2xs text-muted-foreground">{column.meta}</span>
                </Show>
              </header>
              <div class="flex min-h-16 flex-col gap-2">
                <For each={items()}>
                  {(item) => {
                    const isDragging = () => {
                      const current = dragging()
                      return Boolean(current && local.itemId(current) === local.itemId(item))
                    }
                    return (
                      <article
                        class={cn(
                          'rounded-md border border-border bg-card text-sm shadow-xs',
                          cardDragState[isDragging() ? 'dragging' : 'idle']
                        )}
                        // A board card is a control that can be moved, so it is
                        // focusable and carries the chord it responds to.
                        tabindex="0"
                        aria-roledescription="Draggable card"
                        draggable={true}
                        onDragStart={() => setDragging(() => item)}
                        onDragEnd={() => {
                          setDragging(null)
                          setOverColumn(null)
                        }}
                        onKeyDown={(event) => {
                          if (!(event.ctrlKey || event.metaKey)) return
                          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                          event.preventDefault()
                          moveByKeyboard(item, event.key === 'ArrowRight' ? 1 : -1)
                        }}
                      >
                        {local.children(item, { dragging: isDragging() })}
                      </article>
                    )
                  }}
                </For>
                <Show when={items().length === 0}>
                  <p class="rounded-md border border-dashed border-border px-2 py-4 text-center text-2xs text-muted-foreground">
                    {local.emptyColumn?.(column) ?? 'Nothing here'}
                  </p>
                </Show>
              </div>
            </section>
          )
        }}
      </For>
      {/*
        The keyboard move's result, announced. A drag speaks for itself — the card
        visibly moves — while a keyboard move happens with the focus elsewhere.
      */}
      <div class="visually-hidden" role="status" aria-live="polite">
        {announcement()}
      </div>
    </div>
  )
}

export const boardCardTitleVariants = cva('truncate font-medium text-foreground', {
  variants: { size: { sm: 'text-xs', md: 'text-sm' } },
  defaultVariants: { size: 'md' },
})

export type BoardCardTitleProps = { class?: string; children: JSX.Element } & VariantProps<
  typeof boardCardTitleVariants
>

/** The card's title line, at the size a board card uses. */
export function BoardCardTitle(props: BoardCardTitleProps) {
  return (
    <h4 class={cn(boardCardTitleVariants({ size: props.size }), props.class)}>{props.children}</h4>
  )
}

/** A card's padding, so every card in an application is the same shape. */
export function BoardCardBody(props: { class?: string; children: JSX.Element }) {
  return <div class={cn('grid gap-1.5 p-2.5', props.class)}>{props.children}</div>
}
