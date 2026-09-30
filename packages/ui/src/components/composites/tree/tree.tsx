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
  onActiveIdChange: (id: string) => void
}

const TreeContext = createContext<TreeContextValue>()

function useTreeContext() {
  const tree = useContext(TreeContext)
  if (!tree) throw new Error('[adea-ui]: TreeRow must be used inside Tree.')
  return tree
}

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
    /** Called when keyboard or pointer navigation changes the active row. */
    onActiveIdChange: (id: string) => void
    /** Called for Left/Right expand and collapse requests. */
    onExpand?: (id: string, expanded: boolean) => void
    /** Called for Enter or pointer activation. Domain action stays host-owned. */
    onActivate?: (id: string, event: Event) => void
    /** Called for Space selection. Selection state stays host-owned. */
    onSelectItem?: (id: string, event: Event) => void
    /** Ask the host window to mount/reveal an item before focus moves to it. */
    onRequestReveal?: (id: string) => void
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
 */
export function Tree(props: TreeProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'visibleItems',
    'activeId',
    'onActiveIdChange',
    'onExpand',
    'onActivate',
    'onSelectItem',
    'onRequestReveal',
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
  let pendingFocusId: string | null = null
  let requestedRevealId: string | null = null
  let focusedId: string | null = null
  let disposed = false

  onCleanup(() => {
    disposed = true
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
    onActiveIdChange: local.onActiveIdChange,
  }

  // A filtered or removed active ID falls back to the first visible item. This
  // keeps one treeitem in the sequential tab order while notifying the host.
  createEffect(() => {
    const activeId = effectiveActiveId()
    if (activeId === null) return
    // If a host filter removes the row that had DOM focus, move focus to the
    // same projection fallback that now owns the roving tab stop.
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
        class={cn('flex min-w-0 flex-col', local.class)}
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

  return (
    <div
      {...rest}
      ref={composeRefs(setRef, () => local.ref)}
      id={rest.id ?? `${tree.idPrefix}-item-${encodeURIComponent(id())}`}
      role="treeitem"
      aria-level={local.item.level}
      aria-expanded={local.item.expandable ? String(local.item.expanded) : undefined}
      aria-selected={local.selected === undefined ? undefined : String(local.selected)}
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
      <span class="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground">
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
