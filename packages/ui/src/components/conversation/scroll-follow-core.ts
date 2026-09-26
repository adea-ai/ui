/*
 * Substantially translated from KiroCrew website/src/hooks/virtualizer/FollowController.ts
 * (plain-scroller decision units), pinned at
 * 283e136c0f902e965a535a7c9548c57c7504fed0.
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * This product includes software developed at Amazon.com, Inc.
 * (https://www.amazon.com/).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Pure plain-scroller decisions retained from FollowController; virtual row
 * measurement, persisted anchor resolution and restore settling are excluded.
 */
/** Default distance (px) from the bottom within which `isAtBottom` is true. */
export const DEFAULT_BOTTOM_THRESHOLD = 100

/**
 * Tolerance (px) for treating a scroll position as "the same" as a value we
 * wrote programmatically. Covers sub-pixel rounding and 1px momentum overshoot.
 * Must stay small so a deliberate user scroll of even a few px is still seen as
 * a user scroll.
 */
export const SELF_SCROLL_EPSILON = 2

/**
 * "At the bottom" tolerance (px) for deciding whether an auto-pin still has
 * work to do. A flat 0.5 is UNDER one device pixel at fractional device-pixel
 * ratios (0.67 CSS px at 150% zoom, 0.8 at 125%): the scroller's resting
 * maximum scrollTop lands on a fractional value, so `|scrollTop - target|`
 * stays just above 0.5 even when the viewport is visually pinned to the
 * bottom — making the pin re-fire on every ResizeObserver tick. Scaling the
 * epsilon to the device pixel (never below 1 CSS px) absorbs that fractional
 * resting error. `devicePixelRatio` is read defensively so a jsdom / SSR
 * environment that leaves it undefined falls back to 1 (→ 1.5px).
 */
export function atBottomEpsilon(): number {
  const dpr =
    typeof window !== 'undefined' &&
    typeof window.devicePixelRatio === 'number' &&
    window.devicePixelRatio > 0
      ? window.devicePixelRatio
      : 1
  return Math.max(1, 1 / dpr + 0.5)
}

