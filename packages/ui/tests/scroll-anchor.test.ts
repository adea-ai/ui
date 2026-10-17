import { describe, expect, test } from 'bun:test'
import {
  anchorIds,
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
    expect(anchor.id).toBe('b')
    expect(anchor.marks.get('b')).toBe(200) // where 'b' sits in the document

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

describe('restoreAnchor follows the reader', () => {
  test('a reader who moved takes the turn now in view as the anchor, so rows between do not move the view', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 520, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(scroller)
    expect(anchor.id).toBe('c') // 'c' is the first turn whose bottom is in view
    expect([...anchor.marks.keys()]).toEqual(['a', 'b', 'c']) // with the turns above it

    state.scrollTop = 0 // the reader came to rest at the top
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(anchor).toMatchObject({ id: 'a', scrollTop: 0 })
    expect(anchor.marks.get('a')).toBe(0)

    // A row between the reader's turn and where the load began now changes size.
    state.turns[1]!.height += 30
    state.turns[2]!.top += 30
    state.scrollHeight = 830
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(state.scrollTop).toBe(0)
  })

  test("a restore that runs before the scroll event cannot erase the reader's move", () => {
    // A scroll and a change to the content in one task: the content observers run first
    // and restore, and the scroll event follows. Whatever calls restore first, the next
    // call must find the anchor on the turn the reader came to.
    const { scroller, state } = fakeScroller({ scrollTop: 520, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(scroller)

    state.scrollTop = 0
    restoreAnchor(scroller, anchor) // the observer
    restoreAnchor(scroller, anchor) // the scroll event
    expect(anchor.id).toBe('a')

    state.turns[1]!.height += 30
    state.turns[2]!.top += 30
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(state.scrollTop).toBe(0)
  })

  test("a row that grows in the same task as the reader's move is not part of the correction", () => {
    // Captured on 'c', the reader moves up to 'a', and the row between them grows before
    // the first restore runs: 'c' has moved down in the document, 'a' has not moved.
    const { scroller, state } = fakeScroller({ scrollTop: 520, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(scroller)
    expect(anchor.id).toBe('c')

    state.scrollTop = 0
    state.turns[1]!.height += 30
    state.turns[2]!.top += 30
    state.scrollHeight = 830
    expect(restoreAnchor(scroller, anchor)).toBe(0)
    expect(state.scrollTop).toBe(0)
    expect(anchor.id).toBe('a')

    // Growth above the turn the reader is on is still carried.
    state.turns[0]!.height += 20
    state.turns[1]!.top += 20
    state.turns[2]!.top += 20
    state.scrollTop = 10 // 'a' is still the turn in view
    expect(restoreAnchor(scroller, anchor)).toBe(0) // 'a' itself did not move
    for (const turn of state.turns) turn.top += 50 // history lands above everything
    expect(restoreAnchor(scroller, anchor)).toBe(50)
    expect(state.scrollTop).toBe(60)
  })

  test('the scroll event a restore causes keeps the anchor', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 250, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(scroller)
    expect(anchor.id).toBe('b')

    // History lands above and a restore moves the view; the scroll event it causes
    // arrives with the offset where the restore left it.
    for (const turn of state.turns) turn.top += 600
    state.scrollHeight = 1400
    restoreAnchor(scroller, anchor)
    restoreAnchor(scroller, anchor)
    expect(anchor).toMatchObject({ id: 'b', scrollTop: 850 })
    expect(anchor.marks.get('b')).toBe(800)
    expect(state.scrollTop).toBe(850)
  })

  test('only a turn that was there before the load can become the anchor', () => {
    const { scroller, state } = fakeScroller({ scrollTop: 250, scrollHeight: 800, turns: turns() })
    const anchor = captureAnchor(scroller)
    anchor.known = anchorIds(scroller)

    // 120px of history lands, the view is carried to it, and the reader moves on up. The
    // new turn is partly in view at its estimated height; 'a' is the turn to hold.
    state.turns = [
      { id: 'n', top: 0, height: 120 },
      ...state.turns.map((t) => ({ ...t, top: t.top + 120 })),
    ]
    state.scrollHeight = 920
    state.scrollTop = 80
    restoreAnchor(scroller, anchor)
    expect(anchor.id).toBe('a')

    // Nothing known in view: the anchor stays where it was.
    state.scrollTop = 0
    const before = { ...anchor }
    state.turns = [{ id: 'n', top: 0, height: 120 }]
    restoreAnchor(scroller, anchor)
    expect(anchor.id).toBe(before.id)
  })
})
