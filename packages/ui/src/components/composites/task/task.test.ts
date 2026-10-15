import { describe, expect, test } from 'bun:test'
import { taskProgress, taskProgressLabel } from './task'

describe('taskProgress', () => {
  test('makes no statement when no item carries a status', () => {
    expect(taskProgress([])).toBeUndefined()
    expect(taskProgress([{}, {}])).toBeUndefined()
  })

  test('counts complete items against every item', () => {
    expect(
      taskProgress([{ status: 'complete' }, { status: 'active' }, { status: 'pending' }, {}])
    ).toEqual({ done: 1, total: 4 })
  })

  test('does not count failed or skipped work as done', () => {
    expect(taskProgress([{ status: 'failed' }, { status: 'skipped' }])).toEqual({
      done: 0,
      total: 2,
    })
  })
})

describe('taskProgressLabel', () => {
  test('says it in words', () => {
    expect(taskProgressLabel({ done: 2, total: 5 })).toBe('2 of 5 done')
  })
})
