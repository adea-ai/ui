/**
 * The ordering rules behind the workspace switcher's reorder dialog.
 *
 * Kept free of any view so the rules (a fixed workspace never moves and nothing
 * moves past it) are held by unit tests rather than by clicking through a menu.
 */
export type WorkspaceOrderItem = { id: string; fixed?: boolean }

export type WorkspaceMoveDirection = 'up' | 'down'

/** The position a move would land on, or undefined when the move is not allowed. */
export function moveTarget(
  items: readonly WorkspaceOrderItem[],
  id: string,
  direction: WorkspaceMoveDirection
): number | undefined {
  const from = items.findIndex((item) => item.id === id)
  if (from < 0 || items[from]?.fixed) return undefined
  const to = direction === 'up' ? from - 1 : from + 1
  const neighbour = items[to]
  if (!neighbour || neighbour.fixed) return undefined
  return to
}

/** The ids in their new order after one move, or undefined when the move is not allowed. */
export function moveWorkspace(
  items: readonly WorkspaceOrderItem[],
  id: string,
  direction: WorkspaceMoveDirection
): string[] | undefined {
  const to = moveTarget(items, id, direction)
  if (to === undefined) return undefined
  const ids = items.map((item) => item.id)
  const from = ids.indexOf(id)
  ids.splice(from, 1)
  ids.splice(to, 0, id)
  return ids
}
