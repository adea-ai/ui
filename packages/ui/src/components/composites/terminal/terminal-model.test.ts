import { describe, expect, test } from 'bun:test'
import {
  BOTTOM_TOLERANCE_PX,
  isAtBottom,
  isFailedExit,
  revealEarlier,
  terminalStatusLabel,
  terminalWindow,
} from './terminal-model'

describe('terminalStatusLabel', () => {
  test('says each state in words', () => {
    expect(terminalStatusLabel({ state: 'running' })).toBe('Running')
    expect(terminalStatusLabel({ state: 'cancelled' })).toBe('Cancelled')
    expect(terminalStatusLabel({ state: 'exited', code: 0 })).toBe('Exited with code 0')
    expect(terminalStatusLabel({ state: 'exited', code: 137 })).toBe('Exited with code 137')
    expect(terminalStatusLabel({ state: 'exited', code: -1 })).toBe('Exited with code -1')
  })

  test('does not print a code that is not an integer', () => {
    expect(terminalStatusLabel({ state: 'exited', code: Number.NaN })).toBe('Exited')
    expect(terminalStatusLabel({ state: 'exited', code: 1.5 })).toBe('Exited')
  })
})

describe('isFailedExit', () => {
  test('only a non-zero integer exit is a failure', () => {
    expect(isFailedExit(undefined)).toBe(false)
    expect(isFailedExit({ state: 'running' })).toBe(false)
    expect(isFailedExit({ state: 'cancelled' })).toBe(false)
    expect(isFailedExit({ state: 'exited', code: 0 })).toBe(false)
    expect(isFailedExit({ state: 'exited', code: Number.NaN })).toBe(false)
    expect(isFailedExit({ state: 'exited', code: 2 })).toBe(true)
  })
})

describe('terminalWindow', () => {
  test('shows everything while it fits', () => {
    expect(terminalWindow(10, 0, 1000)).toMatchObject({
      start: 0,
      end: 10,
      revealable: 0,
      hidden: 0,
    })
    expect(terminalWindow(1000, 0, 1000)).toMatchObject({ start: 0, revealable: 0, hidden: 0 })
  })

  test('hides the head, counting what the parser discarded too', () => {
    expect(terminalWindow(1001, 0, 1000)).toMatchObject({ start: 1, revealable: 1, hidden: 1 })
    expect(terminalWindow(5000, 250, 1000)).toMatchObject({
      start: 4000,
      end: 5000,
      revealable: 4000,
      hidden: 4250,
      later: 0,
    })
  })

  test('a limit below one still shows a line', () => {
    expect(terminalWindow(5, 0, 0).start).toBe(4)
    expect(terminalWindow(5, 0, -3).start).toBe(4)
  })

  describe('parked at an anchor', () => {
    test('stays where the reader left while output arrives', () => {
      // 100 lines when they scrolled away, 5 000 now; 10 are shown.
      expect(terminalWindow(5000, 0, 10, 100)).toEqual({
        start: 90,
        end: 100,
        revealable: 90,
        hidden: 90,
        later: 4900,
        evicted: 0,
        lost: false,
      })
    })

    test('counts lines by position in the whole output, not in what is retained', () => {
      // 300 were discarded; the reader left after line 400 (index 100 retained).
      expect(terminalWindow(5000, 300, 10, 400)).toMatchObject({
        start: 90,
        end: 100,
        hidden: 390,
        later: 4900,
        evicted: 0,
      })
    })

    test('an anchor at the end is the tail', () => {
      expect(terminalWindow(50, 0, 10, 50)).toMatchObject({ start: 40, end: 50, later: 0 })
      expect(terminalWindow(50, 0, 10, 99)).toMatchObject({ start: 40, end: 50, later: 0 })
    })

    test('says how many of the lines being read retention discarded', () => {
      // Reading lines 95..105 (anchor 105, 10 shown); lines before 100 are gone.
      expect(terminalWindow(500, 100, 10, 105)).toEqual({
        start: 0,
        end: 5,
        revealable: 0,
        hidden: 100,
        later: 495,
        evicted: 5,
        lost: false,
      })
    })

    test('falls back to the oldest retained lines when all of them are gone', () => {
      expect(terminalWindow(500, 1000, 10, 600)).toEqual({
        start: 0,
        end: 10,
        revealable: 0,
        hidden: 1000,
        later: 490,
        evicted: 10,
        lost: true,
      })
    })

    test('revealing earlier lines grows the parked window upward only', () => {
      expect(terminalWindow(5000, 0, 20, 100)).toMatchObject({ start: 80, end: 100 })
    })
  })
})

describe('revealEarlier', () => {
  test('adds a page and stops at what exists', () => {
    expect(revealEarlier(1000, 1000, 5000)).toBe(2000)
    expect(revealEarlier(4500, 1000, 5000)).toBe(5000)
    expect(revealEarlier(5000, 1000, 5000)).toBe(5000)
  })
})

describe('isAtBottom', () => {
  test('is true at the end and within the tolerance', () => {
    expect(isAtBottom(1000, 600, 400)).toBe(true)
    expect(isAtBottom(1000, 600 - BOTTOM_TOLERANCE_PX, 400)).toBe(true)
  })

  test('is false once the reader has scrolled away', () => {
    expect(isAtBottom(1000, 600 - BOTTOM_TOLERANCE_PX - 1, 400)).toBe(false)
    expect(isAtBottom(1000, 0, 400)).toBe(false)
  })

  test('content shorter than the box is always at the bottom', () => {
    expect(isAtBottom(100, 0, 400)).toBe(true)
  })
})
