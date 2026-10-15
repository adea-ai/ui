import type { ComponentProps, JSX } from 'solid-js'
import { ChevronRight } from 'lucide-solid'
import {
  createContext,
  createEffect,
  createMemo,
  createUniqueId,
  onCleanup,
  splitProps,
  useContext,
} from 'solid-js'
import { cn } from '#lib/utils'
import {
  indexTreeItems,
  treeNavigationAction,
  type TreeItemDescriptor,
  type TreeNavigationIndex,
} from './tree-navigation'

type TreeContextValue = {
  idPrefix: string
  activeId: () => string | null
  index: () => TreeNavigationIndex
  register: (id: string, element: HTMLDivElement) => void
  unregister: (id: string, element: HTMLDivElement | undefined) => void
  focusItem: (id: string) => void
  noteFocus: (id: string) => void
  activate: (id: string, event: Event) => void
  expand: (id: string, expanded: boolean) => void
  disclosure: () => TreeDisclosure
  onActiveIdChange: (id: string) => void
}

const TreeContext = createContext<TreeContextValue>()

function useTreeContext() {
  const tree = useContext(TreeContext)
  if (!tree) throw new Error('[adea-ui]: TreeRow must be used inside Tree.')
  return tree
}

/**
 * Who owns the pointer on a row's disclosure chevron.
 *
 * - `row` (default): the chevron is decoration; a click anywhere on the row,
 *   chevron included, is a row activation. This is the file-explorer
 *   convention, where the host's `onActivate` toggles a folder.
 * - `marker`: the chevron of an expandable row is its own pointer target. It
 *   calls `onExpand(id, !expanded)` and nothing else; the rest of the row still
 *   activates. For trees where expanding and selecting are independent (a
 *   source list that selects a source and separately reveals its details).
 */
export type TreeDisclosure = 'row' | 'marker'

type TreeAccessibleName =
  | { 'aria-label': string; 'aria-labelledby'?: string }
  | { 'aria-label'?: string; 'aria-labelledby': string }

export type TreeProps = Omit<
  ComponentProps<'div'>,
  'children' | 'role' | 'tabIndex' | 'onKeyDown' | 'aria-label' | 'aria-labelledby'
> &
  TreeAccessibleName & {
    /** Complete, ordered projection of currently visible (expanded) items. */
    visibleItems: readonly TreeItemDescriptor[]
    /** The host-owned identity of the row that currently owns roving focus. */
    activeId: string | null
    /**
     * Called when keyboard or pointer navigation changes the active row, and when
     * the active row leaves `visibleItems` (collapsed away, filtered out) and the
     * first visible row takes over as the roving stop.
     */
    onActiveIdChange: (id: string) => void
    /** Called for Left/Right expand and collapse requests. */
    onExpand?: (id: string, expanded: boolean) => void
    /**
     * Opt-in pointer behaviour of the disclosure chevron; see {@link TreeDisclosure}.
     * Keyboard behaviour is identical in both modes: Left/Right expand and collapse.
     */
    disclosure?: TreeDisclosure
    /** Called for Enter or pointer activation. Domain action stays host-owned. */
    onActivate?: (id: string, event: Event) => void
    /** Called for Space selection. Selection state stays host-owned. */
    onSelectItem?: (id: string, event: Event) => void
    /** Ask the host window to mount/reveal an item before focus moves to it. */
    onRequestReveal?: (id: string) => void
    /** Report a mounted row's border-box block size in CSS pixels for host range math. */
    onRowSizeChange?: (id: string, blockSize: number) => void
    /** Declares a multi-select tree to assistive technology. */
    selectionMode?: 'single' | 'multiple'
    children?: JSX.Element
  }

