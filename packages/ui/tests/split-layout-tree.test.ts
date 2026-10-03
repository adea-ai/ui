import { describe, expect, test } from 'bun:test'
import {
  countLeaves,
  layoutDepth,
  listLeaves,
  MAX_LAYOUT_DEPTH,
  MAX_LAYOUT_LEAVES,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  type SplitLayoutNode,
} from '../src/components/layout/split-layout/tree'
import * as model from '../src/components/layout/split-layout/model'

const first = { kind: 'leaf' as const, id: 'first', payload: { terminalId: 'terminal-a' } }
const second = { kind: 'leaf' as const, id: 'second', payload: { terminalId: 'terminal-b' } }
const third = { kind: 'leaf' as const, id: 'third', payload: { terminalId: 'terminal-c' } }
const tree: SplitLayoutNode<typeof first> = {
  kind: 'split',
  id: 'root',
  direction: 'row',
  ratio: 0.5,
  children: [
    first,
    { kind: 'split', id: 'inner', direction: 'column', ratio: 0.5, children: [second, third] },
  ],
}

describe('read-only split-layout tree boundary', () => {
  test('preserves ordered opaque leaf identities and payloads', () => {
    const leaves = listLeaves(tree)
    expect(leaves).toEqual([first, second, third])
    expect(leaves[0]).toBe(first)
    expect(leaves[2]?.payload).toBe(third.payload)
    expect(countLeaves(tree)).toBe(3)
    expect(layoutDepth(tree)).toBe(3)
    expect(listLeaves(first)).toEqual([first])
    expect(countLeaves(first)).toBe(1)
    expect(layoutDepth(first)).toBe(1)
  })
  test('keeps model compatibility and one canonical set of limits', () => {
    expect(model.listLeaves).toBe(listLeaves)
    expect(model.countLeaves).toBe(countLeaves)
    expect(model.layoutDepth).toBe(layoutDepth)
    expect([MAX_LAYOUT_LEAVES, MAX_LAYOUT_DEPTH, MIN_SPLIT_RATIO, MAX_SPLIT_RATIO]).toEqual([
      8, 8, 0.1, 0.9,
    ])
    expect(model.MAX_LAYOUT_LEAVES).toBe(MAX_LAYOUT_LEAVES)
    expect(model.MAX_LAYOUT_DEPTH).toBe(MAX_LAYOUT_DEPTH)
    expect(model.MIN_SPLIT_RATIO).toBe(MIN_SPLIT_RATIO)
    expect(model.MAX_SPLIT_RATIO).toBe(MAX_SPLIT_RATIO)
  })
})
