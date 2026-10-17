/**
 * Keeping the reader's place when content appears above them.
 *
 * The browser's own scroll anchoring does this in some engines for some DOM
 * shapes and not in others (and not at all with `content-visibility`), so it is
 * done explicitly: remember which turn was first in view and how far below the
 * viewport's top it sat, then after the insert scroll so it sits there again.
 *
 * Only the *content's* movement is undone. A reader who scrolls while the load
 * is open (a wheel fling or touch momentum that was still running when the
 * anchor was taken) moves the turn on purpose, so each restore first accounts
 * for how far the scroll offset has travelled since the last one and puts the
 * turn where that movement leaves it, not where it started. Restoring to the
 * captured offset instead would cancel the reader's scroll and leave them short
 * of where they were going.
 */
export type ScrollAnchor = {
  /** `data-anchor-id` of the first turn intersecting the viewport. */
  id: string | undefined
  /** Where its top edge is meant to sit relative to the scroller's top edge, in px. */
  offset: number
  /** Fallback when no turn carries an id: the scroll height at the last restore. */
  scrollHeight: number
  /** The scroll offset at the last restore, which the reader's movement is measured from. */
  scrollTop: number
  /**
   * When set, only these turns can become the anchor when the reader moves: the ones that
   * were there when the load began. A turn that has just landed is still at its estimated
   * height, and anchoring on it takes the correction from a row that is about to resize.
   */
  known?: ReadonlySet<string>
}

const ANCHOR_ATTRIBUTE = 'data-anchor-id'

/** The ids of the turns in the scroller now. */
export function anchorIds(scroller: HTMLElement): Set<string> {
  const ids = new Set<string>()
  for (const element of scroller.querySelectorAll<HTMLElement>(`[${ANCHOR_ATTRIBUTE}]`))
    ids.add(element.getAttribute(ANCHOR_ATTRIBUTE)!)
  return ids
}

export function captureAnchor(scroller: HTMLElement, known?: ReadonlySet<string>): ScrollAnchor {
  const top = scroller.getBoundingClientRect().top
  let anchor: { id: string; offset: number } | undefined
  for (const element of scroller.querySelectorAll<HTMLElement>(`[${ANCHOR_ATTRIBUTE}]`)) {
    const id = element.getAttribute(ANCHOR_ATTRIBUTE)!
    if (known && !known.has(id)) continue
    const box = element.getBoundingClientRect()
    if (box.bottom > top) {
      anchor = { id, offset: box.top - top }
      break
    }
  }
  return {
    id: anchor?.id,
    offset: anchor?.offset ?? 0,
    scrollHeight: scroller.scrollHeight,
    scrollTop: scroller.scrollTop,
  }
}

/**
 * Put the anchor back where the reader's own scrolling leaves it. Returns the
 * correction applied, in px. The anchor is re-based on every call, so a second
 * restore after the same insert finds nothing left to correct.
 *
 * If the reader has moved since the last restore, the anchor is then re-taken on the
 * turn now in view. An anchor left where the load began can end up well away from
 * where the reader has come to rest, and everything between the two is part of its
 * position: a row there that sizes itself late (an image, highlighted code, a row
 * leaving `content-visibility`) would move the anchor without moving anything the
 * reader is looking at, and restoring it would carry the reader along.
 *
 * The reader's move is read here, from the offset itself, and not from a scroll event:
 * the event is delivered at the next rendering opportunity, after the content
 * observers have run for a change made in the same task, and a restore that re-bases
 * the offset first would otherwise erase the move before the event arrives. The offset
 * the restore itself leaves is the base, so the scroll event that a restore causes
 * finds nothing to follow.
 */
export function restoreAnchor(scroller: HTMLElement, anchor: ScrollAnchor | undefined): number {
  if (!anchor) return 0
  const readerMoved = Math.abs(scroller.scrollTop - anchor.scrollTop) > 0.5
  const top = scroller.getBoundingClientRect().top
  // Scrolling by `travelled` moves a turn up the viewport by the same amount.
  const travelled = scroller.scrollTop - anchor.scrollTop
  let correction = 0
  if (anchor.id !== undefined) {
    const target = Array.from(scroller.querySelectorAll<HTMLElement>(`[${ANCHOR_ATTRIBUTE}]`)).find(
      (element) => element.getAttribute(ANCHOR_ATTRIBUTE) === anchor.id
    )
    if (target) {
      const expected = anchor.offset - travelled
      correction = target.getBoundingClientRect().top - top - expected
      anchor.offset = expected
    }
  } else {
    // The growth since the last restore is added to where the reader is, so a
    // second restore after the same insert (the observer and the settle both run
    // one) finds the growth already applied and moves nothing, and growth that
    // lands later moves it only by what is still missing.
    correction = scroller.scrollHeight - anchor.scrollHeight
  }
  if (Math.abs(correction) >= 1) scroller.scrollTop += correction
  anchor.scrollTop = scroller.scrollTop
  anchor.scrollHeight = scroller.scrollHeight
  if (readerMoved) {
    const next = captureAnchor(scroller, anchor.known)
    // No turn that was there before the load is in view (the reader is among the rows
    // that landed): keep the anchor rather than fall back to the height.
    if (next.id !== undefined || anchor.id === undefined) Object.assign(anchor, next)
  }
  return correction
}