/**
 * Tree.
 *
 * Supplies semantic and keyboard behavior for a tree whose host owns the
 * visible projection, filesystem state, row window and domain actions. The
 * mounted children can be a small virtualized window; `visibleItems` remains
 * the complete ordered projection so keyboard movement and sibling positions
 * do not depend on which rows currently exist in the DOM.
 *
 * Kobalte 0.13.14 has no Tree primitive, so this component implements the
 * WAI-ARIA tree row navigation contract and leaves product state to callbacks.
 *
 * By default the disclosure chevron is decoration and a click anywhere on a
 * row activates it, so a file explorer can toggle a folder from `onActivate`.
 * Reach for `disclosure="marker"` when expanding and selecting are separate
 * decisions: the chevron then calls only `onExpand`, and the rest of the row
 * calls only `onActivate`. The chevron stays `aria-hidden` and out of the tab
 * order in both modes; keyboard expansion is Left/Right either way.
 *
 * Collapsing is the one thing that can move focus without a key or a click on
 * the target row: when the active row leaves `visibleItems`, the first visible
 * row becomes the roving stop and `onActiveIdChange` is called with it. If the
 * removed row held focus, or was the last row the tree saw focused, focus moves
 * to that same row; if it had no focus, only the roving stop moves. This is the
 * same in both `disclosure` modes and for every way a host collapses a row.
 */
