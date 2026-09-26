/*
 * Copyright (c) 2026 Michael Yong
 * Copyright (c) 2026 Muxy
 * SPDX-License-Identifier: MIT
 *
 * Portions of the binary split behavior are substantially translated from:
 * - get-bb/bb apps/app/src/lib/split-layout/ops.ts (MIT), revision
 *   52a9256373d4d36f9b60e9e2a7f333464091a2ac.
 * - muxy-app/muxy Muxy/Models/Workspace/SplitNode.swift (MIT), revision
 *   5c5be8697c57a2fe70cda97fdbaf7c912e2e31b6.
 * Adapted first in Adea packages/dev-view/src/layout/operations.ts at
 * 0322ab09ff5e9775bfddc0bf2d81e1df436dbef7. Extracted here with opaque
 * host-owned leaves and an injected final-pane placeholder; immutable strict
 * binary operations, accepted limits and undoable close are preserved.
 * See NOTICE and docs/research/dev-view-donor-audit.md.
 */

/** A visual identity only. Extend this with host-owned payload; UI never interprets it. */
export type SplitLayoutLeaf = Readonly<{ kind: 'leaf'; id: string }>
export type SplitLayoutBranch<L extends SplitLayoutLeaf = SplitLayoutLeaf> = Readonly<{
  kind: 'split'
  id: string
  direction: 'row' | 'column'
  ratio: number
  children: readonly [SplitLayoutNode<L>, SplitLayoutNode<L>]
}>
export type SplitLayoutNode<L extends SplitLayoutLeaf = SplitLayoutLeaf> = L | SplitLayoutBranch<L>

export const MAX_LAYOUT_LEAVES = 8
export const MAX_LAYOUT_DEPTH = 8
export const MIN_SPLIT_RATIO = 0.1
export const MAX_SPLIT_RATIO = 0.9

export type SplitLayoutState<L extends SplitLayoutLeaf = SplitLayoutLeaf> = Readonly<{
  center: SplitLayoutNode<L>
  focusedLeafId: string
  closed: readonly Readonly<{ center: SplitLayoutNode<L>; leafId: string }>[]
}>

export type SplitPaneInput<L extends SplitLayoutLeaf = SplitLayoutLeaf> = Readonly<{
  direction: SplitLayoutBranch<L>['direction']
  placement: 'before' | 'after'
  leaf: L
  splitId: string
}>

export function listLeaves<L extends SplitLayoutLeaf>(node: SplitLayoutNode<L>): readonly L[] {
  return node.kind === 'leaf'
    ? [node]
    : [...listLeaves(node.children[0]), ...listLeaves(node.children[1])]
}

export function countLeaves<L extends SplitLayoutLeaf>(node: SplitLayoutNode<L>): number {
  return node.kind === 'leaf' ? 1 : countLeaves(node.children[0]) + countLeaves(node.children[1])
}

export function layoutDepth<L extends SplitLayoutLeaf>(node: SplitLayoutNode<L>): number {
  return node.kind === 'leaf'
    ? 1
    : 1 + Math.max(layoutDepth(node.children[0]), layoutDepth(node.children[1]))
}

function replaceLeaf<L extends SplitLayoutLeaf>(
  node: SplitLayoutNode<L>,
  leafId: string,
  replacement: SplitLayoutNode<L>
): SplitLayoutNode<L> {
  if (node.kind === 'leaf') return node.id === leafId ? replacement : node
  const first = replaceLeaf(node.children[0], leafId, replacement)
  const second = replaceLeaf(node.children[1], leafId, replacement)
  return first === node.children[0] && second === node.children[1]
    ? node
    : { ...node, children: [first, second] }
}

function removeLeaf<L extends SplitLayoutLeaf>(
  node: SplitLayoutNode<L>,
  leafId: string
): SplitLayoutNode<L> | null {
  if (node.kind === 'leaf') return node.id === leafId ? null : node
  const first = removeLeaf(node.children[0], leafId)
  const second = removeLeaf(node.children[1], leafId)
  if (!first) return second
  if (!second) return first
  return first === node.children[0] && second === node.children[1]
    ? node
    : { ...node, children: [first, second] }
}

function containsLeaf<L extends SplitLayoutLeaf>(
  node: SplitLayoutNode<L>,
  leafId: string
): boolean {
  return node.kind === 'leaf'
    ? node.id === leafId
    : containsLeaf(node.children[0], leafId) || containsLeaf(node.children[1], leafId)
}

