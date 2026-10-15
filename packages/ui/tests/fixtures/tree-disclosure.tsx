import { createMemo, createSignal, For, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { FileText, Folder, Pencil } from 'lucide-solid'
import { ActionButton } from '../../src/components/composites/action-button/action-button'
import { Tree, TreeRow, TreeRowActions } from '../../src/components/composites/tree'
import type { TreeItemDescriptor } from '../../src/components/composites/tree'
import { Input } from '../../src/components/ui/input/input'
import { StatusChip } from '../../src/components/ui/status-chip/status-chip'
import { Switch } from '../../src/components/ui/switch/switch'
import '../../src/styles/globals.css'

/**
 * Three identical trees that differ only in how `disclosure` is passed: omitted,
 * the explicit default `row`, and `marker`. Each logs every host callback so a
 * spec can compare the pointer and keyboard paths across modes.
 */
const nodes = [
  { id: 'sources', parentId: null, level: 1, expandable: true, label: 'Sources' },
  { id: 'repo-a', parentId: 'sources', level: 2, expandable: true, label: 'Repository A' },
  { id: 'repo-a-hint', parentId: 'repo-a', level: 3, expandable: false, label: '12 chunks' },
  { id: 'repo-b', parentId: 'sources', level: 2, expandable: true, label: 'Repository B' },
  { id: 'repo-b-hint', parentId: 'repo-b', level: 3, expandable: false, label: '3 chunks' },
  { id: 'notes', parentId: 'sources', level: 2, expandable: false, label: 'Notes' },
] as const

type Node = (typeof nodes)[number]

/**
 * A row is visible only when every ancestor is expanded, not just its parent: a
 * collapsed folder hides its whole subtree, however deeply nested and whatever
 * the expansion state of the folders inside it (which is kept, so re-expanding
 * restores them).
 */
function isVisible(item: Node, expanded: ReadonlySet<string>): boolean {
  let parentId: string | null = item.parentId
  while (parentId !== null) {
    if (!expanded.has(parentId)) return false
    parentId = nodes.find((candidate) => candidate.id === parentId)!.parentId
  }
  return true
}

type Mode = 'omitted' | 'row' | 'marker'

/** Host-side levers a spec can pull: what the host does that the Tree cannot see. */
type HostControls = {
  /** Expand or collapse a row as the host would from a command, with no Tree event. */
  setExpanded: (id: string, expanded: boolean) => void
  /** Move the roving stop as the host would (restored state), without any DOM focus. */
  setActiveId: (id: string) => void
  /** The file-explorer convention: `onActivate` toggles a folder. Off unless a spec asks. */
  setToggleOnActivate: (on: boolean) => void
}

declare global {
  interface Window {
    treeDisclosureLogs: Record<string, string[]>
    treeDisclosureHost: Record<string, HostControls>
  }
}
window.treeDisclosureLogs = {}
window.treeDisclosureHost = {}

function TreeCase(props: { name: Mode }) {
  const log = (entry: string) => (window.treeDisclosureLogs[props.name] ??= []).push(entry)
  window.treeDisclosureLogs[props.name] = []
  const [activeId, setActiveId] = createSignal<string | null>('sources')
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [expandedIds, setExpandedIds] = createSignal(new Set(['sources', 'repo-a']))
  const [switched, setSwitched] = createSignal(false)
  const visibleItems = createMemo(() => {
    const expanded = expandedIds()
    return nodes
      .filter((item) => isVisible(item, expanded))
      .map((item): TreeItemDescriptor => ({
        id: item.id,
        parentId: item.parentId,
        level: item.level,
        expandable: item.expandable,
        expanded: expanded.has(item.id),
      }))
  })
  const setExpanded = (id: string, expanded: boolean) =>
    setExpandedIds((current) => {
      const next = new Set(current)
      if (expanded) next.add(id)
      else next.delete(id)
      return next
    })
  let toggleOnActivate = false
  const host: HostControls = {
    setExpanded: (id, expanded) => {
      log(`host-expand:${id}:${expanded}`)
      setExpanded(id, expanded)
    },
    setActiveId: (id) => setActiveId(id),
    setToggleOnActivate: (on) => {
      toggleOnActivate = on
    },
  }
  window.treeDisclosureHost[props.name] = host
  // A spread keeps the `omitted` case free of the prop, as an existing consumer is.
  const disclosure = props.name === 'omitted' ? {} : { disclosure: props.name }

  return (
    <section class="w-96 p-2" aria-label={`${props.name} tree case`}>
      <Tree
        id={`tree-${props.name}`}
        aria-label={`Sources ${props.name}`}
        visibleItems={visibleItems()}
        activeId={activeId()}
        selectionMode="single"
        {...disclosure}
        onActiveIdChange={(id) => {
          // `Tree` may repeat a notification for the row that is already active; the
          // raw calls are kept apart so a spec can assert none were made at all.
          ;(window.treeDisclosureLogs[`${props.name}:active-calls`] ??= []).push(id)
          if (id !== activeId()) log(`active:${id}`)
          setActiveId(id)
        }}
        onExpand={(id, expanded) => {
          log(`expand:${id}:${expanded}`)
          setExpanded(id, expanded)
        }}
        onActivate={(id, event) => {
          log(`activate:${id}:${event.type}`)
          setSelectedId(id)
          if (toggleOnActivate && nodes.some((node) => node.parentId === id)) {
            const expanded = !expandedIds().has(id)
            log(`toggle:${id}:${expanded}`)
            setExpanded(id, expanded)
          }
        }}
        onSelectItem={(id) => {
          log(`select:${id}`)
        }}
      >
        <For each={visibleItems()}>
          {(item) => {
            const node = nodes.find((candidate) => candidate.id === item.id)!
            return (
              <TreeRow
                item={item}
                selected={selectedId() === item.id}
                onDoubleClick={(id) => log(`dblclick:${id}`)}
                leading={
                  item.expandable ? (
                    <Folder aria-hidden="true" class="text-muted-foreground" />
                  ) : (
                    <FileText aria-hidden="true" class="text-muted-foreground" />
                  )
                }
                trailing={
                  <Show when={item.id === 'repo-a'}>
                    <>
                      <StatusChip tone="success" label="Ready" />
                      {/* The switch's visual control is a plain div, so `isActionTarget`
                          does not see a click on it; this marker is the documented seam. */}
                      <span data-tree-keyboard-stop class="inline-flex">
                        <Switch
                          aria-label="Use Repository A"
                          checked={switched()}
                          onChange={(checked: boolean) => {
                            log(`switch:${checked}`)
                            setSwitched(checked)
                          }}
                        />
                      </span>
                      <TreeRowActions pinned>
                        <ActionButton
                          variant="ghost"
                          size="icon-xs"
                          tooltip="Rename Repository A"
                          aria-label="Rename Repository A"
                          onClick={() => log('action:rename')}
                        >
                          <Pencil aria-hidden="true" />
                        </ActionButton>
                      </TreeRowActions>
                    </>
                  </Show>
                }
              >
                {node.label}
              </TreeRow>
            )
          }}
        </For>
      </Tree>
    </section>
  )
}

render(
  () => (
    <main>
      <h1 class="sr-only">Tree disclosure fixture</h1>
      {/* Somewhere for focus to be that is not a tree. */}
      <Input id="outside" aria-label="Outside field" class="m-2 w-96" />
      <TreeCase name="omitted" />
      <TreeCase name="row" />
      <TreeCase name="marker" />
    </main>
  ),
  document.body
)