export function Tree(props: TreeProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'visibleItems',
    'activeId',
    'onActiveIdChange',
    'onExpand',
    'disclosure',
    'onActivate',
    'onSelectItem',
    'onRequestReveal',
    'onRowSizeChange',
    'selectionMode',
    'children',
  ])

  const index = createMemo(() => indexTreeItems(local.visibleItems))
  const effectiveActiveId = createMemo(() => {
    const candidate = local.activeId
    const visible = index()
    return candidate !== null && visible.byId.has(candidate) ? candidate : (visible.ids[0] ?? null)
  })
  const idPrefix = `tree-${createUniqueId()}`
  const rows = new Map<string, HTMLDivElement>()
  const rowIdsByElement = new WeakMap<HTMLDivElement, string>()
  let pendingFocusId: string | null = null
  let requestedRevealId: string | null = null
  let focusedId: string | null = null
  let disposed = false
  const rowSizeObserver =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver((entries) => {
          if (disposed) return
          for (const entry of entries) {
            const id = rowIdsByElement.get(entry.target as HTMLDivElement)
            const blockSize =
              entry.borderBoxSize[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight
            if (id !== undefined && Number.isFinite(blockSize) && blockSize > 0)
              local.onRowSizeChange?.(id, blockSize)
          }
        })

  onCleanup(() => {
    disposed = true
    rowSizeObserver?.disconnect()
  })

  const requestReveal = (id: string) => {
    if (requestedRevealId === id) return
    requestedRevealId = id
    local.onRequestReveal?.(id)
  }

  const focusWhenMounted = (id: string) => {
    queueMicrotask(() => {
      if (pendingFocusId !== id || effectiveActiveId() !== id) return
      const row = rows.get(id)
      if (!row || typeof document === 'undefined') return
      row.focus()
      if (document.activeElement === row) pendingFocusId = null
    })
  }

  const focusItem = (id: string) => {
    pendingFocusId = id
    local.onActiveIdChange(id)
    if (rows.has(id)) requestedRevealId = null
    else requestReveal(id)
    focusWhenMounted(id)
  }

  const context: TreeContextValue = {
    idPrefix,
    activeId: effectiveActiveId,
    index,
    register: (id, element) => {
      rows.set(id, element)
      rowIdsByElement.set(element, id)
      rowSizeObserver?.observe(element)
      if (requestedRevealId === id) requestedRevealId = null
      if (pendingFocusId === id) focusWhenMounted(id)
    },
    unregister: (id, element) => {
      if (rows.get(id) !== element) return
      const focusWasInside =
        !disposed &&
        Boolean(
          element && typeof document !== 'undefined' && element.contains(document.activeElement)
        )
      rows.delete(id)
      if (element) {
        rowIdsByElement.delete(element)
        rowSizeObserver?.unobserve(element)
      }
      if (requestedRevealId === id) requestedRevealId = null
      if (focusWasInside) {
        queueMicrotask(() => {
          const fallbackId = effectiveActiveId()
          if (!disposed && fallbackId !== null && pendingFocusId !== fallbackId)
            focusItem(fallbackId)
        })
      }
    },
    focusItem,
    noteFocus: (id) => {
      focusedId = id
    },
    activate: (id, event) => local.onActivate?.(id, event),
    expand: (id, expanded) => local.onExpand?.(id, expanded),
    disclosure: () => local.disclosure ?? 'row',
    onActiveIdChange: local.onActiveIdChange,
  }

  // A filtered, collapsed-away or removed active ID falls back to the first
  // visible item. This keeps one treeitem in the sequential tab order while
  // notifying the host.
  createEffect(() => {
    const activeId = effectiveActiveId()
    if (activeId === null) return
    // If the projection removes the last row that took focus (a host filter, or
    // an ancestor collapsing), move focus to the same fallback that now owns the
    // roving tab stop. `focusedId` is not cleared when focus leaves the tree, so
    // this also reclaims focus from a control outside it; that long-standing
    // behaviour is deliberately left as it was.
    if (focusedId !== null && !index().byId.has(focusedId) && pendingFocusId !== activeId) {
      focusItem(activeId)
    } else if (local.activeId !== activeId) {
      local.onActiveIdChange(activeId)
    }
    // Preserve the active row in a caller-owned virtual window, including when
    // the pane mounts with its saved active row outside the initial render range.
    if (!rows.has(activeId)) requestReveal(activeId)
    if (pendingFocusId === activeId) focusWhenMounted(activeId)
  })

  const handleKeyDown: JSX.EventHandler<HTMLDivElement, KeyboardEvent> = (event) => {
    if (event.defaultPrevented || isActionTarget(event.target, event.currentTarget)) return

    const action = treeNavigationAction(index(), effectiveActiveId(), event.key)
    if (!action) return
    event.preventDefault()

    switch (action.type) {
      case 'focus':
        focusItem(action.id)
        break
      case 'expand':
        local.onExpand?.(action.id, action.expanded)
        break
      case 'activate':
        local.onActivate?.(action.id, event)
        break
      case 'select':
        local.onSelectItem?.(action.id, event)
        break
    }
  }

  return (
    <TreeContext.Provider value={context}>
      <div
        {...rest}
        role="tree"
        aria-multiselectable={local.selectionMode === 'multiple' ? 'true' : undefined}
        data-slot="tree"
        class={cn(
          /* A virtualized host remounts rows as it scrolls; scroll anchoring
             would latch onto the focused row and fight the scrollbar. */
          'flex min-w-0 flex-col [overflow-anchor:none]',
          local.class
        )}
        onKeyDown={handleKeyDown}
      >
        {local.children}
      </div>
    </TreeContext.Provider>
  )
}

export type TreeRowProps = Omit<
  ComponentProps<'div'>,
  | 'children'
  | 'role'
  | 'tabIndex'
  | 'onClick'
  | 'onFocus'
  | 'onDoubleClick'
  | 'style'
  | 'aria-level'
  | 'aria-expanded'
  | 'aria-selected'
  | 'aria-posinset'
  | 'aria-setsize'
> & {
  item: TreeItemDescriptor
  /** Host-owned selection state; omitted for non-selectable trees. */
  selected?: boolean
  leading?: JSX.Element
  trailing?: JSX.Element
  children: JSX.Element
  onDoubleClick?: (id: string, event: MouseEvent & { currentTarget: HTMLDivElement }) => void
}

