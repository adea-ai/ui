/*
 * Translated from Muxy/Models/Workspace/SplitNode.swift areaFrames at
 * 5c5be8697c57a2fe70cda97fdbaf7c912e2e31b6.
 * Copyright (c) 2026 Muxy. SPDX-License-Identifier: MIT. See NOTICE.
 */
import {
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  type SplitLayoutLeaf,
  type SplitLayoutNode,
} from './model'
export type LayoutRect = Readonly<{ x: number; y: number; width: number; height: number }>
export type LayoutFrame<L extends SplitLayoutLeaf = SplitLayoutLeaf> = Readonly<{
  node: SplitLayoutNode<L>
  rect: LayoutRect
}>
/** Stable leaf DOM can use these fractions without being reparented into a changing nested tree. */
export function computeLayoutFrames<L extends SplitLayoutLeaf>(
  node: SplitLayoutNode<L>
): ReadonlyMap<string, LayoutFrame<L>> {
  const frames = new Map<string, LayoutFrame<L>>()
  const visit = (current: SplitLayoutNode<L>, rect: LayoutRect) => {
    frames.set(current.id, { node: current, rect })
    if (current.kind === 'leaf') return
    const ratio = Number.isFinite(current.ratio)
      ? Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, current.ratio))
      : 0.5
    const row = current.direction === 'row'
    const first = row
      ? { ...rect, width: rect.width * ratio }
      : { ...rect, height: rect.height * ratio }
    const second = row
      ? { ...rect, x: rect.x + first.width, width: rect.width - first.width }
      : { ...rect, y: rect.y + first.height, height: rect.height - first.height }
    visit(current.children[0], first)
    visit(current.children[1], second)
  }
  visit(node, { x: 0, y: 0, width: 1, height: 1 })
  return frames
}
