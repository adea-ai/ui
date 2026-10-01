import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createMemo, createSignal, For } from 'solid-js'
import { FileText, Folder } from 'lucide-solid'
import { Tree, TreeRow } from './tree'
import type { TreeItemDescriptor } from './tree-navigation'

const nodes = [
  { id: 'workspace', parentId: null, level: 1, expandable: true, label: 'workspace' },
  { id: 'src', parentId: 'workspace', level: 2, expandable: true, label: 'src' },
  { id: 'files', parentId: 'src', level: 3, expandable: false, label: 'files-pane.tsx' },
  { id: 'styles', parentId: 'src', level: 3, expandable: false, label: 'files-pane.css' },
  { id: 'tests', parentId: 'workspace', level: 2, expandable: true, label: 'tests' },
  { id: 'tree-test', parentId: 'tests', level: 3, expandable: false, label: 'tree.test.ts' },
  { id: 'readme', parentId: 'workspace', level: 2, expandable: false, label: 'README.md' },
] as const

const meta = {
  title: 'Composites/Tree',
  component: Tree,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Tree>

export default meta
type Story = StoryObj<typeof meta>

/** Donor-shaped file rows with host-owned expansion and selection state. */
export const FileHierarchy: Story = {
  args: {
    'aria-label': 'Workspace files',
    visibleItems: [],
    activeId: null,
    onActiveIdChange: () => undefined,
  },
  render: () => {
    const [activeId, setActiveId] = createSignal<string | null>('src')
    const [selectedId, setSelectedId] = createSignal('files')
    const [expandedIds, setExpandedIds] = createSignal(new Set(['workspace', 'src']))
    const visibleItems = createMemo(() => {
      const expanded = expandedIds()
      return nodes
        .filter((item) => item.parentId === null || expanded.has(item.parentId))
        .map((item): TreeItemDescriptor => ({
          id: item.id,
          parentId: item.parentId,
          level: item.level,
          expandable: item.expandable,
          expanded: expanded.has(item.id),
        }))
    })

    const setExpanded = (id: string, expanded: boolean) => {
      setExpandedIds((current) => {
        const next = new Set(current)
        if (expanded) next.add(id)
        else next.delete(id)
        return next
      })
    }

    return (
      <div class="w-80 rounded-xl border border-border p-2">
        <Tree
          aria-label="Workspace files"
          visibleItems={visibleItems()}
          activeId={activeId()}
          selectionMode="single"
          onActiveIdChange={setActiveId}
          onExpand={setExpanded}
          onActivate={(id) => {
            const item = nodes.find((node) => node.id === id)
            if (item?.expandable) setExpanded(id, !expandedIds().has(id))
            else setSelectedId(id)
          }}
          onSelectItem={setSelectedId}
        >
          <For each={visibleItems()}>
            {(item) => {
              const node = nodes.find((candidate) => candidate.id === item.id)!
              return (
                <TreeRow
                  item={item}
                  selected={selectedId() === item.id}
                  leading={
                    item.expandable ? (
                      <Folder aria-hidden="true" class="text-muted-foreground" />
                    ) : (
                      <FileText aria-hidden="true" class="text-muted-foreground" />
                    )
                  }
                >
                  {node.label}
                </TreeRow>
              )
            }}
          </For>
        </Tree>
      </div>
    )
  },
}
