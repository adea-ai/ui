import { describe, expect, test } from 'bun:test'
import {
  indexTreeItems,
  treeNavigationAction,
  type TreeItemDescriptor,
} from '../src/components/composites/tree/tree-navigation'

const visibleItems: readonly TreeItemDescriptor[] = [
  { id: 'workspace', parentId: null, level: 1, expandable: true, expanded: true },
  { id: 'src', parentId: 'workspace', level: 2, expandable: true, expanded: true },
  { id: 'files', parentId: 'src', level: 3, expandable: false, expanded: false },
  { id: 'tests', parentId: 'src', level: 3, expandable: false, expanded: false },
  { id: 'docs', parentId: 'workspace', level: 2, expandable: false, expanded: false },
]

describe('shared tree keyboard projection', () => {
  const index = indexTreeItems(visibleItems)

  test('wraps vertical movement and resolves an unset active item', () => {
    expect(treeNavigationAction(index, 'docs', 'ArrowDown')).toEqual({
      type: 'focus',
      id: 'workspace',
    })
    expect(treeNavigationAction(index, 'workspace', 'ArrowUp')).toEqual({
      type: 'focus',
      id: 'docs',
    })
    expect(treeNavigationAction(index, null, 'ArrowDown')).toEqual({
      type: 'focus',
      id: 'workspace',
    })
    expect(treeNavigationAction(index, null, 'ArrowUp')).toEqual({
      type: 'focus',
      id: 'docs',
    })
  })

  test('expands a collapsed parent, then enters its first child', () => {
    const collapsed = indexTreeItems([
      visibleItems[0]!,
      { id: 'src', parentId: 'workspace', level: 2, expandable: true, expanded: false },
      visibleItems[4]!,
    ])
    expect(treeNavigationAction(collapsed, 'src', 'ArrowRight')).toEqual({
      type: 'expand',
      id: 'src',
      expanded: true,
    })
    expect(treeNavigationAction(index, 'src', 'ArrowRight')).toEqual({
      type: 'focus',
      id: 'files',
    })
  })

  test('collapses an expanded parent or returns to its parent', () => {
    expect(treeNavigationAction(index, 'src', 'ArrowLeft')).toEqual({
      type: 'expand',
      id: 'src',
      expanded: false,
    })
    expect(treeNavigationAction(index, 'files', 'ArrowLeft')).toEqual({
      type: 'focus',
      id: 'src',
    })
  })

  test('reports sibling position from the full projection, not the mounted window', () => {
    expect(index.positionById.get('src')).toEqual({ position: 1, setSize: 2 })
    expect(index.positionById.get('docs')).toEqual({ position: 2, setSize: 2 })
  })

  test('maps activation and selection to host callbacks', () => {
    expect(treeNavigationAction(index, 'files', 'Enter')).toEqual({
      type: 'activate',
      id: 'files',
    })
    expect(treeNavigationAction(index, 'files', ' ')).toEqual({
      type: 'select',
      id: 'files',
    })
  })

  test('rejects duplicate identities before they create ambiguous focus', () => {
    expect(() => indexTreeItems([visibleItems[0]!, visibleItems[0]!])).toThrow(
      'duplicate id "workspace"'
    )
  })
})
