/*
 * Substantially translated from KiroCrew website/src/app-sdk/useChatScrollFollow.ts,
 * pinned at 283e136c0f902e965a535a7c9548c57c7504fed0.
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * This product includes software developed at Amazon.com, Inc. (https://www.amazon.com/).
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 * Solid owner effects replace React refs/effects; native geometry and the
 * content/viewport observer contract are retained. No session store is copied.
 */
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js'
import type { ConversationReadingPosition } from './conversation-surface'
import {
  atBottomEpsilon,
  bottomTarget,
  computeAtBottom,
  distanceFromBottom,
  evaluateAutoPin,
  isScrollUpIntent,
  isSelfScroll,
  resolveUserScrollStick,
  SELF_SCROLL_EPSILON,
  type ReaderInput,
} from './scroll-follow-core'

const geometry = (element: HTMLDivElement) => ({
  scrollTop: element.scrollTop,
  scrollHeight: element.scrollHeight,
  clientHeight: element.clientHeight,
})
const noop = () => {}

/** Opens a hold on the follow position (see `createScrollFollow`); the function it returns closes it. */
export type ScrollFollowHold = () => () => void

/** Internal plain-scroller binding; host-owned restoration can disable follow. */
export function createScrollFollow(options: {
  enabled: () => boolean
  resetKey: () => string | undefined
  threshold: () => number
  initialPosition?: () => ConversationReadingPosition | undefined
  onPositionChange?: (position: ConversationReadingPosition) => void
}) {
  const [atBottom, setAtBottom] = createSignal(true)
  let scroller: HTMLDivElement | undefined
  let content: HTMLDivElement | undefined
  let stick = true
  let lastWriteTop = -1
  let lastWriteClientHeight = -1
  let previousTop = -1
  let lastScrollClientHeight = 0
  let pendingRestore: { frame: number; fromTop: number; target: number } | undefined
  let pendingRestoreUserIntent = false
  let removeRestoreIntentListeners = noop
  // A hold is the caller saying it is positioning the view (see `hold`): while one is
  // open and the reader was following, the content's moves are not read as the reader's.
  let holds = 0
  let holdFollowing = false
  let holdIntent = false
  let holdTop = -1
  // Bumped on every identity change, so a hold opened for the previous conversation can
  // neither pin the next one nor close over its state.
  let holdGeneration = 0
  const holding = () => holds > 0 && holdFollowing && !holdIntent
  // Is the view still where the hold left it? The content can move the offset only by
  // clamping it to the end it has now; anything else moved it from outside (a reveal, a
  // search jump), and that is the caller's to keep, so the hold gives way.
  const holdsPosition = (element: HTMLDivElement) => {
    if (!holding()) return false
    const maxTop = Math.max(0, element.scrollHeight - element.clientHeight)
    if (Math.abs(element.scrollTop - Math.min(holdTop, maxTop)) <= SELF_SCROLL_EPSILON) return true
    holdIntent = true
    return false
  }
  const reportPosition = () => {
    if (scroller)
      untrack(() =>
        options.onPositionChange?.({
          top: scroller!.scrollTop,
          following: options.enabled() && stick,
        })
      )
  }
  onCleanup(reportPosition)

  const writePin = (element: HTMLDivElement, target: number) => {
    // Instant writes keep the self-scroll reference synchronized. A smooth
    // animation would produce intermediate positions that resemble user input.
    element.scrollTop = target
    lastWriteTop = element.scrollTop
    lastWriteClientHeight = element.clientHeight
    previousTop = element.scrollTop
  }
  const pinHeld = (element: HTMLDivElement) => {
    const geom = geometry(element)
    stick = true
    if (distanceFromBottom(geom) > atBottomEpsilon()) writePin(element, bottomTarget(geom))
    holdTop = element.scrollTop
    setAtBottom(computeAtBottom(geometry(element), options.threshold()))
    reportPosition()
  }
  const pinAuto = () => {
    if (!scroller || !options.enabled() || pendingRestore) return
    if (holdsPosition(scroller)) return pinHeld(scroller)
    const geom = geometry(scroller)
    const result = evaluateAutoPin({
      stick,
      geom,
      lastWriteTop,
      viewportShrink: lastWriteClientHeight >= 0 ? lastWriteClientHeight - geom.clientHeight : 0,
    })
    stick = result.stick
    if (result.pin) writePin(scroller, result.target)
    else if (result.stick) {
      lastWriteTop = result.target
      lastWriteClientHeight = geom.clientHeight
    }
    setAtBottom(computeAtBottom(geometry(scroller), options.threshold()))
    reportPosition()
  }
  const onScroll = () => {
    if (!scroller) return
    if (pendingRestore) {
      // A reset can clamp the outgoing offset while the incoming rows are
      // shorter. That notification is layout, not reader intent, and must not
      // cancel the snapshot waiting for the new rows to commit.
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      const clampedFromTop = Math.min(pendingRestore.fromTop, maxTop)
      if (
        pendingRestore.fromTop - clampedFromTop > 1 &&
        Math.abs(scroller.scrollTop - clampedFromTop) <= 1
      )
        return
      // An unexplained offset change can also be a browser clamp. Only actual
      // user scroll intent followed by a non-clamp movement cancels restoration.
      if (!pendingRestoreUserIntent) return
      cancelAnimationFrame(pendingRestore.frame)
      pendingRestore = undefined
      pendingRestoreUserIntent = false
      removeRestoreIntentListeners()
      removeRestoreIntentListeners = noop
    }
    if (!options.enabled()) {
      reportPosition()
      return
    }
    if (holdsPosition(scroller)) return pinHeld(scroller)
    const geom = geometry(scroller)
    setAtBottom(computeAtBottom(geom, options.threshold()))
    if (!isSelfScroll(geom.scrollTop, lastWriteTop)) {
      stick = resolveUserScrollStick({
        stick,
        followOutput: true,
        scrollTop: geom.scrollTop,
        prevScrollTop: previousTop,
        geom,
        viewportGrowth: lastScrollClientHeight > 0 ? geom.clientHeight - lastScrollClientHeight : 0,
      })
      if (!stick) {
        lastWriteTop = -1
        lastWriteClientHeight = -1
      }
    }
    previousTop = geom.scrollTop
    // This baseline belongs only to scroll events, not observer callbacks.
    // Advancing it during resize would erase the viewport-clamp evidence.
    lastScrollClientHeight = geom.clientHeight
    reportPosition()
  }
  const jump = () => {
    if (!scroller || !options.enabled()) return
    stick = true
    writePin(scroller, bottomTarget(geometry(scroller)))
    setAtBottom(true)
    reportPosition()
    // The jump control disappears at the bottom. Return its keyboard focus to
    // the transcript instead of leaving the reader on a detached button.
    scroller.focus({ preventScroll: true })
  }

  // Open while the caller moves content under a reader who is following, so a clamp or an
  // insert it causes is not mistaken for the reader leaving the end. It gives way to the
  // reader's own scroll-up (`isScrollUpIntent`) and to anything else that moves the view
  // from outside (a reveal, a search jump); closing it puts a reader who is still following
  // back at the end. A change of conversation invalidates it, so the next conversation's
  // saved position is its own. A reveal or search jump outside a hold is never affected.
  const hold = () => {
    if (holds === 0) {
      holdFollowing = options.enabled() && stick && scroller !== undefined
      holdIntent = false
      holdTop = scroller ? scroller.scrollTop : -1
    }
    holds += 1
    const generation = holdGeneration
    let open = true
    return () => {
      if (!open || generation !== holdGeneration) return
      open = false
      holds -= 1
      if (holds > 0) return
      const resume = scroller !== undefined && holdsPosition(scroller)
      holdFollowing = false
      holdIntent = false
      if (resume && scroller && options.enabled() && !pendingRestore) pinHeld(scroller)
    }
  }
  const noteHoldInput = (event: Event) => {
    if (holds === 0 || holdIntent) return
    let input: ReaderInput | undefined
    if (event instanceof WheelEvent) input = { kind: 'wheel', deltaY: event.deltaY }
    else if (event instanceof KeyboardEvent)
      input = { kind: 'key', key: event.key, shiftKey: event.shiftKey }
    else if (event.type === 'touchmove') input = { kind: 'touchmove' }
    else if (event.type === 'pointerdown')
      input = { kind: 'pointerdown', onScroller: event.target === scroller }
    if (input && isScrollUpIntent(input)) holdIntent = true
  }

  createEffect(() => {
    options.resetKey()
    const enabled = options.enabled()
    // Capture before any reporting callback can replace the host snapshot.
    const candidate = untrack(() => options.initialPosition?.())
    const initial =
      candidate && Number.isFinite(candidate.top) && candidate.top >= 0 ? candidate : undefined
    let scheduledRestore: typeof pendingRestore
    let observer: ResizeObserver | undefined
    onCleanup(() => {
      if (scheduledRestore) {
        cancelAnimationFrame(scheduledRestore.frame)
        if (pendingRestore === scheduledRestore) pendingRestore = undefined
      }
      pendingRestoreUserIntent = false
      removeRestoreIntentListeners()
      removeRestoreIntentListeners = noop
      observer?.disconnect()
    })
    stick = true
    holdGeneration += 1
    holds = 0
    holdFollowing = false
    holdIntent = false
    lastWriteTop = -1
    lastWriteClientHeight = -1
    previousTop = -1
    lastScrollClientHeight = 0
    setAtBottom(true)
    if (!enabled || !scroller) return
    // Snapshot updates must not become another positioning owner. Consume the
    // host's snapshot only at entry/reset, then native reader intent owns follow.
    if (initial) {
      stick = enabled && initial.following
    }

    const observe = () => {
      if (!enabled || typeof ResizeObserver === 'undefined') return
      observer = new ResizeObserver(pinAuto)
      observer.observe(scroller!)
      if (content) observer.observe(content)
    }

    const watchRestoreIntent = () => {
      const element = scroller
      if (!element) return
      const markIntent = (event: Event) => {
        if (!pendingRestore) return
        if (event.type === 'pointerdown' && event.target !== element) return
        if (event.type === 'keydown') {
          if (event.target !== element) return
          const key = (event as KeyboardEvent).key
          if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(key))
            return
        }
        pendingRestoreUserIntent = true
      }
      element.addEventListener('wheel', markIntent, { passive: true })
      element.addEventListener('pointerdown', markIntent)
      element.addEventListener('keydown', markIntent)
      removeRestoreIntentListeners = () => {
        element.removeEventListener('wheel', markIntent)
        element.removeEventListener('pointerdown', markIntent)
        element.removeEventListener('keydown', markIntent)
      }
    }

    if (initial && !stick) {
      // The identity effect can run before Solid has inserted the new rows. A
      // synchronous write is clamped by the outgoing short transcript, so defer
      // restoration until the browser has committed the new content and layout.
      const restore = {
        frame: 0,
        fromTop: scroller.scrollTop,
        target: initial.top,
      }
      scheduledRestore = restore
      pendingRestore = restore
      pendingRestoreUserIntent = false
      watchRestoreIntent()
      // Keep resize observation alive during the pending frame. Its callback is
      // guarded above, and remains active if user input cancels restoration.
      observe()
      restore.frame = requestAnimationFrame(() => {
        if (pendingRestore !== restore || !scroller) return
        pendingRestore = undefined
        pendingRestoreUserIntent = false
        removeRestoreIntentListeners()
        removeRestoreIntentListeners = noop
        writePin(scroller, restore.target)
        setAtBottom(computeAtBottom(geometry(scroller), options.threshold()))
        reportPosition()
      })
      return
    }

    if (!initial && enabled) writePin(scroller, bottomTarget(geometry(scroller)))
    else if (initial && stick) writePin(scroller, bottomTarget(geometry(scroller)))
    setAtBottom(computeAtBottom(geometry(scroller), options.threshold()))
    reportPosition()
    observe()
  })

  return {
    atBottom,
    onScroll,
    jump,
    hold,
    bindScroller: (element: HTMLDivElement) => {
      scroller = element
      for (const type of ['wheel', 'touchmove', 'pointerdown', 'keydown'])
        element.addEventListener(type, noteHoldInput, { passive: true })
    },
    bindContent: (element: HTMLDivElement) => {
      content = element
    },
  }
}