/** Live scroll geometry snapshot read from the scroller element. */
export interface ScrollGeom {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

/** scrollTop that places the viewport exactly at the bottom (never negative). */
export function bottomTarget(geom: ScrollGeom): number {
  return Math.max(0, geom.scrollHeight - geom.clientHeight)
}

/** Pixels between the current scroll position and the bottom. */
export function distanceFromBottom(geom: ScrollGeom): number {
  return geom.scrollHeight - geom.scrollTop - geom.clientHeight
}

/** Whether the scroller is within `threshold` px of the bottom. */
export function computeAtBottom(geom: ScrollGeom, threshold: number): boolean {
  return distanceFromBottom(geom) <= threshold
}

/**
 * Recognise a `scroll` event caused by our own programmatic write rather than
 * by the user. `lastWriteTop < 0` means "we have not written this session", so
 * any scroll is treated as the user's.
 */
export function isSelfScroll(
  scrollTop: number,
  lastWriteTop: number,
  epsilon: number = SELF_SCROLL_EPSILON
): boolean {
  return lastWriteTop >= 0 && Math.abs(scrollTop - lastWriteTop) <= epsilon
}

/**
 * Distance (px) from the true bottom within which a user scroll RE-ENGAGES
 * follow. Deliberately much tighter than DEFAULT_BOTTOM_THRESHOLD: that 100px
 * band drives the jump-to-bottom pill's visibility, and reusing it for follow
 * meant a deliberate 3-99px scroll-up kept `stick` armed — the next content
 * change then yanked the reader back to the bottom. Re-engaging only when the
 * user has returned essentially to the bottom keeps "scrolled up to read"
 * positions belonging to the user.
 */
export const FOLLOW_REENGAGE_PX = 16

/**
 * Direction-aware `stick` decision for a *user-initiated* scroll (self-scrolls
 * filtered out by the caller via `isSelfScroll`):
 *
 *   1. At the true bottom (within the DPR-aware epsilon) → follow. This also
 *      absorbs the layout engine's clamp: a mid-stream content SHRINK drops
 *      scrollTop (which reads as an upward move) but lands exactly at the new
 *      bottom — releasing there froze streaming follow for the rest of the
 *      turn.
 *   2. Any other upward move → release, regardless of distance from the
 *      bottom. The scroll position now belongs to the user; only returning to
 *      the bottom (3) re-engages.
 *   3. A genuine DOWNWARD move that arrives within FOLLOW_REENGAGE_PX of the
 *      bottom → re-engage. A neutral event inside the band does NOT: that is
 *      how content collapsing under a still reader re-armed follow.
 *   4. Otherwise (downward/neutral, still away from the bottom) → keep the
 *      previous state.
 *
 * `prevScrollTop < 0` means "no prior observation this session". Direction is
 * unknowable then, so the decision is position-only and CONSERVATIVE: follow
 * only within the re-engage band. Keeping a stale `stick` on an unattributable
 * away-from-bottom scroll is how a reader gets yanked.
 */
export function resolveUserScrollStick(args: {
  stick: boolean
  followOutput: boolean
  scrollTop: number
  prevScrollTop: number
  geom: ScrollGeom
  /** Change in the scroller's own height since the previous scroll event.
   *
   *  Positive = the viewport GREW (the composer shrank under a deletion, the
   *  keyboard closed). That growth lowers the maximum scrollTop, so the engine
   *  clamps any reader parked closer to the bottom than the growth — with no
   *  application write anywhere. The clamp then arrives here as an ordinary
   *  scroll event sitting at distance ~0, which rule 1 below used to read as
   *  "the reader came back to the bottom" and re-arm follow for someone who
   *  never touched the scroller. The next turn to start then took them to the
   *  end. Rule 1 exists to absorb a CONTENT-shrink clamp mid-stream, and content
   *  shrink moves `scrollHeight`, not `clientHeight` — so the two are
   *  distinguishable, and this is the delta that tells them apart. */
  viewportGrowth?: number
}): boolean {
  const { stick, followOutput, scrollTop, prevScrollTop, geom } = args
  if (!followOutput) return false
  const dist = distanceFromBottom(geom)
  // A viewport growth large enough to explain the reader's arrival at the bottom
  // is the engine's clamp, not the reader. Leave `stick` exactly as it was.
  // A native clamp only ever LOWERS scrollTop, so a downward move concurrent with
  // the growth is the user's own and must still re-engage follow. Without the
  // direction term a reader who deliberately scrolls down while the keyboard
  // closes is refused their re-engagement.
  const clampedByViewport =
    (args.viewportGrowth ?? 0) > atBottomEpsilon() && scrollTop <= prevScrollTop + atBottomEpsilon()
  if (dist <= atBottomEpsilon()) return clampedByViewport ? stick : true
  if (prevScrollTop < 0) return dist <= FOLLOW_REENGAGE_PX
  if (scrollTop < prevScrollTop - 0.5) return false
  // Re-engagement requires a genuine DOWNWARD move, not merely a non-upward
  // event that finds the reader inside the band. A neutral event (identical
  // scrollTop -- the tail of an iOS momentum run, or any scroll fired while the
  // reader is at rest) used to satisfy this, so a reader sitting mid-transcript
  // could be re-armed by CONTENT rather than by their own hand: when rows
  // outside the window reprice smaller than their estimates, the remaining
  // content collapses under them and the bottom band arrives at the reader
  // instead of the reader arriving at it. Follow re-engaged, and the next pin
  // took them to the end -- reported as scrolling along and suddenly landing at
  // the bottom. Distance alone cannot tell those apart; the direction of the
  // reader's own move can.
  if (scrollTop > prevScrollTop + 0.5 && dist <= FOLLOW_REENGAGE_PX) return true
  return stick
}

/** Result of an automatic (RO / append) pin evaluation. */
export interface AutoPinResult {
  /** Whether to write `el.scrollTop = target` now. */
  pin: boolean
  /** Next value for `stick` (released to false if the user scrolled up). */
  stick: boolean
  /** The bottom scrollTop the caller should write when `pin` is true. */
  target: number
}

/**
 * Decide an automatic pin at the moment content changed (RO callback / append
 * layout effect / its follow-up rAF), reading LIVE geometry.
 *
 *   - Not sticking → never pin.
 *   - Sticking but the user has scrolled up since our last write
 *     (`scrollTop < lastWriteTop - epsilon`) → release stick, don't pin.
 *     This is the synchronous, race-proof guard.
 *   - Otherwise → pin to the bottom (only actually move if not already there).
 *
 * `lastWriteTop < 0` disables the scroll-up guard (used right after a slot
 * switch, before we have written anything this session).
 *
 * `viewportShrink` (px, default 0) is how much the SCROLLER'S OWN BOX has
 * shrunk since that reference was recorded — chrome mounting below the
 * transcript (a queue band, an attachment strip, a tip card), often
 * spring-animated over several frames. Our own shrink inflates
 * `distanceFromBottom` with no user input, so without this allowance the
 * distance guard reads it as "meaningfully away from the bottom". Paired with
 * a content SHRINK in the same commit window — a tail-row remount clamping
 * scrollTop below `lastWriteTop` — that produced a full user-scroll-up
 * signature out of two of our own layout changes: follow released mid
 * animation and the content settled a card-height low. Judging the distance
 * against the box we were last a bottom FOR keeps the guard measuring the
 * user's move rather than our own. Only the shrink's own pixels are forgiven,
 * so a genuine drag inside the same tick still releases.
 */
export function evaluateAutoPin(args: {
  stick: boolean
  geom: ScrollGeom
  lastWriteTop: number
  epsilon?: number
  viewportShrink?: number
  /** Is a turn actually producing output right now?
   *
   *  Follow means "keep me at the end of a LIVE turn". With nothing running there
   *  is no output to follow, so a reader sitting above the bottom is not
   *  following — and an automatic pin there is a yank with no cause, reported
   *  from a phone as the transcript springing back after scrolling up about a
   *  hundred pixels with nothing streaming.
   *
   *  Defaults to `true` = assume a run is live, which keeps the behaviour of a
   *  caller that has no run signal to give (the app-SDK chat surface). The chat
   *  transcript passes the real thing. */
  runActive?: boolean
  /** Is an anchor restore currently OWNING the scroll position?
   *
   *  A restore places the reader at an absolute offset and then re-lands it as
   *  measurements arrive. An automatic pin during that window is a second owner
   *  writing the same scroller, and the two fight: captured on a phone as
   *  `WRITE autopin 3091->4245` answered by `WRITE settle 4245->3091`, twice in
   *  120ms, 1,154px each way. The settle won those rounds, but only because its
   *  budget had not expired yet -- which is why the same switch sometimes landed
   *  at the bottom and sometimes did not.
   *
   *  Released rather than merely skipped, for the reason the idle branch below
   *  gives: skipping leaves follow armed, so the next growth yanks the reader
   *  from wherever the restore just put them. */
  restoreGate?: boolean
  /** Has hardware input -- wheel / touch / pointer / a scrolling key -- reached
   *  the scroller since we last placed the reader at the bottom?
   *
   *  False means the reader has done nothing, so a gap that opened while they
   *  rest on our last write was opened by content -- a row settling from its
   *  estimate, a code-block stand-in swapping for the highlighted block, the
   *  top spacer repricing -- and is a gap WE owe them, not one they chose.
   *
   *  The idle rule below cannot tell those apart from distance alone, and it
   *  errs toward release, which was invisible wherever the browser's native
   *  scroll anchoring quietly carried the reader through the growth. WebKit has
   *  no scroll anchoring at all, so on an iPhone every entry into an idle
   *  session paid the whole post-pin reprice as a displacement and then had
   *  follow released on top of it: the transcript opened a viewport or more
   *  above the end with nothing streaming to bring it back.
   *
   *  Defaults to `true` = assume the reader may have moved, which is the
   *  release-leaning legacy behaviour for a caller that has no input signal. */
  readerMovedSinceWrite?: boolean
}): AutoPinResult {
  const { stick, geom, lastWriteTop } = args
  const epsilon = args.epsilon ?? SELF_SCROLL_EPSILON
  const viewportShrink = Math.max(0, args.viewportShrink ?? 0)
  const runActive = args.runActive ?? true
  const readerMovedSinceWrite = args.readerMovedSinceWrite ?? true
  const target = bottomTarget(geom)
  if (args.restoreGate) return { pin: false, stick: false, target }
  if (!stick) return { pin: false, stick: false, target }
  // The reader is resting exactly where we last put them and has given no input
  // since, so any gap is content settling under them -- carry them back, live
  // turn or not. Both conditions are load-bearing. Position alone would read our
  // own write as consent for a reader who wheeled up and happened to stop on it;
  // input alone would drag back a programmatic reveal -- a search hit, a pinned
  // prompt, find-in-page -- whose scroll event has not dispatched yet when a
  // height commit lands, since none of those touch the scroller's input
  // listeners. A reveal moves scrollTop off our write; a reprice does not.
  const restingOnOurWrite = lastWriteTop >= 0 && Math.abs(geom.scrollTop - lastWriteTop) <= epsilon
  if (!readerMovedSinceWrite && restingOnOurWrite) {
    return { pin: distanceFromBottom(geom) > atBottomEpsilon(), stick: true, target }
  }
  // Idle: release rather than merely skip the pin. Skipping would leave follow
  // armed, so the next turn to start would yank this reader to the bottom from
  // wherever they had settled — the same defect one event later.
  //
  // But distance alone cannot say WHO opened that gap, and the two causes want
  // opposite answers: a reader who scrolled up should be released, while a
  // reader the CONTENT moved away from should be carried back.
  if (!runActive && distanceFromBottom(geom) > atBottomEpsilon()) {
    // Released. The question this branch cannot answer from geometry -- did the
    // reader open this gap, or did the content -- is answered ABOVE by
    // `readerMovedSinceWrite`: reaching here means input or an unexplained
    // scroll has been seen since our last positioning, so a reader who is now
    // above the bottom while nothing runs is one who left it. Reading our own
    // last write as consent would be an automatic action authorizing itself;
    // the only evidence that the reader never moved is the absence of input,
    // and that is what the branch above requires.
    return { pin: false, stick: false, target }
  }
  // Release only on a genuine user scroll-UP: scrollTop dropped below our last
  // write AND we are now meaningfully away from the bottom. A pure content
  // SHRINK mid-stream (a partial markdown line re-parsing, a code fence opening
  // and reclassifying the block) clamps scrollTop below lastWriteTop too, but
  // leaves us still AT the new bottom (distance ~0). Without the distance guard
  // that shrink looked like a scroll-up and froze streaming follow — once
  // released, nothing re-armed stick for the rest of the response.
  if (
    lastWriteTop >= 0 &&
    geom.scrollTop < lastWriteTop - epsilon &&
    distanceFromBottom(geom) - viewportShrink > epsilon
  ) {
    return { pin: false, stick: false, target }
  }
  return { pin: Math.abs(geom.scrollTop - target) > atBottomEpsilon(), stick: true, target }
}
