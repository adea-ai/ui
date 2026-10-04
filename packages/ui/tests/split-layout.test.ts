import { describe, expect, test } from 'bun:test'

import {
  closePane,
  countLeaves,
  createLayoutState,
  listLeaves,
  movePane,
  neighborLeaf,
  normalizeLayout,
  focusPane,
  layoutDepth,
  resizeSplit,
  splitPane,
  splitPaneBalanced,
  type SplitLayoutNode,
  type SplitLayoutLeaf,
  swapPanes,
  undoClosePane,
} from '../src/components/layout/split-layout/model'

const leaf = (id: string, pane: 'terminal' | 'editor' = 'terminal') => ({
  kind: 'leaf' as const,
  id,
  pane,
})

const nested = () =>
  createLayoutState({
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
        children: [leaf('b', 'editor'), leaf('c')],
      },
    ],
  })

const build = (
  count: number
): import('../src/components/layout/split-layout/model').SplitLayoutNode<
  ReturnType<typeof leaf>
> =>
  count === 1
    ? leaf('first')
    : {
        kind: 'split',
        id: `initial-${count}`,
        direction: 'row',
        ratio: 0.5,
        children: [build(count - 1), leaf(`leaf-${count}`)],
      }

const buildBalanced = (count: number) => {
  let state = createLayoutState(leaf('pane-1'))
  for (let index = 2; index <= count; index += 1)
    state = splitPaneBalanced(state, `pane-${index - 1}`, {
      placement: 'after',
      leaf: leaf(`pane-${index}`),
      splitId: `balanced-${index}`,
    })
  return state
}

type TestNode = SplitLayoutNode<SplitLayoutLeaf>

function gridRows(node: TestNode): string[][] {
  if (node.kind === 'leaf') return [[node.id]]
  const first = gridRows(node.children[0])
  const second = gridRows(node.children[1])
  return node.direction === 'row'
    ? [[...(first[0] ?? []), ...(second[0] ?? [])]]
    : [...first, ...second]
}

function splitIds(node: TestNode): string[] {
  return node.kind === 'leaf'
    ? []
    : [node.id, ...splitIds(node.children[0]), ...splitIds(node.children[1])]
}

function assertBalancedRatios(node: TestNode) {
  if (node.kind === 'leaf') return
  const firstLeaves = countLeaves(node.children[0])
  const totalLeaves = countLeaves(node)
  expect(node.ratio).toBeCloseTo(node.direction === 'row' ? firstLeaves / totalLeaves : 0.5)
  node.children.forEach(assertBalancedRatios)
}

