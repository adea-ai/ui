import { describe, expect, test } from 'bun:test'
import { moveTarget, moveWorkspace } from '../src/components/composites/workspace-switcher'

const items = [{ id: 'home', fixed: true }, { id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('workspace reorder rules', () => {
  test('moves a workspace one place and returns the whole order', () => {
    expect(moveWorkspace(items, 'b', 'up')).toEqual(['home', 'b', 'a', 'c'])
    expect(moveWorkspace(items, 'b', 'down')).toEqual(['home', 'a', 'c', 'b'])
  })

  test('a fixed workspace never moves and nothing moves above it', () => {
    expect(moveWorkspace(items, 'home', 'down')).toBeUndefined()
    expect(moveWorkspace(items, 'a', 'up')).toBeUndefined()
    expect(moveTarget(items, 'a', 'up')).toBeUndefined()
  })

  test('the ends of the list do not move further', () => {
    expect(moveWorkspace(items, 'c', 'down')).toBeUndefined()
    expect(moveWorkspace([{ id: 'a' }, { id: 'b' }], 'a', 'up')).toBeUndefined()
  })

  test('an unknown id is not a move', () => {
    expect(moveWorkspace(items, 'zzz', 'up')).toBeUndefined()
  })

  test('reports the position a move would land on', () => {
    expect(moveTarget(items, 'c', 'up')).toBe(2)
    expect(moveTarget(items, 'a', 'down')).toBe(2)
  })

  test('does not mutate the input', () => {
    const before = items.map((item) => item.id)
    moveWorkspace(items, 'b', 'up')
    expect(items.map((item) => item.id)).toEqual(before)
  })
})
