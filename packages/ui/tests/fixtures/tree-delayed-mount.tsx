import { createMemo, createSignal, For } from 'solid-js'
import { render } from 'solid-js/web'
import { Input } from '../../src/components/ui/input/input'
import { Tree, TreeRow } from '../../src/components/composites/tree'
import type { TreeItemDescriptor } from '../../src/components/composites/tree'
import '../../src/styles/globals.css'

/**
 * A virtualised tree whose host mounts rows only when a spec says so, to reproduce
 * a row that mounts some time after `Tree` asked for focus on it. `onRequestReveal`
 * is recorded and does nothing: the spec decides when the window moves.
 */
const count = 30
const windowSize = 4

declare global {
  interface Window {
    delayedTree: { mount: (start: number) => void; reveals: string[] }
  }
}

function DelayedTree() {
  const items: TreeItemDescriptor[] = Array.from({ length: count }, (_, index) => ({
    id: `file-${index}`,
    parentId: null,
    level: 1,
    expandable: false,
    expanded: false,
  }))
  const [activeId, setActiveId] = createSignal<string | null>('file-0')
  const [start, setStart] = createSignal(0)
  const mounted = createMemo(() => items.slice(start(), start() + windowSize))
  window.delayedTree = {
    mount: (next) => setStart(next),
    reveals: [],
  }

  return (
    <main class="w-96 p-2">
      <h1 class="sr-only">Delayed mount tree fixture</h1>
      {/* Somewhere for focus to be that is not a tree. */}
      <Input id="outside" aria-label="Outside field" class="mb-2 w-full" />
      <Tree
        id="delayed-tree"
        aria-label="Delayed mount tree"
        visibleItems={items}
        activeId={activeId()}
        selectionMode="single"
        onActiveIdChange={setActiveId}
        onRequestReveal={(id) => window.delayedTree.reveals.push(id)}
      >
        <For each={mounted()}>{(item) => <TreeRow item={item}>{item.id}</TreeRow>}</For>
      </Tree>
      <output aria-label="Active row">{activeId() ?? 'none'}</output>
    </main>
  )
}

render(() => <DelayedTree />, document.body)