describe('strict binary shared layout', () => {
  test('splits before or after the target in deterministic reading order', () => {
    const initial = createLayoutState(leaf('terminal-1'))
    const right = splitPane(initial, 'terminal-1', {
      direction: 'row',
      placement: 'after',
      leaf: leaf('editor-1', 'editor'),
      splitId: 'split-1',
    })
    expect(listLeaves(right.center).map((item) => item.id)).toEqual(['terminal-1', 'editor-1'])
    expect(right.focusedLeafId).toBe('editor-1')

    const top = splitPane(initial, 'terminal-1', {
      direction: 'column',
      placement: 'before',
      leaf: leaf('editor-2', 'editor'),
      splitId: 'split-2',
    })
    expect(listLeaves(top.center).map((item) => item.id)).toEqual(['editor-2', 'terminal-1'])
  })

  test('enforces eight leaves and depth eight transactionally', () => {
    let state = createLayoutState(leaf('pane-1'))
    for (let index = 2; index <= 8; index += 1) {
      state = splitPane(state, `pane-${index - 1}`, {
        direction: index % 2 ? 'row' : 'column',
        placement: 'after',
        leaf: leaf(`pane-${index}`),
        splitId: `split-${index}`,
      })
    }
    expect(countLeaves(state.center)).toBe(8)
    expect(() =>
      splitPane(state, 'pane-8', {
        direction: 'row',
        placement: 'after',
        leaf: leaf('pane-9'),
        splitId: 'split-9',
      })
    ).toThrow('limit_exceeded')
  })

  test('closing collapses its parent and final close restores a terminal placeholder', () => {
    const split = splitPane(createLayoutState(leaf('one')), 'one', {
      direction: 'row',
      placement: 'after',
      leaf: leaf('two', 'editor'),
      splitId: 'split',
    })
    const closed = closePane(split, 'one', () => leaf('placeholder'))
    expect(closed.center).toEqual(leaf('two', 'editor'))
    expect(closed.focusedLeafId).toBe('two')

    const final = closePane(createLayoutState(leaf('only', 'editor')), 'only', () =>
      leaf('placeholder')
    )
    expect(final.center).toEqual(leaf('placeholder'))
    expect(final.focusedLeafId).toBe('placeholder')
  })

  test('undo restores the closed leaf and logical focus', () => {
    const initial = splitPane(createLayoutState(leaf('one')), 'one', {
      direction: 'row',
      placement: 'after',
      leaf: leaf('two', 'editor'),
      splitId: 'split',
    })
    const closed = closePane(initial, 'two', () => leaf('placeholder'))
    const restored = undoClosePane(closed)
    expect(restored.center).toEqual(initial.center)
    expect(restored.focusedLeafId).toBe('two')
  })

  test('a later structural change invalidates close undo instead of discarding new work', () => {
    const initial = splitPane(createLayoutState(leaf('one')), 'one', {
      direction: 'row',
      placement: 'after',
      leaf: leaf('two', 'editor'),
      splitId: 'split',
    })
    const withThree = splitPane(initial, 'two', {
      direction: 'column',
      placement: 'after',
      leaf: leaf('three'),
      splitId: 'nested-split',
    })
    const closed = closePane(withThree, 'three', () => leaf('placeholder'))
    const resized = resizeSplit(closed, 'split', 0.7)
    expect(resized.closed).toHaveLength(0)
    expect(undoClosePane(resized)).toBe(resized)

    const split = splitPane(closed, 'one', {
      direction: 'row',
      placement: 'after',
      splitId: 'later-split',
      leaf: leaf('later'),
    })
    expect(split.closed).toHaveLength(0)

    const swapped = swapPanes(closed, 'one', 'two')
    expect(swapped.closed).toHaveLength(0)
    expect(undoClosePane(swapped)).toBe(swapped)
  })

  test('focuses and swaps existing leaves without changing identities', () => {
    const initial = splitPane(createLayoutState(leaf('one')), 'one', {
      direction: 'row',
      placement: 'after',
      leaf: leaf('two', 'editor'),
      splitId: 'split',
    })
    expect(focusPane(initial, 'one').focusedLeafId).toBe('one')
    expect(listLeaves(swapPanes(initial, 'one', 'two').center)).toEqual([
      leaf('two', 'editor'),
      leaf('one'),
    ])
    expect(swapPanes(initial, 'one', 'missing')).toEqual(initial)
  })

  test('moves an existing leaf without changing its identity or exceeding the cap', () => {
    let state = splitPane(createLayoutState(leaf('one')), 'one', {
      direction: 'row',
      placement: 'after',
      leaf: leaf('two', 'editor'),
      splitId: 'split-a',
    })
    state = splitPane(state, 'two', {
      direction: 'column',
      placement: 'after',
      leaf: leaf('three'),
      splitId: 'split-b',
    })
    const moved = movePane(state, 'one', 'three', 'before', 'row', 'split-c')
    expect(listLeaves(moved.center).map((item) => item.id)).toEqual(['two', 'one', 'three'])
    expect(listLeaves(moved.center).find((item) => item.id === 'one')).toEqual(leaf('one'))
  })

  test('clamps finite split ratios to the normative range and ignores an unknown split', () => {
    const initial = splitPane(createLayoutState(leaf('one')), 'one', {
      direction: 'row',
      placement: 'after',
      leaf: leaf('two'),
      splitId: 'split',
    })
    expect(resizeSplit(initial, 'split', 0).center).toMatchObject({ ratio: 0.1 })
    expect(resizeSplit(initial, 'split', 1).center).toMatchObject({ ratio: 0.9 })
    expect(resizeSplit(initial, 'missing', 0.2)).toEqual(initial)
    expect(resizeSplit(initial, 'split', Number.NaN)).toEqual(initial)
  })
})

