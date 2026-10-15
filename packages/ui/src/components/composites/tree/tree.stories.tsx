import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { Database, FileText, Folder, Pencil, RefreshCw } from 'lucide-solid'
import { StatusChip } from '../../ui/status-chip/status-chip'
import { Switch } from '../../ui/switch/switch'
import { ActionButton } from '../action-button/action-button'
import { Tree, TreeRow, TreeRowActions } from './tree'
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

/**
 * Donor-shaped file rows with host-owned expansion and selection state. File
 * rows carry a rename action in `TreeRowActions`, shown on hover or focus.
 */
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
                  trailing={
                    item.expandable ? undefined : (
                      <TreeRowActions>
                        <ActionButton
                          variant="ghost"
                          size="icon-xs"
                          tooltip={`Rename ${node.label}`}
                          aria-label={`Rename ${node.label}`}
                        >
                          <Pencil aria-hidden="true" />
                        </ActionButton>
                      </TreeRowActions>
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

type Source = {
  id: string
  parentId: string | null
  level: number
  expandable: boolean
  label: string
  tone?: 'success' | 'warning'
  status?: string
}

const sources: readonly Source[] = [
  {
    id: 'docs',
    parentId: null,
    level: 1,
    expandable: true,
    label: 'Product docs',
    tone: 'success',
    status: 'Ready',
  },
  { id: 'docs-hint', parentId: 'docs', level: 2, expandable: false, label: '12 chunks · healthy' },
  {
    id: 'wiki',
    parentId: null,
    level: 1,
    expandable: true,
    label: 'Team wiki',
    tone: 'warning',
    status: 'Stale',
  },
  { id: 'wiki-hint', parentId: 'wiki', level: 2, expandable: false, label: '3 chunks · stale' },
  { id: 'notes', parentId: null, level: 1, expandable: false, label: 'Pinned notes' },
]

/**
 * A source three levels deep, so collapsing the top row has to hide a grandchild
 * that sits under a folder which is itself still expanded.
 */
const nestedSources: readonly Source[] = [
  {
    id: 'docs',
    parentId: null,
    level: 1,
    expandable: true,
    label: 'Product docs',
    tone: 'success',
    status: 'Ready',
  },
  { id: 'guides', parentId: 'docs', level: 2, expandable: true, label: 'Guides' },
  {
    id: 'guides-hint',
    parentId: 'guides',
    level: 3,
    expandable: false,
    label: '4 chunks · healthy',
  },
  { id: 'reference', parentId: 'docs', level: 2, expandable: false, label: 'Reference' },
  { id: 'notes', parentId: null, level: 1, expandable: false, label: 'Pinned notes' },
]

/**
 * The projection a host owes `Tree`: a row is visible only when EVERY ancestor is
 * expanded, not just its parent. Hiding only direct children would leave the
 * grandchildren of a collapsed row on screen, under an expanded folder that is
 * itself hidden. The expansion state of hidden folders is kept, so expanding
 * the ancestor again restores what was open inside it.
 */
function visibleProjection(
  items: readonly Source[],
  expanded: ReadonlySet<string>
): TreeItemDescriptor[] {
  const parentOf = new Map(items.map((item) => [item.id, item.parentId]))
  const isVisible = (item: Source) => {
    for (let parent = item.parentId; parent !== null; parent = parentOf.get(parent) ?? null) {
      if (!expanded.has(parent)) return false
    }
    return true
  }
  return items.filter(isVisible).map((item) => ({
    id: item.id,
    parentId: item.parentId,
    level: item.level,
    expandable: item.expandable,
    expanded: expanded.has(item.id),
  }))
}

/**
 * A source list in which expanding and selecting are separate decisions, so the
 * chevron is its own pointer target (`disclosure="marker"`). The row carries a
 * status chip, a switch and an action, as a real source row does.
 */
function SourceTree(props: {
  items?: readonly Source[]
  expanded?: readonly string[]
  active?: string
}) {
  const items = () => props.items ?? sources
  const sourceLabel = (id: string) => items().find((source) => source.id === id)!.label
  const [activeId, setActiveId] = createSignal<string | null>(props.active ?? 'docs')
  const [selectedId, setSelectedId] = createSignal('docs')
  const [expandedIds, setExpandedIds] = createSignal(new Set(props.expanded ?? ['docs']))
  const [enabledIds, setEnabledIds] = createSignal(new Set(['docs']))
  const [refreshed, setRefreshed] = createSignal(0)
  const visibleItems = createMemo(() => visibleProjection(items(), expandedIds()))

  return (
    <div class="w-96">
      <div class="rounded-xl border border-border p-2">
        <Tree
          aria-label="Sources"
          disclosure="marker"
          selectionMode="single"
          visibleItems={visibleItems()}
          activeId={activeId()}
          onActiveIdChange={setActiveId}
          onExpand={(id, expanded) =>
            setExpandedIds((current) => {
              const next = new Set(current)
              if (expanded) next.add(id)
              else next.delete(id)
              return next
            })
          }
          onActivate={(id) => {
            // Selection only. Expansion is the chevron's (or Left/Right's) job.
            if (items().find((source) => source.id === id)?.parentId === null) setSelectedId(id)
          }}
          onSelectItem={(id) => {
            if (items().find((source) => source.id === id)?.parentId === null) setSelectedId(id)
          }}
        >
          <For each={visibleItems()}>
            {(item) => {
              const source = items().find((candidate) => candidate.id === item.id)!
              return (
                <TreeRow
                  item={item}
                  selected={source.parentId === null ? selectedId() === item.id : undefined}
                  leading={
                    source.parentId === null ? (
                      <Database aria-hidden="true" class="text-muted-foreground" />
                    ) : undefined
                  }
                  trailing={
                    <Show when={source.status}>
                      <StatusChip tone={source.tone} label={source.status!} />
                      {/* The switch's visual control is a plain div, which the row's
                          interactive-descendant check does not recognise; the stop marker is
                          the documented seam for it. */}
                      <span data-tree-keyboard-stop class="inline-flex">
                        <Switch
                          aria-label={`Use ${source.label}`}
                          checked={enabledIds().has(item.id)}
                          onChange={(checked: boolean) =>
                            setEnabledIds((current) => {
                              const next = new Set(current)
                              if (checked) next.add(item.id)
                              else next.delete(item.id)
                              return next
                            })
                          }
                        />
                      </span>
                      <ActionButton
                        variant="ghost"
                        size="icon-xs"
                        tooltip={`Refresh ${source.label}`}
                        aria-label={`Refresh ${source.label}`}
                        onClick={() => setRefreshed((count) => count + 1)}
                      >
                        <RefreshCw aria-hidden="true" />
                      </ActionButton>
                    </Show>
                  }
                >
                  <span class={source.parentId === null ? undefined : 'text-muted-foreground'}>
                    {source.label}
                  </span>
                </TreeRow>
              )
            }}
          </For>
        </Tree>
      </div>
      <p class="mt-2 text-sm text-muted-foreground" data-testid="selection">
        Selected source: {sourceLabel(selectedId())}
      </p>
      <p class="text-sm text-muted-foreground" data-testid="refreshed">
        Refreshes: {refreshed()}
      </p>
    </div>
  )
}

const treeRow = (canvasElement: HTMLElement, id: string) =>
  canvasElement.querySelector<HTMLElement>(`[data-tree-id="${id}"]`)!
const disclosureOf = (canvasElement: HTMLElement, id: string) =>
  treeRow(canvasElement, id).querySelector<HTMLElement>('[data-slot="tree-row-disclosure"]')!

/**
 * `disclosure="marker"`: the chevron expands and the row selects. Default `Tree`
 * keeps the file-explorer convention (a click anywhere, chevron included, is an
 * activation); this opt-in is for lists where the two are independent, such as a
 * set of sources whose details can be opened without selecting them.
 *
 * The chevron stays `aria-hidden`, unfocusable and out of the tab order, so
 * keyboard users are unchanged: Left/Right expand, Enter activates, Space selects.
 * Pressing the chevron never moves focus to its own row; it is a pointer shortcut
 * for `onExpand`. (Collapsing a row can still remove the focused row, and then
 * `Tree` moves focus itself: see `DisclosureMarkerCollapse`.)
 */
export const DisclosureMarker: Story = {
  args: {
    'aria-label': 'Sources',
    visibleItems: [],
    activeId: null,
    onActiveIdChange: () => undefined,
  },
  render: () => <SourceTree />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const selection = canvas.getByTestId('selection')
    await expect(selection).toHaveTextContent('Selected source: Product docs')

    // The host re-keys rows when the projection changes, so look rows up afresh each time.
    const wiki = () => treeRow(canvasElement, 'wiki')

    // Chevron expands the collapsed row and leaves the selection where it was.
    await expect(wiki()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(disclosureOf(canvasElement, 'wiki'))
    await expect(wiki()).toHaveAttribute('aria-expanded', 'true')
    await expect(treeRow(canvasElement, 'wiki-hint')).toBeInTheDocument()
    await expect(wiki()).toHaveAttribute('aria-selected', 'false')
    await expect(selection).toHaveTextContent('Selected source: Product docs')

    // The rest of the row selects and does not collapse it.
    await userEvent.click(canvas.getByText('Team wiki'))
    await expect(wiki()).toHaveAttribute('aria-selected', 'true')
    await expect(wiki()).toHaveAttribute('aria-expanded', 'true')
    await expect(selection).toHaveTextContent('Selected source: Team wiki')

    // The chevron collapses it again, still without touching the selection.
    await userEvent.click(disclosureOf(canvasElement, 'wiki'))
    await expect(wiki()).toHaveAttribute('aria-expanded', 'false')
    await expect(selection).toHaveTextContent('Selected source: Team wiki')

    // A row that cannot expand has no chevron target; its marker slot is the row.
    await expect(treeRow(canvasElement, 'notes').querySelector('[data-slot]')).toBeNull()
    await userEvent.click(treeRow(canvasElement, 'notes').firstElementChild as HTMLElement)
    await expect(selection).toHaveTextContent('Selected source: Pinned notes')

    // Trailing controls neither select nor expand.
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh Product docs' }))
    await expect(canvas.getByTestId('refreshed')).toHaveTextContent('Refreshes: 1')
    const docsSwitch = canvas.getByRole('switch', { name: 'Use Product docs' })
    await userEvent.click(
      treeRow(canvasElement, 'docs').querySelector<HTMLElement>('[data-slot="switch"] > div')!
    )
    await expect(docsSwitch).not.toBeChecked()
    await expect(selection).toHaveTextContent('Selected source: Pinned notes')
    await expect(treeRow(canvasElement, 'docs')).toHaveAttribute('aria-expanded', 'true')
  },
}

/**
 * Keyboard behaviour with `disclosure="marker"` is the default tree's, key for
 * key: the chevron is never a tab stop, Left/Right expand and collapse, and
 * Enter and Space activate and select without toggling.
 */
export const DisclosureMarkerKeyboard: Story = {
  args: {
    'aria-label': 'Sources',
    visibleItems: [],
    activeId: null,
    onActiveIdChange: () => undefined,
  },
  render: () => <SourceTree />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const selection = canvas.getByTestId('selection')
    // The host re-keys rows when the projection changes, so look rows up afresh each time.
    const docs = () => treeRow(canvasElement, 'docs')
    const wiki = () => treeRow(canvasElement, 'wiki')

    // Tab lands on the one roving row, then walks the trailing controls; the
    // chevron is never a stop.
    await userEvent.tab()
    await expect(docs()).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('switch', { name: 'Use Product docs' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Refresh Product docs' })).toHaveFocus()
    for (const chevron of canvasElement.querySelectorAll('[data-slot="tree-row-disclosure"]')) {
      await expect(chevron).not.toHaveAttribute('tabindex')
      await expect(chevron.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }

    // Left collapses, Right re-expands.
    docs().focus()
    await userEvent.keyboard('{ArrowLeft}')
    await expect(docs()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard('{ArrowRight}')
    await expect(docs()).toHaveAttribute('aria-expanded', 'true')

    // Enter selects the row it is on and does not toggle it; so does Space.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    await expect(wiki()).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(selection).toHaveTextContent('Selected source: Team wiki')
    await expect(wiki()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    await userEvent.keyboard(' ')
    await expect(selection).toHaveTextContent('Selected source: Product docs')
    await expect(docs()).toHaveAttribute('aria-expanded', 'true')
  },
}

/**
 * Collapsing a row hides its whole subtree, however deep, and the expansion
 * state of the folders inside it is kept. When that removes the row that held
 * focus, `Tree` does what it does in either disclosure mode: the first visible
 * row becomes the one roving stop and takes focus, and the host hears
 * `onActiveIdChange` for it. Here the focused grandchild sits under an
 * expanded Guides folder, so a projection that only hid direct children would
 * leave it on screen.
 */
export const DisclosureMarkerCollapse: Story = {
  args: {
    'aria-label': 'Sources',
    visibleItems: [],
    activeId: null,
    onActiveIdChange: () => undefined,
  },
  render: () => (
    <SourceTree items={nestedSources} expanded={['docs', 'guides']} active="guides-hint" />
  ),
  play: async ({ canvasElement }) => {
    const ids = () =>
      Array.from(canvasElement.querySelectorAll('[role="treeitem"]')).map((element) =>
        element.getAttribute('data-tree-id')
      )
    const stops = () =>
      Array.from(canvasElement.querySelectorAll('[role="treeitem"][tabindex="0"]')).map((element) =>
        element.getAttribute('data-tree-id')
      )
    // The host re-keys rows when the projection changes, so look rows up afresh each time.
    const row = (id: string) => treeRow(canvasElement, id)

    await expect(ids()).toEqual(['docs', 'guides', 'guides-hint', 'reference', 'notes'])
    row('guides-hint').focus()
    await expect(row('guides-hint')).toHaveFocus()

    // The chevron on the top row hides the folder, its grandchild and the
    // folder's own (still expanded) contents; the focused row is one of them.
    await userEvent.click(disclosureOf(canvasElement, 'docs'))
    await expect(ids()).toEqual(['docs', 'notes'])
    await waitFor(() => expect(row('docs')).toHaveFocus())
    await expect(stops()).toEqual(['docs'])

    // The keyboard carries on from the row that took focus. Guides is still
    // expanded inside, so it comes back with its child.
    await userEvent.keyboard('{ArrowRight}')
    await expect(ids()).toEqual(['docs', 'guides', 'guides-hint', 'reference', 'notes'])
    await userEvent.keyboard('{ArrowDown}')
    await expect(row('guides')).toHaveFocus()

    // Left on an open folder collapses it and leaves focus on it: the focused
    // row is still visible, so nothing is recovered.
    await userEvent.keyboard('{ArrowLeft}')
    await expect(ids()).toEqual(['docs', 'guides', 'reference', 'notes'])
    await expect(row('guides')).toHaveFocus()
    await expect(stops()).toEqual(['guides'])
  },
}
