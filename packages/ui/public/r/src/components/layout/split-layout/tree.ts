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

// Read-only tree shape, limits, and traversal form a small import boundary.
// Persistence decoders can use these without loading pane-editing operations.

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
