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
}

const ANCHOR_ATTRIBUTE = 'data-anchor-id'

export function captureAnchor(scroller: HTMLElement): ScrollAnchor {
  const top = scroller.getBoundingClientRect().top
  let anchor: { id: string; offset: number } | undefined
  for (const element of scroller.querySelectorAll<HTMLElement>(`[${ANCHOR_ATTRIBUTE}]`)) {
    const box = element.getBoundingClientRect()
    if (box.bottom > top) {
      anchor = { id: element.getAttribute(ANCHOR_ATTRIBUTE)!, offset: box.top - top }
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
 */
export function restoreAnchor(scroller: HTMLElement, anchor: ScrollAnchor | undefined): number {
  if (!anchor) return 0
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
  return correction
}
