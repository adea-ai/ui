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
    expect(terminalWindow(10, 0, 1000)).toEqual({ start: 0, revealable: 0, hidden: 0 })
    expect(terminalWindow(1000, 0, 1000)).toEqual({ start: 0, revealable: 0, hidden: 0 })
  })

  test('hides the head, counting what the parser discarded too', () => {
    expect(terminalWindow(1001, 0, 1000)).toEqual({ start: 1, revealable: 1, hidden: 1 })
    expect(terminalWindow(5000, 250, 1000)).toEqual({
      start: 4000,
      revealable: 4000,
      hidden: 4250,
    })
  })

  test('a limit below one still shows a line', () => {
    expect(terminalWindow(5, 0, 0).start).toBe(4)
    expect(terminalWindow(5, 0, -3).start).toBe(4)
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
