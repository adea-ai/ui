/*
 * Tooltips open on active hover over the control, or on keyboard focus that
 * follows a Tab key press. They must never open from programmatic focus: the
 * autofocus a dialog or sheet gives its first control, and the focus a closing
 * overlay restores to its opener, both land on buttons that carry tooltips —
 * and the tooltip primitive opens immediately on focus and pins the tooltip
 * until blur. That is the "tooltip auto-displays when a sheet opens" report,
 * and the pinned tooltip is the "tooltip gets stuck and never disappears"
 * report: the pointer is nowhere near the control, so no pointer leave ever
 * closes it.
 *
 * The trigger listens for the native `focus` event on the trigger element, and
 * composites build tooltips internally (ActionButton renders one from its
 * `tooltip` prop), so the single interception point that covers every tooltip
 * is a capture-phase `focus` listener on `document`. When focus lands without a
 * keyboard-intent signal on a button-like element, the event is stopped before
 * any element listener runs: the tooltip never learns about the focus. Hover
 * opens are untouched (they ride pointer events), and the separate `focusin`
 * event still flows, so dialog focus-cycle tracking, `:focus-visible` styling,
 * and focus restoration all keep working. Focus still lands — only the event
 * is stopped — so `document.activeElement` and scripted `.blur()` behave.
 *
 * The keyboard-intent signal is a Tab key press immediately before the focus —
 * the only key that moves focus natively. Enter and Space open overlays too,
 * so any "recent key" window wide enough for those would let an overlay's own
 * autofocus back through; Tab-only keeps autofocus suppressed no matter how
 * the overlay was opened, while normal Tab navigation still announces each
 * control's tooltip (hover descriptions stay reachable from the keyboard).
 *
 * Suppression is scoped to button-like targets (`button`, `a[href]`,
 * `[role="button"]`, `[role="link"]`). Composite widgets that move focus
 * programmatically — menu items, listbox options, grid cells — are other
 * element types whose roving-focus highlighting must keep receiving focus
 * events, and text controls keep their own focus behaviour (select on focus,
 * caret placement).
 *
 * Suppressed focus is real as far as the DOM is concerned (`activeElement`
 * moves; only the event was stopped), and the tooltip interaction model treats
 * a trigger that is `activeElement` as keyboard-held: while a tooltip on it is
 * open, pointer movement away only *requests* a close and the request is
 * refused for as long as the pointer keeps moving. Left alone, a later real
 * hover on that control would open the tip and never let it leave — the
 * residual "stuck" case. The gate therefore treats a suppressed focus as a
 * phantom and releases it: the first pointer activity after the focus (a
 * pointer session taking over from a script) blurs the element. Keyboard
 * sessions never release it and never need to — keyboard focus moves by Tab,
 * which is never suppressed, so nothing pins; and the release only runs for
 * elements still holding `activeElement`, so a Tab already taken from the
 * phantom is left alone.
 *
 * Focus that arrives while a pointer button is held belongs to a pointer
 * gesture, not to a tooltip: the pixel resize handle focuses its handle when a
 * drag starts and cancels the drag on blur, so a gesture focus must pass
 * through untouched (no suppression, no phantom, no release). A gesture's own
 * click behaviour already keeps tooltips closed, and the autofocus cases this
 * gate exists for all happen with the pointer up.
 *
 * Independently of the gesture window, resize grips render as
 * `<button role="separator">` and carry no tooltip, so they are excluded from
 * the button-like scope entirely (see `isButtonLikeFocusTarget`).
 *
 * The gate is installed by the `Tooltip` root for the lifetime of the first
 * tooltip in a document and removed when the last one unmounts, so every
 * consumer of the primitive — including composites that build their own
 * tooltips — inherits the contract without wiring of its own.
 */

/** How long after a Tab key press a resulting focus event still counts as
 *  keyboard navigation. The native focus move follows the key press
 *  immediately; the window only has to bridge that dispatch, not a later
 *  script-driven focus. */
export const TOOLTIP_FOCUS_INTENT_WINDOW_MS = 250

/** Elements a tooltip-bearing control is rendered as. Everything else keeps
 *  its native focus behaviour, and so do resize grips (see below). */
const BUTTON_LIKE_SELECTOR = 'button, a[href], [role="button"], [role="link"]'

/**
 * Whether a focus event landing on this target could open a tooltip on a
 * button-like control. Accepts any Element (an SVG glyph inside a control,
 * for instance) and duck-types so the decision is testable without a DOM.
 */
export function isButtonLikeFocusTarget(target: unknown): boolean {
  const element = target as Element | null | undefined
  if (typeof element?.closest !== 'function') return false
  const control = element.closest(BUTTON_LIKE_SELECTOR)
  if (control === null) return false
  // Resize grips render as `<button role="separator">` and focus themselves
  // when a pointer drag starts. They carry no tooltip, and the blur that
  // releases a suppressed focus would end the drag on its first move.
  return control.getAttribute?.('role') !== 'separator'
}