describe('balanced row-major split', () => {
  test('reflows one through eight leaves into at most two rows and four columns', () => {
    const expectedRowSizes = [[1], [2], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4]]

    for (let count = 1; count <= 8; count += 1) {
      const state = buildBalanced(count)
      const rows = gridRows(state.center)
      expect(rows.map((items) => items.length)).toEqual(expectedRowSizes[count - 1]!)
      expect(rows.length).toBeLessThanOrEqual(2)
      expect(Math.max(...rows.map((items) => items.length))).toBeLessThanOrEqual(4)
      expect(rows.flat()).toEqual(Array.from({ length: count }, (_, index) => `pane-${index + 1}`))
      expect(countLeaves(state.center)).toBe(count)
      expect(layoutDepth(state.center)).toBeLessThanOrEqual(4)
      assertBalancedRatios(state.center)
    }
  })

  test('inserts before and after every selected leaf without changing reading order', () => {
    let sequence = 0
    for (let count = 1; count < 8; count += 1) {
      const state = buildBalanced(count)
      const previousOrder = listLeaves(state.center).map((item) => item.id)
      for (let targetIndex = 0; targetIndex < previousOrder.length; targetIndex += 1) {
        for (const placement of ['before', 'after'] as const) {
          const leafId = `inserted-${++sequence}`
          const split = splitPaneBalanced(state, previousOrder[targetIndex]!, {
            placement,
            leaf: leaf(leafId, 'editor'),
            splitId: `balanced-insert-${sequence}`,
          })
          const expected = [...previousOrder]
          expected.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, leafId)
          const rows = gridRows(split.center)
          expect(rows.flat()).toEqual(expected)
          expect(rows.length).toBeLessThanOrEqual(2)
          expect(rows.every((items) => items.length <= 4)).toBe(true)
          expect(split.focusedLeafId).toBe(leafId)
          const findBranch = (node: TestNode): TestNode | undefined =>
            node.kind === 'leaf'
              ? undefined
              : node.id === `balanced-insert-${sequence}`
                ? node
                : (findBranch(node.children[0]) ?? findBranch(node.children[1]))
          const attachment = findBranch(split.center)
          expect(attachment?.kind).toBe('split')
          if (attachment?.kind === 'split') {
            const left = listLeaves(attachment.children[0]).map((item) => item.id)
            const right = listLeaves(attachment.children[1]).map((item) => item.id)
            expect(left.includes(leafId) !== left.includes(previousOrder[targetIndex]!)).toBe(true)
            expect(right.includes(leafId) !== right.includes(previousOrder[targetIndex]!)).toBe(
              true
            )
          }
        }
      }
    }
  })

  test('retains opaque leaf instances and all prior split IDs plus the new split ID', () => {
    const originalLeaves = Array.from({ length: 5 }, (_, index) => ({
      kind: 'leaf' as const,
      id: `payload-pane-${index + 1}`,
      payload: { owner: `owner-${index + 1}` },
    }))
    let state = createLayoutState(originalLeaves[0]!)
    for (let index = 1; index < originalLeaves.length; index += 1)
      state = splitPaneBalanced(state, originalLeaves[index - 1]!.id, {
        placement: 'after',
        leaf: originalLeaves[index]!,
        splitId: `payload-split-${index}`,
      })

    const oldSplitIds = splitIds(state.center)
    const newLeaf = { kind: 'leaf' as const, id: 'payload-pane-new', payload: { owner: 'new' } }
    const next = splitPaneBalanced(
      { ...state, closed: [{ center: state.center, leafId: 'closed-before-split' }] },
      originalLeaves[2]!.id,
      { placement: 'after', leaf: newLeaf, splitId: 'payload-split-new' }
    )
    const nextLeaves = listLeaves(next.center)
    for (const original of originalLeaves)
      expect(nextLeaves.find((item) => item.id === original.id)).toBe(original)
    expect(nextLeaves.map((item) => item.id)).toEqual([
      'payload-pane-1',
      'payload-pane-2',
      'payload-pane-3',
      'payload-pane-new',
      'payload-pane-4',
      'payload-pane-5',
    ])
    expect(nextLeaves[3]).toBe(newLeaf)
    expect(new Set(splitIds(next.center))).toEqual(new Set([...oldSplitIds, 'payload-split-new']))
    expect(new Set([...nextLeaves.map((item) => item.id), ...splitIds(next.center)]).size).toBe(
      nextLeaves.length + splitIds(next.center).length
    )
    expect(next.focusedLeafId).toBe(newLeaf.id)
    expect(next.closed).toEqual([])
  })

  test('preserves missing targets, validates identities, and enforces the eight-leaf cap', () => {
    const state = buildBalanced(3)
    expect(
      splitPaneBalanced(state, 'missing', {
        placement: 'after',
        leaf: leaf('next'),
        splitId: 'next-split',
      })
    ).toBe(state)
    expect(() =>
      splitPaneBalanced(state, 'pane-1', {
        placement: 'after',
        leaf: leaf('pane-2'),
        splitId: 'fresh-split',
      })
    ).toThrow('duplicate')
    expect(() =>
      splitPaneBalanced(state, 'pane-1', {
        placement: 'after',
        leaf: leaf('next'),
        splitId: splitIds(state.center)[0]!,
      })
    ).toThrow('duplicate')
    expect(() =>
      splitPaneBalanced(state, 'pane-1', {
        placement: 'after',
        leaf: leaf('next'),
        splitId: '',
      })
    ).toThrow('identity')
    expect(() =>
      splitPaneBalanced(state, 'pane-1', {
        placement: 'after',
        leaf: leaf('shared-identity'),
        splitId: 'shared-identity',
      })
    ).toThrow('duplicate')
    const full = buildBalanced(8)
    expect(() =>
      splitPaneBalanced(full, 'pane-8', {
        placement: 'after',
        leaf: leaf('pane-9'),
        splitId: 'balanced-9',
      })
    ).toThrow('limit_exceeded')
    expect(countLeaves(full.center)).toBe(8)
    expect(countLeaves(state.center)).toBe(3)
  })

  test('recycles split labels across rebuilt axes rather than preserving branch owners', () => {
    const previous = buildBalanced(5)
    const next = splitPaneBalanced(previous, 'pane-3', {
      placement: 'after',
      leaf: leaf('reflowed'),
      splitId: 'new-root',
    })
    expect(next.center.kind).toBe('split')
    if (next.center.kind === 'split' && previous.center.kind === 'split') {
      expect(next.center.id).toBe('new-root')
      expect(next.center.children[0].id).toBe(previous.center.id)
      expect(previous.center.direction).toBe('column')
      expect(next.center.children[0].kind === 'split' && next.center.children[0].direction).toBe(
        'row'
      )
    }
  })

  test('close and undo preserve the exact reflowed tree and restore the closed leaf', () => {
    const balanced = buildBalanced(6)
    const closed = closePane(balanced, 'pane-3', () => leaf('placeholder'))
    const restored = undoClosePane(closed)
    expect(restored.center).toBe(balanced.center)
    expect(restored.focusedLeafId).toBe('pane-3')
    expect(listLeaves(restored.center).map((item) => item.id)).toEqual(
      Array.from({ length: 6 }, (_, index) => `pane-${index + 1}`)
    )
  })
})

