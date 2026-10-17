import { describe, expect, test } from 'bun:test'
import {
  captureAnchor,
  restoreAnchor,
  type ScrollAnchor,
} from '../src/components/composites/message-scroller/scroll-anchor'

type FakeTurn = { id: string; top: number; height: number }

const box = (top: number, height: number) => ({
  top,
  bottom: top + height,
  height,
  left: 0,
  right: 0,
  width: 0,
  x: 0,
  y: top,
  toJSON: () => ({}),
})

/**
 * A scroller reduced to what the anchor code reads: its box, its scroll
 * geometry, and the turns that carry an anchor id, laid out from document
 * coordinates so that scrolling moves them.
 */
function fakeScroller(options: { scrollTop: number; scrollHeight: number; turns?: FakeTurn[] }) {
  const state = { ...options, turns: options.turns ?? [] }
  const elements = () =>
    state.turns.map((turn) => ({
      getAttribute: () => turn.id,
      getBoundingClientRect: () => box(turn.top - state.scrollTop, turn.height),
    }))
  const scroller = {
    get scrollTop() {
      return state.scrollTop
    },
    set scrollTop(value: number) {
      state.scrollTop = value
    },
    get scrollHeight() {
      return state.scrollHeight
    },
    getBoundingClientRect: () => box(0, 400),
    querySelectorAll: () => elements(),
  } as unknown as HTMLElement
  return { scroller, state }
}

describe('restoreAnchor without anchor ids', () => {
  test('one prepend is applied once however many times the anchor is restored', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 300, scrollHeight: 1000 })
    const anchor = captureAnchor(scroller)
    expect(anchor.id).toBeUndefined()

    state.scrollHeight = 1600 // 600px of history lands above
    expect(restoreAnchor(scroller, anchor)).toBe(600)
    expect(state.scrollTop).toBe(900)
    // The observer and the settle both restore; the second must find nothing to do.
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(state.scrollTop).toBe(900)
  })

  test('growth that lands after a restore moves the position by what is still missing', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 300, scrollHeight: 1000 })
    const anchor = captureAnchor(scroller)

    state.scrollHeight = 1400
    restoreAnchor(scroller, anchor)
    restoreAnchor(scroller, anchor)
    expect(state.scrollTop).toBe(700)

    state.scrollHeight = 1650 // an image above finishes loading
    expect(restoreAnchor(scroller, anchor)).toBe(250)
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(state.scrollTop).toBe(950)
  })

  test('nothing is added when the content did not grow, and an absent anchor does nothing', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 120, scrollHeight: 900 })
    const anchor = captureAnchor(scroller)
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(restoreAnchor(scroller, undefined)).toBe(0)
    expect(state.scrollTop).toBe(120)
  })

  test('content that shrinks moves the position back by the same amount, once', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 500, scrollHeight: 1200 })
    const anchor: ScrollAnchor = captureAnchor(scroller)
    state.scrollHeight = 1100
    expect(restoreAnchor(scroller, anchor)).toBe(-100)
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(state.scrollTop).toBe(400)
  })
})

const turns = (): FakeTurn[] => [
  { id: 'a', top: 0, height: 200 },
  { id: 'b', top: 200, height: 300 },
  { id: 'c', top: 500, height: 300 },
]

describe('restoreAnchor with anchor ids', () => {
  test('the first visible turn is put back where it was after history lands above', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 250, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(scroller)
    expect(anchor).toMatchObject({ id: 'b', offset: -50 })

    for (const turn of state.turns) turn.top += 600
    state.scrollHeight = 1400
    expect(restoreAnchor(scroller, anchor)).toBe(600)
    expect(state.scrollTop).toBe(850)
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(state.scrollTop).toBe(850)
  })

  test('late growth above the anchor is corrected again, and a missing anchor changes nothing', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 250, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(scroller)

    for (const turn of state.turns) turn.top += 80
    expect(restoreAnchor(scroller, anchor)).toBe(80)
    expect(state.scrollTop).toBe(330)

    state.turns = []
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(state.scrollTop).toBe(330)
  })
})