/**
 * TreeRow.
 *
 * Keeps the donor's disclosure marker, leading file/folder affordance, primary
 * label and trailing-action hierarchy while replacing the donor's button and
 * runtime callbacks with a shared treeitem and host-owned slots/actions.
 *
 * With `Tree`'s `disclosure="marker"` the chevron of an expandable row is a
 * separate pointer target (`data-slot="tree-row-disclosure"`) that only calls
 * `onExpand`. It is not focusable and has no role: the row remains the single
 * focus stop, Enter and Space still activate and select, and Left/Right still
 * expand and collapse, so the marker adds a pointer path and nothing else.
 * Pressing it does not move focus or the roving stop to its row; if the toggle
 * hides the focused row, `Tree` recovers focus as it does for any collapse (see
 * the `Tree` comment and docs/tree.md).
 */
export function TreeRow(props: TreeRowProps) {
  const tree = useTreeContext()
  const [local, rest] = splitProps(props, [
    'class',
    'item',
    'selected',
    'leading',
    'trailing',
    'children',
    'onDoubleClick',
    'ref',
  ])

  let row: HTMLDivElement | undefined
  let registeredId: string | undefined
  const id = () => local.item.id

  onCleanup(() => tree.unregister(registeredId ?? id(), row))

  const setRef = (element: HTMLDivElement) => {
    row = element
    registeredId = id()
    tree.register(registeredId, element)
  }

  createEffect(() => {
    const nextId = id()
    if (!row || registeredId === nextId) return
    if (registeredId !== undefined) tree.unregister(registeredId, row)
    registeredId = nextId
    tree.register(nextId, row)
  })

  const handleFocus = () => {
    tree.noteFocus(id())
    if (tree.activeId() !== id()) tree.onActiveIdChange(id())
  }

  const handleClick: JSX.EventHandler<HTMLDivElement, MouseEvent> = (event) => {
    if (isActionTarget(event.target, event.currentTarget)) return
    tree.focusItem(id())
    tree.activate(id(), event)
  }

  const handleDoubleClick: JSX.EventHandler<HTMLDivElement, MouseEvent> = (event) => {
    if (isActionTarget(event.target, event.currentTarget)) return
    local.onDoubleClick?.(id(), event)
  }

  const position = () => tree.index().positionById.get(id())
  // Only an expandable row has a chevron to press; a leaf's marker slot stays
  // part of the row so a click there is an ordinary row click.
  const markerTarget = () => tree.disclosure() === 'marker' && local.item.expandable

  const handleMarkerClick: JSX.EventHandler<HTMLSpanElement, MouseEvent> = (event) => {
    // The row's own handler would focus and activate the row.
    event.stopPropagation()
    tree.expand(id(), !local.item.expanded)
  }
  return (
    <div
      {...rest}
      ref={composeRefs(setRef, () => local.ref)}
      id={rest.id ?? `${tree.idPrefix}-item-${encodeURIComponent(id())}`}
      role="treeitem"
      aria-level={local.item.level}
      aria-expanded={local.item.expandable ? (local.item.expanded ? 'true' : 'false') : undefined}
      aria-selected={local.selected === undefined ? undefined : local.selected ? 'true' : 'false'}
      aria-posinset={position()?.position}
      aria-setsize={position()?.setSize}
      tabIndex={tree.activeId() === id() ? 0 : -1}
      data-tree-id={id()}
      data-active={tree.activeId() === id() ? '' : undefined}
      data-selected={local.selected ? '' : undefined}
      data-expanded={local.item.expandable ? String(local.item.expanded) : undefined}
      class={cn(
        'group/tree-row flex min-h-row-sm w-full min-w-0 items-center gap-1.5 rounded-md pe-1.5 text-left text-sm outline-none transition-colors',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        {
          'bg-primary-subtle text-foreground': local.selected,
          'hover:bg-surface-hover': !local.selected,
        },
        local.class
      )}
      style={{ 'padding-inline-start': `${6 + Math.max(0, local.item.level - 1) * 12}px` }}
      onFocus={handleFocus}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
    >
      <span
        data-slot={markerTarget() ? 'tree-row-disclosure' : undefined}
        class={cn(
          'flex',
          !markerTarget() && 'size-3.5',
          'shrink-0 items-center justify-center text-muted-foreground',
          /* The glyph stays 14px wide but the target is not: it takes the row's full
             height (a flex child's `self-stretch`, so it follows row density and a
             tall trailing control) and the pseudo-element widens it to 26px, which
             stops at the row's own padding and gap, never over the icon or label. */
          markerTarget() &&
            'relative w-3.5 cursor-pointer self-stretch hover:text-foreground after:absolute after:inset-y-0 after:-inset-x-1.5'
        )}
        onMouseDown={markerTarget() ? handleMarkerMouseDown : undefined}
        onClick={markerTarget() ? handleMarkerClick : undefined}
        onDblClick={markerTarget() ? handleMarkerDoubleClick : undefined}
      >
        {local.item.expandable ? (
          <ChevronRight
            aria-hidden="true"
            class={cn('size-3.5 transition-transform', local.item.expanded && 'rotate-90')}
          />
        ) : null}
      </span>
      {local.leading ? (
        <span class="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
          {local.leading}
        </span>
      ) : null}
      <span class="min-w-0 flex-1 truncate">{local.children}</span>
      {local.trailing ? (
        <span class="ms-auto flex shrink-0 items-center gap-1 text-muted-foreground">
          {local.trailing}
        </span>
      ) : null}
    </div>
  )
}

