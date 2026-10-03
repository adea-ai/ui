import {
  type ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  onCleanup,
  Show,
  splitProps,
  type JSX,
} from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'
import { Badge } from '../badge/badge'
import { headingVariants, textVariants } from '../typography'

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
 *
 * `collapseEmpty` folds a column with no cards to a strip one line of text wide,
 * its label turned on its side. A board of seven lanes where three are empty
 * otherwise spends half its width on nothing, and the lanes with work in them
 * are the ones that need the room. A folded lane is still a full-height drop
 * target and still accepts a keyboard move, so nothing about operating the
 * board changes; it does not unfold under a drag, because a lane that grows
 * under the pointer moves every lane after it and the drop lands somewhere else.
 *
 * Give the board a height (`class="h-full"`) and each lane scrolls on its own;
 * leave it unconstrained and lanes grow with their cards and the page scrolls.
 */

/**
 * A lane's identifying colour, drawn as a dot before its label. The chart hues,
 * in the order the token set gives them, because a lane colour tells lanes apart
 * like a series does; it carries no status. `neutral` is for a lane that should
 * not draw the eye — a backlog, an archive.
 */
export type BoardTone =
  | 'neutral'
  | 'chart-1'
  | 'chart-2'
  | 'chart-3'
  | 'chart-4'
  | 'chart-5'
  | 'chart-6'

export type BoardColumn = Readonly<{
  id: string
  label: string
  /** The number of cards, shown as an accent count beside the label. */
  count?: number
  /** A limit or any other note, shown after the count. */
  meta?: JSX.Element
  /** The lane's dot colour. Omitted, the header has no dot. */
  tone?: BoardTone
  /**
   * `false` keeps this lane open when it is empty under `collapseEmpty` — the
   * inbox lane new cards arrive in, which should always show where they land.
   */
  collapsible?: boolean
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
  /** The board's accessible name. Defaults to "Board". */
  label?: string
  /** Fold columns with no cards to a narrow strip with a sideways label. */
  collapseEmpty?: boolean
  class?: string
}

const cardDragState = {
  idle: '',
  dragging: 'opacity-40',
} as const

const toneDot: Record<BoardTone, string> = {
  neutral: 'bg-muted-foreground',
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
  'chart-4': 'bg-chart-4',
  'chart-5': 'bg-chart-5',
  'chart-6': 'bg-chart-6',
}

function BoardColumnDot(props: { tone?: BoardTone }) {
  return (
    <Show when={props.tone}>
      {(tone) => (
        <span aria-hidden="true" class={cn('size-2 shrink-0 rounded-full', toneDot[tone()])} />
      )}
    </Show>
  )
}

