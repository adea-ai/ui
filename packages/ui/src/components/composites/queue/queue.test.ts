import { describe, expect, test } from 'bun:test'
import { partitionQueue } from './queue'

describe('partitionQueue', () => {
  test('only an item marked complete is completed', () => {
    const { pending, completed } = partitionQueue([
      { text: 'a', status: 'complete' },
      { text: 'b', status: 'active' },
      { text: 'c', status: 'pending' },
      { text: 'd' },
    ])
    expect(completed.map((item) => item.text)).toEqual(['a'])
    expect(pending.map((item) => item.text)).toEqual(['b', 'c', 'd'])
  })

  test('keeps order within each section', () => {
    const { pending, completed } = partitionQueue([
      { text: '1', status: 'complete' },
      { text: '2' },
      { text: '3', status: 'complete' },
      { text: '4' },
    ])
    expect(completed.map((item) => item.text)).toEqual(['1', '3'])
    expect(pending.map((item) => item.text)).toEqual(['2', '4'])
  })

  test('an empty list has two empty sections', () => {
    expect(partitionQueue([])).toEqual({ pending: [], completed: [] })
  })
})
