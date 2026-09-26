import type { SplitLayoutBranch } from './model'
export type PaneDropIntent = {
  direction: SplitLayoutBranch['direction']
  placement: 'before' | 'after'
}
/** Accepted Adea closest-edge intent; invalid/outside geometry cannot authorize a move. */
export function paneDropIntent(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): PaneDropIntent | undefined {
  const { left, top, width, height } = rect
  if (
    ![clientX, clientY, left, top, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return
  const x = clientX - left
  const y = clientY - top
  if (x < 0 || y < 0 || x > width || y > height) return
  const candidates: { distance: number; intent: PaneDropIntent }[] = [
    { distance: x, intent: { direction: 'row', placement: 'before' } },
    { distance: width - x, intent: { direction: 'row', placement: 'after' } },
    { distance: y, intent: { direction: 'column', placement: 'before' } },
    { distance: height - y, intent: { direction: 'column', placement: 'after' } },
  ]
  return candidates.reduce((best, next) => (next.distance < best.distance ? next : best)).intent
}
