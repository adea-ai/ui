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
import { createEffect, createSignal, onCleanup } from 'solid-js'
import {
  bottomTarget,
  computeAtBottom,
  evaluateAutoPin,
  isSelfScroll,
  resolveUserScrollStick,
} from './scroll-follow-core'

const geometry = (element: HTMLDivElement) => ({
  scrollTop: element.scrollTop,
  scrollHeight: element.scrollHeight,
  clientHeight: element.clientHeight,
})

/** Internal plain-scroller binding; host-owned restoration can disable follow. */
export function createScrollFollow(options: {
  enabled: () => boolean
  resetKey: () => string | undefined
  threshold: () => number
}) {
  const [atBottom, setAtBottom] = createSignal(true)
  let scroller: HTMLDivElement | undefined
  let content: HTMLDivElement | undefined
  let stick = true
  let lastWriteTop = -1
  let lastWriteClientHeight = -1
  let previousTop = -1
  let lastScrollClientHeight = 0

  const writePin = (element: HTMLDivElement, target: number) => {
    // Instant writes keep the self-scroll reference synchronized. A smooth
    // animation would produce intermediate positions that resemble user input.
    element.scrollTop = target
    lastWriteTop = target
    lastWriteClientHeight = element.clientHeight
    previousTop = target
  }
  const pinAuto = () => {
    if (!scroller || !options.enabled()) return
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
  }
  const onScroll = () => {
    if (!scroller || !options.enabled()) return
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
  }
  const jump = () => {
    if (!scroller || !options.enabled()) return
    stick = true
    writePin(scroller, bottomTarget(geometry(scroller)))
    setAtBottom(true)
    // The jump control disappears at the bottom. Return its keyboard focus to
    // the transcript instead of leaving the reader on a detached button.
    scroller.focus({ preventScroll: true })
  }

  createEffect(() => {
    options.resetKey()
    const enabled = options.enabled()
    stick = true
    lastWriteTop = -1
    lastWriteClientHeight = -1
    previousTop = -1
    lastScrollClientHeight = 0
    setAtBottom(true)
    if (!enabled || !scroller) return
    writePin(scroller, bottomTarget(geometry(scroller)))
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(pinAuto)
    observer.observe(scroller)
    if (content) observer.observe(content)
    onCleanup(() => observer.disconnect())
  })

  return {
    atBottom,
    onScroll,
    jump,
    bindScroller: (element: HTMLDivElement) => {
      scroller = element
    },
    bindContent: (element: HTMLDivElement) => {
      content = element
    },
  }
}