describe('layout normalization and neighbors', () => {
  test('clamps out-of-range ratios and repairs non-finite ones to an even split', () => {
    const state = nested()
    const repaired = normalizeLayout({
      ...state,
      center: {
        kind: 'split',
        id: 'root',
        direction: 'row',
        ratio: 0.97,
        children: [
          leaf('a'),
          {
            kind: 'split',
            id: 'inner',
            direction: 'column',
            ratio: Number.NaN,
            children: [leaf('b', 'editor'), leaf('c')],
          },
        ],
      },
    })
    const root = repaired.center
    if (root.kind !== 'split') throw new Error('expected split root')
    expect(root.ratio).toBe(0.9)
    const inner = root.children[1]
    if (inner.kind !== 'split') throw new Error('expected split inner')
    expect(inner.ratio).toBeCloseTo(0.5)
    expect(listLeaves(repaired.center).map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  test('returns the same state when every ratio is already inside the range', () => {
    const state = nested()
    expect(normalizeLayout(state)).toBe(state)
  })

  test('finds reading-order neighbors for pane moves', () => {
    const state = nested()
    expect(neighborLeaf(state, 'a', 1)?.id).toBe('b')
    expect(neighborLeaf(state, 'b', -1)?.id).toBe('a')
    expect(neighborLeaf(state, 'b', 1)?.id).toBe('c')
    expect(neighborLeaf(state, 'c', 1)).toBeUndefined()
    expect(neighborLeaf(state, 'ghost', 1)).toBeUndefined()
  })

  test('move preserves identities and the leaf cap across the cap boundary', () => {
    const state = nested()
    const moved = movePane(state, 'c', 'a', 'before', 'row', 'moved-split')
    expect(listLeaves(moved.center).map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(moved.focusedLeafId).toBe('c')
    expect(countLeaves(moved.center)).toBe(3)
  })
})

describe('public layout construction', () => {
  test('rejects duplicate split/leaf identities before any operation', () => {
    expect(() =>
      createLayoutState({
        kind: 'split',
        id: 'duplicate',
        direction: 'row',
        ratio: 0.5,
        children: [leaf('duplicate'), leaf('other')],
      })
    ).toThrow('duplicate')
  })
  test('rejects an empty visual identity', () => {
    expect(() => createLayoutState(leaf(''))).toThrow('identity')
  })
  test('rejects an oversized initial tree rather than silently discarding leaves', () => {
    expect(() => createLayoutState(build(9))).toThrow('limit_exceeded')
  })
  test('keeps caller-owned opaque payload and last-pane placeholder identity', () => {
    const payload = { document: 'synthetic-document' }
    const original = { kind: 'leaf' as const, id: 'document', payload }
    const placeholder = { kind: 'leaf' as const, id: 'waiting', payload }
    const state = createLayoutState(original)
    expect(state.center).toBe(original)
    const closed = closePane(state, 'document', () => placeholder)
    expect(closed.center).toBe(placeholder)
    expect(listLeaves(undoClosePane(closed).center)[0]?.payload).toBe(payload)
  })
})

describe('donor edge cases and immutable payload ownership', () => {
  test('move remains available at the accepted cap and retains exact leaf objects', () => {
    let state = createLayoutState(leaf('pane-1'))
    for (let index = 2; index <= 8; index += 1)
      state = splitPane(state, `pane-${index - 1}`, {
        direction: 'row',
        placement: 'after',
        leaf: leaf(`pane-${index}`),
        splitId: `split-${index}`,
      })
    const movedLeaf = listLeaves(state.center)[7]
    const moved = movePane(state, 'pane-8', 'pane-1', 'before', 'column', 'moved')
    expect(countLeaves(moved.center)).toBe(8)
    expect(listLeaves(moved.center)[0]).toBe(movedLeaf)
    expect(moved.focusedLeafId).toBe('pane-8')
    expect(countLeaves(state.center)).toBe(8)
  })
  test('missing actions and self moves preserve the same state and undo stack', () => {
    const state = closePane(createLayoutState(leaf('one')), 'one', () => leaf('waiting'))
    expect(
      splitPane(state, 'missing', {
        direction: 'row',
        placement: 'after',
        leaf: leaf('two'),
        splitId: 'split',
      })
    ).toBe(state)
    expect(closePane(state, 'missing', () => leaf('new'))).toBe(state)
    expect(movePane(state, 'waiting', 'waiting', 'after', 'row', 'split')).toBe(state)
    expect(focusPane(state, 'missing')).toBe(state)
    expect(resizeSplit(state, 'missing', 0.5)).toBe(state)
    expect(undoClosePane(state).center).toEqual(leaf('one'))
  })
  test('new split and leaf identities cannot collide with any existing node', () => {
    const state = splitPane(createLayoutState(leaf('one')), 'one', {
      direction: 'row',
      placement: 'after',
      leaf: leaf('two'),
      splitId: 'root',
    })
    expect(() =>
      splitPane(state, 'one', {
        direction: 'row',
        placement: 'after',
        leaf: leaf('root'),
        splitId: 'fresh',
      })
    ).toThrow('duplicate')
    expect(() =>
      splitPane(state, 'one', {
        direction: 'row',
        placement: 'after',
        leaf: leaf('fresh'),
        splitId: 'two',
      })
    ).toThrow('duplicate')
    expect(() =>
      splitPane(state, 'one', {
        direction: 'row',
        placement: 'after',
        leaf: leaf('fresh'),
        splitId: '',
      })
    ).toThrow('identity')
    expect(() => closePane(createLayoutState(leaf('only')), 'only', () => leaf(''))).toThrow(
      'identity'
    )
  })
})