/**
 * The suppression decision: a button-like focus target hides a tooltip only
 * when no keyboard navigation is in flight. Anything else — a Tab-driven
 * focus, or focus on a non-button element — passes through untouched.
 */
export function shouldSuppressTooltipFocus(input: {
  isButtonLike: boolean
  keyboardIntentActive: boolean
}): boolean {
  return input.isButtonLike && !input.keyboardIntentActive
}

const installedDocuments = new WeakSet<Document>()

/**
 * Install the gate on a document. Idempotent per document; returns a disposer
 * that removes the listeners (used by tests and by the tooltip root, which
 * releases the gate when its document's last tooltip unmounts).
 */
export function installTooltipFocusGate(doc: Document = document): () => void {
  if (installedDocuments.has(doc)) return () => {}

  let lastTabKeyDownAt = 0
  /** True between a pointerdown and its pointerup/pointercancel: focus events
   *  inside that window belong to a pointer gesture (drag bootstrap, press)
   *  and must reach their element untouched. */
  let pointerGestureActive = false
  /** The element holding a suppressed programmatic focus, if it still holds
   *  `activeElement`. One slot: a newer suppressed focus replaces an older
   *  one, and anything that already lost focus needs no release. */
  let phantomFocusTarget: Element | undefined
  /** The phantom-release `pointermove` listener exists only while a phantom
   *  does: a gate that parks a permanent pointer listener on every document
   *  with a tooltip in it costs every page a standing listener for a state
   *  that is live for a few hundred milliseconds at most. */
  let phantomReleaseAttached = false
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') lastTabKeyDownAt = Date.now()
  }
  const onPointerDown = () => {
    pointerGestureActive = true
    releasePhantomFocus()
  }
  const onPointerGestureEnd = () => {
    pointerGestureActive = false
  }
  const onFocus = (event: FocusEvent) => {
    if (pointerGestureActive) return
    if (!isButtonLikeFocusTarget(event.target)) return
    const keyboardIntentActive = Date.now() - lastTabKeyDownAt <= TOOLTIP_FOCUS_INTENT_WINDOW_MS
    if (!shouldSuppressTooltipFocus({ isButtonLike: true, keyboardIntentActive })) return
    event.stopPropagation()
    phantomFocusTarget = event.target as Element
    if (!phantomReleaseAttached) {
      phantomReleaseAttached = true
      doc.addEventListener('pointermove', onPointerMove, true)
    }
  }
  const releasePhantomFocus = () => {
    if (pointerGestureActive) return
    const phantom = phantomFocusTarget
    if (!phantom) return
    phantomFocusTarget = undefined
    if (phantomReleaseAttached) {
      phantomReleaseAttached = false
      doc.removeEventListener('pointermove', onPointerMove, true)
    }
    if ((doc as Document).activeElement !== phantom) return
    if (typeof (phantom as HTMLElement).blur === 'function') (phantom as HTMLElement).blur()
  }
  const onPointerMove = () => releasePhantomFocus()

  doc.addEventListener('keydown', onKeyDown, true)
  doc.addEventListener('focus', onFocus, true)
  doc.addEventListener('pointerdown', onPointerDown, true)
  doc.addEventListener('pointerup', onPointerGestureEnd, true)
  doc.addEventListener('pointercancel', onPointerGestureEnd, true)
  installedDocuments.add(doc)
  return () => {
    doc.removeEventListener('keydown', onKeyDown, true)
    doc.removeEventListener('focus', onFocus, true)
    doc.removeEventListener('pointerdown', onPointerDown, true)
    doc.removeEventListener('pointerup', onPointerGestureEnd, true)
    doc.removeEventListener('pointercancel', onPointerGestureEnd, true)
    doc.removeEventListener('pointermove', onPointerMove, true)
    installedDocuments.delete(doc)
  }
}

/**
 * Reference-counted install for the tooltip root: the first tooltip in a
 * document acquires the gate, the last one to unmount releases it. The document
 * parameter exists so tests can drive the counter without a global DOM; the
 * production call site guards on the server render before calling.
 */
const gateHolders = new WeakMap<Document, number>()
const gateDisposers = new WeakMap<Document, () => void>()

export function acquireTooltipFocusGate(targetDoc?: Document): void {
  if (typeof document === 'undefined' && !targetDoc) return
  const doc = targetDoc ?? document
  const holders = gateHolders.get(doc) ?? 0
  gateHolders.set(doc, holders + 1)
  if (holders === 0) gateDisposers.set(doc, installTooltipFocusGate(doc))
}

export function releaseTooltipFocusGate(targetDoc?: Document): void {
  if (typeof document === 'undefined' && !targetDoc) return
  const doc = targetDoc ?? document
  const holders = gateHolders.get(doc) ?? 0
  if (holders === 0) return
  if (holders === 1) {
    gateHolders.delete(doc)
    gateDisposers.get(doc)?.()
    gateDisposers.delete(doc)
    return
  }
  gateHolders.set(doc, holders - 1)
}
