import { createMemo, createSignal, Index, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { FileText, Folder } from 'lucide-solid'
import { Button } from '../../src/components/ui/button/button'
import { Tree, TreeRow } from '../../src/components/composites/tree'
import type { TreeItemDescriptor } from '../../src/components/composites/tree'
import '../../src/styles/globals.css'

const fileCount = 60

function WindowedTreeFixture() {
  const initialActiveId = document.documentElement.dataset.treeFixtureActive
  const [activeId, setActiveId] = createSignal<string | null>(
    initialActiveId === 'null' ? null : initialActiveId === 'stale' ? 'filtered-item' : 'root'
  )
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [expanded, setExpanded] = createSignal(true)
  const [hideLast, setHideLast] = createSignal(false)
  const [windowStart, setWindowStart] = createSignal(
    Number(document.documentElement.dataset.treeFixtureWindow ?? 0)
  )
  const [activations, setActivations] = createSignal(0)
  const [actions, setActions] = createSignal(0)

  const allItems = createMemo<TreeItemDescriptor[]>(() => [
    {
      id: 'root',
      parentId: null,
      level: 1,
      expandable: true,
      expanded: expanded(),
    },
    ...(expanded()
      ? Array.from({ length: fileCount - Number(hideLast()) }, (_, index) => ({
          id: `file-${index}`,
          parentId: 'root',
          level: 2,
          expandable: false,
          expanded: false,
        }))
      : []),
  ])
  const mountedItems = createMemo(() => allItems().slice(windowStart(), windowStart() + 6))

  const requestReveal = (id: string) => {
    const index = allItems().findIndex((item) => item.id === id)
    if (index >= 0) setWindowStart(Math.max(0, Math.min(index - 2, allItems().length - 6)))
  }

  const setExpandedState = (id: string, nextExpanded: boolean) => {
    if (id !== 'root') return
    setExpanded(nextExpanded)
    if (!nextExpanded) setWindowStart(0)
  }

  window.addEventListener('tree-fixture:hide-last', () => setHideLast(true))

  return (
    <main class="mx-auto w-full max-w-96 p-2">
      <Button aria-label="Before tree" variant="outline">
        Before tree
      </Button>
      <Tree
        aria-label="Workspace files"
        data-testid="file-tree"
        visibleItems={allItems()}
        activeId={activeId()}
        selectionMode="single"
        onActiveIdChange={setActiveId}
        onExpand={setExpandedState}
        onRequestReveal={requestReveal}
        onActivate={(id) => {
          setActivations((count) => count + 1)
          if (id === 'root') setExpanded((value) => !value)
        }}
        onSelectItem={setSelectedId}
      >
        <Index each={mountedItems()}>
          {(item) => (
            <TreeRow
              item={item()}
              selected={selectedId() === item().id}
              data-testid={`tree-row-${item().id}`}
              ref={(element) => {
                if (item().id === 'root') element.dataset.consumerRef = 'attached'
              }}
              leading={
                item().expandable ? (
                  <Folder aria-hidden="true" class="text-muted-foreground" />
                ) : (
                  <FileText aria-hidden="true" class="text-muted-foreground" />
                )
              }
              trailing={
                <Show when={item().id === 'file-0'}>
                  <>
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label={`Rename ${item().id}`}
                      onClick={() => setActions((count) => count + 1)}
                    >
                      Rename
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label={`Copy ${item().id}`}
                      onClick={() => setActions((count) => count + 1)}
                    >
                      Copy
                    </Button>
                  </>
                </Show>
              }
            >
              {item().id === 'root' ? 'workspace' : item().id.replace('-', ' ')}
            </TreeRow>
          )}
        </Index>
      </Tree>
      <Button aria-label="Clear active id" variant="outline" onClick={() => setActiveId(null)}>
        Clear active id
      </Button>
      <Button
        aria-label="Set stale active id"
        variant="outline"
        onClick={() => setActiveId('filtered-item')}
      >
        Set stale active id
      </Button>
      <Button
        aria-label="Set last active id"
        variant="outline"
        onClick={() => setActiveId('file-59')}
      >
        Set last active id
      </Button>
      <output aria-label="Active row">{activeId() ?? 'none'}</output>
      <output aria-label="Selected row">{selectedId() ?? 'none'}</output>
      <output aria-label="Activation count">{activations()}</output>
      <output aria-label="Action count">{actions()}</output>
    </main>
  )
}

render(() => <WindowedTreeFixture />, document.body)
