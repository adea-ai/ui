/** A visible tree row's host-owned projection metadata. */
export type TreeItemDescriptor = {
  /** Stable identity shared with the host's domain item. */
  id: string
  /** Stable parent identity, or null for a root item. */
  parentId: string | null
  /** One-based depth exposed to assistive technology. */
  level: number
  /** Whether this item can be expanded. */
  expandable: boolean
  /** Whether this item is currently expanded. */
  expanded: boolean
}

export type TreeNavigationIndex = {
  ids: readonly string[]
  byId: ReadonlyMap<string, TreeItemDescriptor>
  indexById: ReadonlyMap<string, number>
  firstChildByParent: ReadonlyMap<string, string>
  positionById: ReadonlyMap<string, { position: number; setSize: number }>
}

export type TreeNavigationAction =
  | { type: 'focus'; id: string }
  | { type: 'expand'; id: string; expanded: boolean }
  | { type: 'activate'; id: string }
  | { type: 'select'; id: string }

/**
 * Indexes the complete expanded projection once per host update. The DOM may
 * contain only a window of these rows; this index keeps keyboard movement and
 * aria-setsize independent of the mounted window.
 */
export function indexTreeItems(items: readonly TreeItemDescriptor[]): TreeNavigationIndex {
  const byId = new Map<string, TreeItemDescriptor>()
  const indexById = new Map<string, number>()
  const firstChildByParent = new Map<string, string>()
  const siblingsByParent = new Map<string | null, string[]>()

  items.forEach((item, index) => {
    if (byId.has(item.id)) {
      throw new Error(`[adea-ui]: Tree visibleItems contains duplicate id "${item.id}".`)
    }
    byId.set(item.id, item)
    indexById.set(item.id, index)

    const siblings = siblingsByParent.get(item.parentId) ?? []
    siblings.push(item.id)
    siblingsByParent.set(item.parentId, siblings)

    if (item.parentId !== null && !firstChildByParent.has(item.parentId)) {
      firstChildByParent.set(item.parentId, item.id)
    }
  })

  const positionById = new Map<string, { position: number; setSize: number }>()
  for (const siblings of siblingsByParent.values()) {
    siblings.forEach((id, index) => {
      positionById.set(id, { position: index + 1, setSize: siblings.length })
    })
  }

  return {
    ids: items.map((item) => item.id),
    byId,
    indexById,
    firstChildByParent,
    positionById,
  }
}

/** Resolves one keyboard event without owning tree data or host actions. */
export function treeNavigationAction(
  index: TreeNavigationIndex,
  activeId: string | null,
  key: string
): TreeNavigationAction | null {
  const { ids, byId, indexById, firstChildByParent } = index
  if (ids.length === 0) return null

  const activeIndex = activeId === null ? undefined : indexById.get(activeId)
  const active = activeId === null ? undefined : byId.get(activeId)

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    const step = key === 'ArrowDown' ? 1 : -1
    const start = activeIndex ?? (step > 0 ? -1 : 0)
    const nextIndex = (start + step + ids.length) % ids.length
    const id = ids[nextIndex]
    return id === undefined ? null : { type: 'focus', id }
  }

  if (key === 'Home') return { type: 'focus', id: ids[0]! }
  if (key === 'End') return { type: 'focus', id: ids[ids.length - 1]! }
  if (!active) return null

  if (key === 'ArrowRight' && active.expandable) {
    if (!active.expanded) return { type: 'expand', id: active.id, expanded: true }
    const childId = firstChildByParent.get(active.id)
    return childId ? { type: 'focus', id: childId } : null
  }

  if (key === 'ArrowLeft') {
    if (active.expandable && active.expanded) {
      return { type: 'expand', id: active.id, expanded: false }
    }
    if (active.parentId !== null && byId.has(active.parentId)) {
      return { type: 'focus', id: active.parentId }
    }
  }

  if (key === 'Enter') return { type: 'activate', id: active.id }
  if (key === ' ' || key === 'Spacebar') return { type: 'select', id: active.id }
  return null
}