function assertUniqueInput<L extends SplitLayoutLeaf>(
  state: SplitLayoutState<L>,
  leaf: L,
  splitId: string
) {
  assertLayoutTree(leaf)
  if (typeof splitId !== 'string' || splitId.length === 0)
    throw new Error('invalid_state: split identity must be nonempty')
  const ids = new Set<string>()
  const visit = (node: SplitLayoutNode<L>) => {
    if (ids.has(node.id)) throw new Error('invalid_state: duplicate pane id')
    ids.add(node.id)
    if (node.kind === 'split') node.children.forEach(visit)
  }
  visit(state.center)
  if (ids.has(leaf.id) || ids.has(splitId) || leaf.id === splitId)
    throw new Error('invalid_state: duplicate pane id')
}

/** Visual-tree validation only; applications still decode and scope persisted preferences. */
function assertLayoutTree<L extends SplitLayoutLeaf>(center: SplitLayoutNode<L>): void {
  const ids = new Set<string>()
  const seen = new WeakSet<object>()
  let leaves = 0
  const visit = (node: SplitLayoutNode<L>, depth: number) => {
    if (depth > MAX_LAYOUT_DEPTH) throw new Error('limit_exceeded: layout depth exceeds eight')
    if (!node || typeof node !== 'object') throw new Error('invalid_state: missing layout node')
    if (seen.has(node)) throw new Error('invalid_state: cyclic or reused layout node')
    seen.add(node)
    if (typeof node.id !== 'string' || node.id.length === 0)
      throw new Error('invalid_state: layout identity must be nonempty')
    if (ids.has(node.id)) throw new Error('invalid_state: duplicate pane id')
    ids.add(node.id)
    if (node.kind === 'leaf') {
      leaves += 1
      if (leaves > MAX_LAYOUT_LEAVES)
        throw new Error('limit_exceeded: layout has more than eight leaves')
      return
    }
    if (
      node.kind !== 'split' ||
      !Array.isArray(node.children) ||
      node.children.length !== 2 ||
      (node.direction !== 'row' && node.direction !== 'column')
    )
      throw new Error('invalid_state: layout must be a strict binary row or column tree')
    visit(node.children[0], depth + 1)
    visit(node.children[1], depth + 1)
  }
  visit(center, 1)
}

export function createLayoutState<L extends SplitLayoutLeaf>(
  center: SplitLayoutNode<L>
): SplitLayoutState<L> {
  assertLayoutTree(center)
  const first = listLeaves(center)[0]
  if (!first) throw new Error('invalid_state: layout requires a leaf')
  return { center, focusedLeafId: first.id, closed: [] }
}

export function splitPane<L extends SplitLayoutLeaf>(
  state: SplitLayoutState<L>,
  targetLeafId: string,
  input: SplitPaneInput<L>
): SplitLayoutState<L> {
  if (!containsLeaf(state.center, targetLeafId)) return state
  if (countLeaves(state.center) >= MAX_LAYOUT_LEAVES)
    throw new Error('limit_exceeded: center layout has eight leaves')
  assertUniqueInput(state, input.leaf, input.splitId)
  const target = listLeaves(state.center).find((leaf) => leaf.id === targetLeafId)
  if (!target) return state
  const children =
    input.placement === 'before' ? ([input.leaf, target] as const) : ([target, input.leaf] as const)
  const center = replaceLeaf(state.center, targetLeafId, {
    kind: 'split',
    id: input.splitId,
    direction: input.direction,
    ratio: 0.5,
    children,
  })
  if (layoutDepth(center) > MAX_LAYOUT_DEPTH)
    throw new Error('limit_exceeded: center layout depth exceeds eight')
  return { ...state, center, focusedLeafId: input.leaf.id, closed: [] }
}

export function closePane<L extends SplitLayoutLeaf>(
  state: SplitLayoutState<L>,
  leafId: string,
  createPlaceholderLeaf: () => L
): SplitLayoutState<L> {
  if (!containsLeaf(state.center, leafId)) return state
  const before = state.center
  const readingOrder = listLeaves(before)
  const closedIndex = readingOrder.findIndex((leaf) => leaf.id === leafId)
  const removed = removeLeaf(before, leafId)
  const center: SplitLayoutNode<L> = removed ?? createPlaceholderLeaf()
  if (!removed) {
    if (center.kind !== 'leaf') throw new Error('invalid_state: placeholder must be a leaf')
    assertLayoutTree(center)
  }
  const leaves = listLeaves(center)
  const fallback = leaves[Math.min(closedIndex, leaves.length - 1)] ?? leaves[0]
  if (!fallback) throw new Error('invalid_state: layout requires a leaf')
  return {
    center,
    focusedLeafId: state.focusedLeafId === leafId ? fallback.id : state.focusedLeafId,
    closed: [...state.closed, { center: before, leafId }],
  }
}

