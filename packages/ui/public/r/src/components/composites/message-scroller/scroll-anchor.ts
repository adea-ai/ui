/**
 * Keeping the reader's place when content appears above them.
 *
 * The browser's own scroll anchoring does this in some engines for some DOM
 * shapes and not in others (and not at all with `content-visibility`), so it is
 * done explicitly: remember which turn was first in view and how far below the
 * viewport's top it sat, then after the insert scroll so it sits there again.
 */
export type ScrollAnchor = Readonly<{
  /** `data-anchor-id` of the first turn intersecting the viewport. */
  id: string | undefined
  /** Its top edge relative to the scroller's top edge, in px. */
  offset: number
  /** Fallback when no turn carries an id: the scroll height before the insert. */
  scrollHeight: number
  scrollTop: number
}>

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

/** Put the anchor back where it was. Returns the correction applied, in px. */
export function restoreAnchor(scroller: HTMLElement, anchor: ScrollAnchor | undefined): number {
  if (!anchor) return 0
  const top = scroller.getBoundingClientRect().top
  let correction = 0
  if (anchor.id !== undefined) {
    const target = Array.from(scroller.querySelectorAll<HTMLElement>(`[${ANCHOR_ATTRIBUTE}]`)).find(
      (element) => element.getAttribute(ANCHOR_ATTRIBUTE) === anchor.id
    )
    if (target) correction = target.getBoundingClientRect().top - top - anchor.offset
  } else {
    correction = scroller.scrollHeight - anchor.scrollHeight
  }
  if (Math.abs(correction) >= 1) scroller.scrollTop += correction
  return correction
}
