import { describe, expect, test } from 'bun:test'
import { computeLayoutFrames } from '../src/components/layout/split-layout/geometry'
import type { SplitLayoutNode } from '../src/components/layout/split-layout/model'
const leaf = (id: string) => ({ kind: 'leaf' as const, id })
const tree = (direction: 'row' | 'column', ratio = 0.5): SplitLayoutNode => ({
  kind: 'split',
  id: 'root',
  direction,
  ratio,
  children: [leaf('a'), leaf('b')],
})
describe('Muxy frame geometry translated to accepted binary ratios', () => {
  test('single leaf occupies the entire surface', () => {
    expect(computeLayoutFrames(leaf('a')).get('a')?.rect).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    })
  })
  test('row splits divide width and retain the root rectangle', () => {
    const frames = computeLayoutFrames(tree('row', 0.3))
    expect(frames.get('root')?.rect).toEqual({ x: 0, y: 0, width: 1, height: 1 })
    expect(frames.get('a')?.rect).toEqual({ x: 0, y: 0, width: 0.3, height: 1 })
    expect(frames.get('b')?.rect).toEqual({ x: 0.3, y: 0, width: 0.7, height: 1 })
  })
  test('column splits divide height', () => {
    const frames = computeLayoutFrames(tree('column'))
    expect(frames.get('a')?.rect).toEqual({ x: 0, y: 0, width: 1, height: 0.5 })
    expect(frames.get('b')?.rect).toEqual({ x: 0, y: 0.5, width: 1, height: 0.5 })
  })
  test('nested frames preserve offsets and both directions', () => {
    const frames = computeLayoutFrames({
      kind: 'split',
      id: 'root',
      direction: 'row',
      ratio: 0.5,
      children: [
        leaf('a'),
        {
          kind: 'split',
          id: 'inner',
          direction: 'column',
          ratio: 0.5,
          children: [leaf('b'), leaf('c')],
        },
      ],
    })
    expect(frames.get('inner')?.rect).toEqual({ x: 0.5, y: 0, width: 0.5, height: 1 })
    expect(frames.get('c')?.rect).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 })
  })
  test('repairs ratios consistently with the accepted model range', () => {
    expect(computeLayoutFrames(tree('row', Number.NaN)).get('a')?.rect.width).toBe(0.5)
    expect(computeLayoutFrames(tree('row', -1)).get('a')?.rect.width).toBe(0.1)
    expect(computeLayoutFrames(tree('row', 2)).get('a')?.rect.width).toBe(0.9)
  })
  test('opaque IDs cannot address object prototypes and payload references remain intact', () => {
    const item = leaf('__proto__')
    expect(computeLayoutFrames(item).get('__proto__')?.node).toBe(item)
  })
})
