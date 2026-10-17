import { describe, expect, test } from 'bun:test'
import {
  captureAnchor,
  followReader,
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

describe('restoreAnchor while the reader keeps scrolling', () => {
  test('a scroll that happens during the load is kept, with or without anchor ids', () => {
    const withIds = fakeScroller({ scrollTop: 250, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(withIds.scroller)
    withIds.state.scrollTop = 120 // a fling carries the reader up 130px
    expect(restoreAnchor(withIds.scroller, anchor)).toBe(0)
    expect(withIds.state.scrollTop).toBe(120)

    const plain = fakeScroller({ scrollTop: 300, scrollHeight: 1000 })
    const bare = captureAnchor(plain.scroller)
    plain.state.scrollTop = 0
    expect(restoreAnchor(plain.scroller, bare)).toBe(0)
    expect(plain.state.scrollTop).toBe(0)
  })

  test('history landing while the reader scrolls moves the view by the insert, not the scroll', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 250, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(scroller) // 'b' sits 50px above the viewport top

    state.scrollTop = 150 // the reader scrolls up 100px...
    for (const turn of state.turns) turn.top += 600 // ...and 600px of history lands above
    state.scrollHeight = 1400
    // 'b' has moved down the viewport by the insert and up by nothing: it is now 600 + 100
    // lower than the 50px above the top it was. The view follows the insert and keeps the scroll.
    expect(restoreAnchor(scroller, anchor)).toBe(600)
    expect(state.scrollTop).toBe(750)
    expect(restoreAnchor(scroller, anchor)).toBe(0)

    state.scrollTop = 700 // and the reader goes on scrolling afterwards
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(state.scrollTop).toBe(700)
  })

  test('without anchor ids the scroll is kept and only the growth is added', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 300, scrollHeight: 1000 })
    const anchor = captureAnchor(scroller)
    state.scrollTop = 180
    state.scrollHeight = 1600
    expect(restoreAnchor(scroller, anchor)).toBe(600)
    expect(state.scrollTop).toBe(780)
    expect(restoreAnchor(scroller, anchor)).toBe(0)
  })
})

describe('followReader', () => {
  test('a reader who scrolled on takes the turn now in view as the anchor', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 520, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(scroller)
    expect(anchor.id).toBe('c') // 'c' is the first turn with its bottom in view, 20px above the top

    state.scrollTop = 0 // the reader came to rest at the top
    followReader(scroller, anchor)
    expect(anchor).toMatchObject({ id: 'a', offset: 0, scrollTop: 0 })

    // A row between the reader's turn and where the load began now changes size.
    state.turns[1]!.height += 30
    state.turns[2]!.top += 30
    state.scrollHeight = 830
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(state.scrollTop).toBe(0)
  })

  test('without the reader moving, the anchor is kept and only content movement is applied', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 250, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(scroller)
    expect(anchor).toMatchObject({ id: 'b', offset: -50 })

    // History lands above and a restore moves the view; the scroll event it causes
    // arrives with the offset where the restore left it.
    for (const turn of state.turns) turn.top += 600
    state.scrollHeight = 1400
    restoreAnchor(scroller, anchor)
    followReader(scroller, anchor)
    expect(anchor).toMatchObject({ id: 'b', offset: -50, scrollTop: 850 })
    expect(state.scrollTop).toBe(850)
  })
})