export function undoClosePane<L extends SplitLayoutLeaf>(
  state: SplitLayoutState<L>
): SplitLayoutState<L> {
  const previous = state.closed.at(-1)
  if (!previous) return state
  return {
    center: previous.center,
    focusedLeafId: previous.leafId,
    closed: state.closed.slice(0, -1),
  }
}

export function focusPane<L extends SplitLayoutLeaf>(
  state: SplitLayoutState<L>,
  leafId: string
): SplitLayoutState<L> {
  return containsLeaf(state.center, leafId) && state.focusedLeafId !== leafId
    ? { ...state, focusedLeafId: leafId }
    : state
}

export function swapPanes<L extends SplitLayoutLeaf>(
  state: SplitLayoutState<L>,
  firstLeafId: string,
  secondLeafId: string
): SplitLayoutState<L> {
  if (firstLeafId === secondLeafId) return state
  const leaves = listLeaves(state.center)
  const first = leaves.find((leaf) => leaf.id === firstLeafId)
  const second = leaves.find((leaf) => leaf.id === secondLeafId)
  if (!first || !second) return state
  const swap = (node: SplitLayoutNode<L>): SplitLayoutNode<L> => {
    if (node.kind === 'leaf') {
      if (node.id === firstLeafId) return second
      if (node.id === secondLeafId) return first
      return node
    }
    const left = swap(node.children[0])
    const right = swap(node.children[1])
    return left === node.children[0] && right === node.children[1]
      ? node
      : { ...node, children: [left, right] }
  }
  return { ...state, center: swap(state.center), closed: [] }
}

export function movePane<L extends SplitLayoutLeaf>(
  state: SplitLayoutState<L>,
  leafId: string,
  targetLeafId: string,
  placement: 'before' | 'after',
  direction: SplitLayoutBranch<L>['direction'],
  splitId: string
): SplitLayoutState<L> {
  if (leafId === targetLeafId) return state
  const moving = listLeaves(state.center).find((leaf) => leaf.id === leafId)
  if (!moving || !containsLeaf(state.center, targetLeafId)) return state
  const detached = removeLeaf(state.center, leafId)
  if (!detached) return state
  const moved = splitPane(
    { center: detached, focusedLeafId: state.focusedLeafId, closed: state.closed },
    targetLeafId,
    { direction, placement, leaf: moving, splitId }
  )
  return { ...moved, focusedLeafId: leafId }
}

export function resizeSplit<L extends SplitLayoutLeaf>(
  state: SplitLayoutState<L>,
  splitId: string,
  ratio: number
): SplitLayoutState<L> {
  if (!Number.isFinite(ratio)) return state
  const nextRatio = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio))
  let found = false
  const visit = (node: SplitLayoutNode<L>): SplitLayoutNode<L> => {
    if (node.kind === 'leaf') return node
    if (node.id === splitId) {
      found = true
      return node.ratio === nextRatio ? node : { ...node, ratio: nextRatio }
    }
    const first = visit(node.children[0])
    const second = visit(node.children[1])
    return first === node.children[0] && second === node.children[1]
      ? node
      : { ...node, children: [first, second] }
  }
  const center = visit(state.center)
  return found && center !== state.center ? { ...state, center, closed: [] } : state
}

/**
 * Pure repair walk ported from bb's size normalization: every split ratio is
 * clamped into the normative range and a non-finite ratio falls back to an
 * even split. Structure, IDs, and focus are untouched.
 */
export function normalizeLayout<L extends SplitLayoutLeaf>(
  state: SplitLayoutState<L>
): SplitLayoutState<L> {
  const visit = (node: SplitLayoutNode<L>): { node: SplitLayoutNode<L>; changed: boolean } => {
    if (node.kind === 'leaf') return { node, changed: false }
    const first = visit(node.children[0])
    const second = visit(node.children[1])
    const ratio = Number.isFinite(node.ratio)
      ? Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, node.ratio))
      : (MIN_SPLIT_RATIO + MAX_SPLIT_RATIO) / 2
    const changed = first.changed || second.changed || ratio !== node.ratio
    return {
      node: changed ? { ...node, ratio, children: [first.node, second.node] } : node,
      changed,
    }
  }
  const result = visit(state.center)
  return result.changed ? { ...state, center: result.node } : state
}

/** The leaf immediately after (`1`) or before (`-1`) the given leaf in reading order. */
export function neighborLeaf<L extends SplitLayoutLeaf>(
  state: SplitLayoutState<L>,
  leafId: string,
  step: 1 | -1
): L | undefined {
  const leaves = listLeaves(state.center)
  const index = leaves.findIndex((leaf) => leaf.id === leafId)
  if (index < 0) return undefined
  return leaves[index + step]
}
