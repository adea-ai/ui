/**
 * Keeping the reader's place when content appears above them.
 *
 * The browser's own scroll anchoring does this in some engines for some DOM
 * shapes and not in others (and not at all with `content-visibility`), so it is
 * done explicitly. What is remembered is where the turns around the viewport sit
 * in the document (their distance from the top of the content, which scrolling
 * does not change). After the content moves, the turn the reader is on is found
 * again and the scroll offset is moved by however far it moved in the document, so
 * it sits where it did in the viewport.
 *
 * Only the *content's* movement is undone, because the reader's scrolling does not
 * move a turn in the document. A reader who scrolls while a load is open (a wheel
 * fling or touch momentum that was still running when the load began) keeps the
 * scroll: nothing is restored to an offset captured earlier.
 *
 * It is the turn the reader was on that is measured, found from where the turns sat
 * when the marks were taken and not from where the change has left them: a row above
 * the reader that grows far enough to reach into the view has not become the turn they
 * are reading, and the turn they are reading has moved down by the growth. Nothing
 * below that turn counts: a row further down that sizes itself late (an
 * image, highlighted code, a row leaving `content-visibility`) moves rows below the
 * reader, not the reader. The turns above the reader count, because they are what
 * an insert or a late resize above pushes the view down by.
 */
export type ScrollAnchor = {
  /** `data-anchor-id` of the first turn in view when the marks were taken, if any turn has one. */
  id: string | undefined
  /**
   * The document position (px from the top of the content) of the turns around the
   * viewport when the marks were taken, by id: a few above the first one in view, it, and
   * some below. Empty when no turn carries an id.
   */
  marks: Map<string, number>
  /** The document position of the bottom edge of each marked turn, when the marks were taken. */
  ends: Map<string, number>
  /** Fallback when no turn carries an id: the scroll height at the last restore. */
  scrollHeight: number
  /** The scroll offset at the last restore. */
  scrollTop: number
  /**
   * When set, only these turns are marked: the ones that were there when the load began.
   * A turn that has just landed is still at its estimated height, so a correction taken
   * from it would come from a row about to resize.
   */
  known?: ReadonlySet<string>
}

const ANCHOR_ATTRIBUTE = 'data-anchor-id'

/** Turns marked above the first one in view, and below it. */
const MARKS_ABOVE = 8
const MARKS_BELOW = 12

/** The ids of the turns in the scroller now. */
export function anchorIds(scroller: HTMLElement): Set<string> {
  const ids = new Set<string>()
  for (const element of scroller.querySelectorAll<HTMLElement>(`[${ANCHOR_ATTRIBUTE}]`))
    ids.add(element.getAttribute(ANCHOR_ATTRIBUTE)!)
  return ids
}

/** Mark the turns around the viewport: where each sits in the document now. */
export function captureAnchor(scroller: HTMLElement, known?: ReadonlySet<string>): ScrollAnchor {
  const box = scroller.getBoundingClientRect()
  const scrollTop = scroller.scrollTop
  const marks = new Map<string, number>()
  const ends = new Map<string, number>()
  const above: Array<[string, number, number]> = []
  let id: string | undefined
  let below = 0
  for (const element of scroller.querySelectorAll<HTMLElement>(`[${ANCHOR_ATTRIBUTE}]`)) {
    const turn = element.getAttribute(ANCHOR_ATTRIBUTE)!
    if (known && !known.has(turn)) continue
    const rect = element.getBoundingClientRect()
    const position = rect.top - box.top + scrollTop
    const end = rect.bottom - box.top + scrollTop
    if (id === undefined) {
      if (rect.bottom > box.top) {
        id = turn
        for (const [earlier, where, bottom] of above) {
          marks.set(earlier, where)
          ends.set(earlier, bottom)
        }
        marks.set(turn, position)
        ends.set(turn, end)
      } else {
        above.push([turn, position, end])
        if (above.length > MARKS_ABOVE) above.shift()
      }
    } else {
      marks.set(turn, position)
      ends.set(turn, end)
      below += 1
      if (below >= MARKS_BELOW) break
    }
  }
  return { id, marks, ends, scrollHeight: scroller.scrollHeight, scrollTop }
}

/**
 * The marked turn the reader is on and where it sits in the document now. The turn is
 * chosen by where the marked turns were (the first one that reached into the view at the
 * scroll offset now, or the last one if every marked turn was above it), among those still
 * in the scroller; its position is read from where the content has put it.
 */
function turnInView(
  scroller: HTMLElement,
  anchor: ScrollAnchor
): { id: string; position: number } | undefined {
  const box = scroller.getBoundingClientRect()
  const scrollTop = scroller.scrollTop
  const present = new Map<string, number>()
  for (const element of scroller.querySelectorAll<HTMLElement>(`[${ANCHOR_ATTRIBUTE}]`)) {
    const id = element.getAttribute(ANCHOR_ATTRIBUTE)!
    if (anchor.marks.has(id))
      present.set(id, element.getBoundingClientRect().top - box.top + scrollTop)
  }
  let last: { id: string; position: number } | undefined
  for (const id of anchor.marks.keys()) {
    const position = present.get(id)
    if (position === undefined) continue
    last = { id, position }
    if ((anchor.ends.get(id) ?? Infinity) > scrollTop) return last
  }
  return last
}

/**
 * Put the reader back where the content's movement left them. Returns the correction
 * applied, in px.
 *
 * The turn the reader is on is found among the marked turns, and the scroll offset is
 * moved by how far that turn has moved in the document since the marks were taken: an
 * insert or a late resize above it moves it, scrolling and growth below it do not.
 * The marks are then taken again around wherever the reader now is, so a second restore
 * after the same change finds nothing left to correct, and a reader who has moved on
 * (before this call, in the same task as a change, or by a scroll event that has not
 * yet arrived) is measured from the turn they are on and not from one they have left.
 * Nothing here depends on seeing the scroll event first.
 */
export function restoreAnchor(scroller: HTMLElement, anchor: ScrollAnchor | undefined): number {
  if (!anchor) return 0
  let correction = 0
  if (anchor.marks.size > 0) {
    const turn = turnInView(scroller, anchor)
    if (turn) correction = turn.position - anchor.marks.get(turn.id)!
  } else if (anchor.id === undefined) {
    // No turn carries an id: the growth since the last restore is added to where the
    // reader is, so a second restore after the same insert (the observer and the settle
    // both run one) finds it already applied, and growth that lands later moves the
    // reader only by what is still missing.
    correction = scroller.scrollHeight - anchor.scrollHeight
  }
  if (Math.abs(correction) >= 1) scroller.scrollTop += correction
  const next = captureAnchor(scroller, anchor.known)
  if (next.marks.size > 0 || anchor.marks.size === 0) {
    anchor.id = next.id
    anchor.marks = next.marks
    anchor.ends = next.ends
  } else {
    // None of the turns that were there before the load is in view (the reader is among
    // the rows that landed): keep the old marks, moved by what the content did.
    for (const [id, position] of anchor.marks) anchor.marks.set(id, position + correction)
    for (const [id, end] of anchor.ends) anchor.ends.set(id, end + correction)
  }
  anchor.scrollTop = scroller.scrollTop
  anchor.scrollHeight = scroller.scrollHeight
  return correction
}