function BoardColumnCount(props: { count?: number }) {
  return (
    <Show when={props.count !== undefined}>
      <Badge variant="subtle" size="sm" class="tabular-nums" data-slot="board-column-count">
        {props.count}
      </Badge>
    </Show>
  )
}

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
    'label',
    'collapseEmpty',
    'class',
  ])

  // The dragged item, not its id: `canDrop` takes the item itself, and the
  // pointer may leave the card before it is dropped.
  const [dragging, setDragging] = createSignal<T | null>(null)
  const [overColumn, setOverColumn] = createSignal<string | null>(null)
  const [announcement, setAnnouncement] = createSignal('')
  const cardElements = new Map<string, HTMLElement>()
  const [pendingFocus, setPendingFocus] = createSignal<{
    itemId: string
    columnId: string
    source: HTMLElement
  } | null>(null)
  const cancelOnPointer = () => setPendingFocus(null)

  // A controlled move can settle after a server response. Restore only the
  // focus that belonged to the moved card; another focus action cancels it.
  createEffect(() => {
    const pending = pendingFocus()
    if (!pending) return
    const document = pending.source.ownerDocument
    const cancelOnFocus = (event: FocusEvent) => {
      if (!pending.source.contains(event.target as Node)) setPendingFocus(null)
    }
    document.addEventListener('focusin', cancelOnFocus)
    document.addEventListener('pointerdown', cancelOnPointer)
    onCleanup(() => {
      document.removeEventListener('focusin', cancelOnFocus)
      document.removeEventListener('pointerdown', cancelOnPointer)
    })
  })

  createEffect(() => {
    const pending = pendingFocus()
    if (!pending) return
    const moved = local.items.find((item) => local.itemId(item) === pending.itemId)
    if (!moved || local.itemColumn(moved) !== pending.columnId) return
    queueMicrotask(() => {
      if (pendingFocus() !== pending) return
      const target = cardElements.get(pending.itemId)
      setPendingFocus(null)
      if (target?.isConnected) target.focus()
    })
  })

  /**
   * `always` is for a pointer drop: dragging a card is a direct act on it, so it
   * ends focused wherever focus was. Chromium also blurs a focused control
   * inside a draggable once the native drag starts, so "was focus in the card"
   * cannot be read at drop time.
   */
  const prepareFocus = (item: T, columnId: string, source?: HTMLElement, always = false) => {
    const card = source ?? cardElements.get(local.itemId(item))
    if (card && (always || card.contains(card.ownerDocument.activeElement))) {
      setPendingFocus({ itemId: local.itemId(item), columnId, source: card })
    }
  }

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
    const accepted = accepts(column)
    setDragging(null)
    setOverColumn(null)
    if (!item || !from || from === column.id || !accepted) return
    prepareFocus(item, column.id, undefined, true)
    local.onMove({ itemId: local.itemId(item), from, to: column.id })
  }

  /**
   * Keyboard move. `Ctrl`/`Cmd` plus an arrow is the convention for "reorder this
   * thing within its container" that does not collide with scrolling or with the
   * text caret, and it is the same chord a browser tab or a spreadsheet uses.
   */
  const moveByKeyboard = (item: T, direction: -1 | 1, source: HTMLElement) => {
    const from = local.itemColumn(item)
    const index = local.columns.findIndex((column) => column.id === from)
    if (index < 0) return
    const ordered =
      direction === 1 ? local.columns.slice(index + 1) : local.columns.slice(0, index).toReversed()
    const target = ordered.find(
      (column) => !column.disabled && local.canDrop(item, from, column.id)
    )
    if (!target) {
      setAnnouncement(`No column after ${from} accepts this item`)
      return
    }
    prepareFocus(item, target.id, source)
    local.onMove({ itemId: local.itemId(item), from, to: target.id })
    setAnnouncement(`Moved to ${target.label}`)
  }

  return (
    /*
      `role="region"` + `tabindex="0"` because the board scrolls horizontally and a
      keyboard user has to be able to scroll it — axe's `scrollable-region-focusable`.
      It is not enough that the cards are focusable: a board with empty columns, or
      with more columns than fit, has nothing focusable to scroll from.
    */
    <div
      class={cn('flex min-h-0 gap-3 overflow-x-auto pb-2', local.class)}
      role="region"
      aria-label={local.label ?? 'Board'}
      tabindex="0"
    >
      {/*
        Index, not For: callers derive columns (a count, a tone) and hand over
        fresh objects whenever a card moves. Keyed by identity, every lane would
        remount on each move and take the moved card's restored focus with it.
      */}
      <Index each={local.columns}>
        {(column) => {
          const items = () => byColumn().get(column().id) ?? []
          const collapsed = () =>
            Boolean(local.collapseEmpty) && column().collapsible !== false && items().length === 0
          const over = () => overColumn() === column().id
          return (
            <section
              class={cn(
                'flex shrink-0 flex-col rounded-lg border border-border bg-muted/40 transition-colors',
                {
                  'w-72': !collapsed(),
                  'w-10 items-center': collapsed(),
                  'border-dashed border-ring': accepts(column()) && !over(),
                  'border-ring bg-primary-subtle': accepts(column()) && over(),
                  'border-dashed opacity-60': over() && !accepts(column()),
                  'opacity-50': column().disabled,
                }
              )}
              aria-label={column().label}
              data-collapsed={collapsed() ? '' : undefined}
              onDragOver={(event) => {
                setOverColumn(column().id)
                if (accepts(column())) event.preventDefault()
              }}
              onDragLeave={(event) => {
                // Leaving for a child is not leaving the lane.
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                setOverColumn((current) => (current === column().id ? null : current))
              }}
              onDrop={(event) => {
                event.preventDefault()
                drop(column())
              }}
            >
              <Show
                when={!collapsed()}
                fallback={
                  <header class="flex flex-col items-center gap-2 py-3">
                    <BoardColumnDot tone={column().tone} />
                    <BoardColumnCount count={column().count} />
                    <h3
                      class={cn(
                        headingVariants({ size: 'subsection', leading: 'none', tone: 'muted' }),
                        'text-vertical'
                      )}
                    >
                      {column().label}
                    </h3>
                  </header>
                }
              >
                <header class="flex h-10 shrink-0 items-center gap-2 px-3">
                  <BoardColumnDot tone={column().tone} />
                  <h3
                    class={cn(
                      headingVariants({ size: 'subsection', leading: 'none', tone: 'foreground' }),
                      'truncate'
                    )}
                  >
                    {column().label}
                  </h3>
                  <BoardColumnCount count={column().count} />
                  <Show when={column().meta}>
                    <span class="ms-auto text-2xs text-muted-foreground">{column().meta}</span>
                  </Show>
                </header>
                <div class="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                  <For each={items()}>
                    {(item) => {
                      const isDragging = () => {
                        const current = dragging()
                        return Boolean(current && local.itemId(current) === local.itemId(item))
                      }
                      return (
                        <article
                          ref={(element) => {
                            const id = local.itemId(item)
                            cardElements.set(id, element)
                            onCleanup(() => {
                              if (cardElements.get(id) === element) cardElements.delete(id)
                            })
                          }}
                          class={cn(
                            'relative shrink-0 cursor-grab rounded-md border border-border bg-card text-sm shadow-xs outline-none transition-colors hover:bg-surface-hover focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle active:cursor-grabbing',
                            cardDragState[isDragging() ? 'dragging' : 'idle']
                          )}
                          // A board card is a control that can be moved, so it is
                          // focusable and carries the chord it responds to.
                          tabindex="0"
                          aria-roledescription="Draggable card"
                          draggable={true}
                          onDragStart={(event) => {
                            event.dataTransfer?.setData('text/plain', local.itemId(item))
                            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
                            setDragging(() => item)
                          }}
                          onDragEnd={() => {
                            setDragging(null)
                            setOverColumn(null)
                          }}
                          onKeyDown={(event) => {
                            if (!(event.ctrlKey || event.metaKey)) return
                            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                            event.preventDefault()
                            moveByKeyboard(
                              item,
                              event.key === 'ArrowRight' ? 1 : -1,
                              event.currentTarget
                            )
                          }}
                        >
                          {local.children(item, { dragging: isDragging() })}
                        </article>
                      )
                    }}
                  </For>
                  <Show when={items().length === 0}>
                    <p class="rounded-md border border-dashed border-border px-2 py-4 text-center text-2xs text-muted-foreground">
                      {local.emptyColumn?.(column()) ?? 'Nothing here'}
                    </p>
                  </Show>
                </div>
              </Show>
            </section>
          )
        }}
      </Index>
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

/**
 * The card's open action: its title, as a real button whose hit area stretches
 * over the whole card. A card is one target to a pointer — clicking anywhere on
 * it opens it — while assistive technology still meets a named button rather
 * than a clickable `article`. Other controls on the card sit above the stretched
 * area by being positioned (`class="relative"`), so they keep their own click.
 */
export function BoardCardTrigger(props: ComponentProps<'button'>) {
  const [local, rest] = splitProps(props, ['class', 'type'])
  return (
    <button
      type={local.type ?? 'button'}
      data-slot="board-card-trigger"
      class={cn(
        textVariants({ variant: 'label', tone: 'foreground' }),
        'min-w-0 flex-1 truncate rounded-sm text-start outline-none',
        'after:absolute after:inset-0 after:rounded-md',
        'focus-visible:ring-3 focus-visible:ring-primary-subtle',
        local.class
      )}
      {...rest}
    />
  )
}
