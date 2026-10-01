import { createMemo, createSignal, Index, Show, onCleanup } from 'solid-js'
import { render } from 'solid-js/web'
import { FileText, Folder } from 'lucide-solid'
import { Button } from '../../src/components/ui/button/button'
import { Tree, TreeRow } from '../../src/components/composites/tree'
import type { TreeItemDescriptor } from '../../src/components/composites/tree'
import { VirtualWindow } from '../../src/components/layout/virtual-window'
import '../../src/styles/globals.css'

const fileCount = 100_000
const mountedRowCount = 6
const estimatedRowHeight = 28

function indexForId(id: string): number {
  if (id === 'root') return 0
  const match = /^file-(\d+)$/.exec(id)
  return match ? Number(match[1]) + 1 : -1
}

function WindowedTreeFixture() {
  const initialActiveId = document.documentElement.dataset.treeFixtureActive
  const initialWindowStart = Number(document.documentElement.dataset.treeFixtureWindow ?? 0)
  const [activeId, setActiveId] = createSignal<string | null>(
    initialActiveId === 'null' ? null : initialActiveId === 'stale' ? 'filtered-item' : 'root'
  )
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [expanded, setExpanded] = createSignal(true)
  const [hideLast, setHideLast] = createSignal(false)
  const [windowStart, setWindowStart] = createSignal(initialWindowStart)
  const [scrollTop, setScrollTop] = createSignal(initialWindowStart * estimatedRowHeight)
  const [viewportHeight, setViewportHeight] = createSignal(128)
  const [rowHeight, setRowHeight] = createSignal(estimatedRowHeight)
  const [rowSizes, setRowSizes] = createSignal<ReadonlyMap<string, number>>(new Map())
  const [activations, setActivations] = createSignal(0)
  const [actions, setActions] = createSignal(0)
  let treeViewport: HTMLDivElement | undefined
  let viewportObserver: ResizeObserver | undefined

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
  const virtualSize = createMemo(() => allItems().length * rowHeight())
  const mountedItems = createMemo(() =>
    allItems().slice(windowStart(), windowStart() + mountedRowCount)
  )

  function setWindowForScroll(position: number): void {
    const total = allItems().length
    const first = Math.floor(position / rowHeight())
    setWindowStart(Math.max(0, Math.min(first, total - mountedRowCount)))
  }

  const requestReveal = (id: string) => {
    const index = indexForId(id)
    if (index < 0) return

    const height = rowHeight()
    const visibleHeight = Math.max(height, viewportHeight())
    const currentTop = scrollTop()
    const rowTop = index * height
    const rowBottom = rowTop + height
    const maxScrollTop = Math.max(0, virtualSize() - visibleHeight)
    const nextTop = Math.max(
      0,
      Math.min(
        maxScrollTop,
        rowTop < currentTop
          ? rowTop
          : rowBottom > currentTop + visibleHeight
            ? rowBottom - visibleHeight
            : currentTop
      )
    )

    setScrollTop(nextTop)
    if (treeViewport) treeViewport.scrollTop = nextTop
    setWindowForScroll(nextTop)
  }

  const setExpandedState = (id: string, nextExpanded: boolean) => {
    if (id !== 'root') return
    setExpanded(nextExpanded)
    if (!nextExpanded) {
      setScrollTop(0)
      if (treeViewport) treeViewport.scrollTop = 0
      setWindowStart(0)
    }
  }

  function setViewport(element: HTMLDivElement): void {
    treeViewport = element
    element.scrollTop = scrollTop()
    setViewportHeight(element.clientHeight)
    if (typeof ResizeObserver !== 'undefined') {
      viewportObserver = new ResizeObserver(() => setViewportHeight(element.clientHeight))
      viewportObserver.observe(element)
    }
  }

  onCleanup(() => viewportObserver?.disconnect())
  window.addEventListener('tree-fixture:hide-last', () => setHideLast(true))

  return (
    <main class="mx-auto w-full max-w-96 p-2">
      <h1 class="sr-only">Windowed tree fixture</h1>
      <Button aria-label="Before tree" variant="outline">
        Before tree
      </Button>
      <div
        ref={setViewport}
        data-testid="tree-test-viewport"
        role="region"
        aria-label="Workspace tree viewport"
        tabIndex={0}
        class="h-32 w-full overflow-auto"
        onScroll={(event) => {
          const nextTop = event.currentTarget.scrollTop
          setScrollTop(nextTop)
          setWindowForScroll(nextTop)
        }}
      >
        <VirtualWindow totalSize={virtualSize()} offset={windowStart() * rowHeight()}>
          <Tree
            aria-label="Workspace files"
            data-testid="file-tree"
            visibleItems={allItems()}
            activeId={activeId()}
            selectionMode="single"
            onActiveIdChange={setActiveId}
            onExpand={setExpandedState}
            onRequestReveal={requestReveal}
            onRowSizeChange={(id, blockSize) => {
              setRowSizes((current) => new Map(current).set(id, blockSize))
              setRowHeight(blockSize)
            }}
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
        </VirtualWindow>
      </div>
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
        onClick={() => setActiveId(`file-${fileCount - 1}`)}
      >
        Set last active id
      </Button>
      <output aria-label="Active row">{activeId() ?? 'none'}</output>
      <output aria-label="Selected row">{selectedId() ?? 'none'}</output>
      <output aria-label="Activation count">{activations()}</output>
      <output aria-label="Action count">{actions()}</output>
      <output aria-label="Full projection count">{allItems().length}</output>
      <output aria-label="Measured row height">{rowHeight()}</output>
      <output aria-label="Observed row count">{rowSizes().size}</output>
      <output aria-label="Virtual scroll height">{virtualSize()}</output>
      <output aria-label="Scroll top">{scrollTop()}</output>
      <output aria-label="Viewport height">{viewportHeight()}</output>
    </main>
  )
}

render(() => <WindowedTreeFixture />, document.body)