/**
 * TreeRowActions.
 *
 * Row-level commands (rename, copy, delete) that stay out of the way until the
 * row is hovered or holds focus, so a long tree reads as names rather than a
 * wall of buttons. Put it in `TreeRow`'s `trailing` slot beside any status that
 * must stay visible. `pinned` keeps the actions shown, e.g. while a destructive
 * action waits for its confirming second press.
 */
export function TreeRowActions(props: ComponentProps<'span'> & { pinned?: boolean }) {
  const [local, rest] = splitProps(props, ['class', 'pinned'])
  return (
    <span
      data-slot="tree-row-actions"
      data-pinned={local.pinned ? '' : undefined}
      class={cn(
        'flex shrink-0 items-center gap-1 opacity-0 transition-opacity ease-out',
        'group-hover/tree-row:opacity-100 group-focus-within/tree-row:opacity-100 data-pinned:opacity-100',
        local.class
      )}
      {...rest}
    />
  )
}

// Pressing the chevron must not move focus to its row: a mousedown on a
// non-focusable child would otherwise focus the row, making it the roving stop
// (and notifying `onActiveIdChange`) for what is a disclosure toggle, not a
// selection. The press itself leaves focus where it was, so Left/Right keep
// acting on the row the keyboard user left off at. It cannot stop the toggle
// from hiding that row; `Tree` then recovers focus onto the first visible row.
const handleMarkerMouseDown: JSX.EventHandler<HTMLSpanElement, MouseEvent> = (event) =>
  event.preventDefault()
// A double-click is two toggles; it must not also reach `onDoubleClick`
// (rename, open) as though the row itself had been double-clicked.
const handleMarkerDoubleClick: JSX.EventHandler<HTMLSpanElement, MouseEvent> = (event) =>
  event.stopPropagation()

function isActionTarget(target: EventTarget | null, currentTarget: HTMLElement): boolean {
  if (!(target instanceof Element) || target === currentTarget) return false
  return Boolean(
    target.closest(
      'a, button, input, textarea, select, [contenteditable="true"], [role="button"], [data-tree-keyboard-stop]'
    )
  )
}

function composeRefs(
  internal: (element: HTMLDivElement) => void,
  external: () => ComponentProps<'div'>['ref']
): (element: HTMLDivElement) => void {
  return (element) => {
    internal(element)
    const ref = external()
    if (typeof ref === 'function') ref(element)
  }
}

export type { TreeItemDescriptor } from './tree-navigation'
