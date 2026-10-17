import { File, Folder, FolderOpen } from 'lucide-solid'
import {
  createComputed,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  splitProps,
  untrack,
  type ComponentProps,
} from 'solid-js'
import { keyedRows } from '../../../lib/keyed-rows'
import { cn } from '../../../lib/utils'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { Tree, TreeRow, type TreeItemDescriptor } from '../tree'
import {
  buildFileTree,
  clampWindow,
  countChanges,
  describeChanges,
  FILE_CHANGE_LABELS,
  flattenFileTree,
  indexFileTree,
  initialExpanded,
  revealInWindow,
  typeaheadIndex,
  type RowWindow,
  type FileChangeInput,
  type FileChangeKind,
  type FileTreeExpansion,
  type FileTreeNode,
  type FileTreeRow,
} from './build-file-tree'

/**
 * FileTree.
 *
 * The files an agent changed, as a folder tree. It is for a change set — dozens
 * to thousands of paths with an optional change kind each — and not for browsing
 * a workspace: it has no rename, drag, or filesystem action, and it never opens
 * anything. Reach for `Trace` lines when the agent touched two or three files, and
 * for the shared `Tree` directly when the host owns a real file explorer.
 *
 * ## Built on `Tree`, and why that fits
 *
 * `Tree` supplies the treeitem semantics and the WAI-ARIA keyboard model (arrows,
 * Home/End, roving tab stop) and leaves the projection to the host. A changed-file
 * tree is small enough that the whole projection can live in memory, and the
 * `Tree` contract for a mounted window — a complete `visibleItems` list with only
 * some rows rendered, `onRequestReveal` to mount a row the keyboard moved to — is
 * exactly the seam a bounded render needs, so this adds no navigation code of
 * its own. What it adds is typeahead, which `Tree` does not provide: a typed
 * prefix jumps to the next row whose name starts with it.
 *
 * ## Large trees
 *
 * A collapsed folder's subtree is never visited or rendered, so a 5 000-file tree
 * costs what is visible. A tree of more than 100 files starts with only its top
 * level open (`defaultExpanded` overrides). Past `maxRows` visible rows only a
 * window of them is mounted, with a control above and below to move it a page at
 * a time. The full list is what keyboard navigation walks: an arrow key at the
 * window's edge grows it by a page, and a jump (End, Home, a typed letter) moves
 * it to the page holding the target instead of mounting every row between, so End
 * on a tree of thousands of open rows stays one page of work.
 *
 * ## Changes are claims
 *
 * A change kind is drawn — as a word on the row, so it is also spoken — only for a
 * file the host gave one. A file without one is listed and nothing more is said.
 * The summary counts what was supplied, and is silent about files with no kind.
 * Paths that are not acceptable (`..` segments, control characters) are not drawn;
 * their number is stated, so the list is never quietly shorter than the input.
 *
 * ## Selection is the host's
 *
 * Rows select only when `onSelect` is supplied; without it no row is selectable
 * and `aria-selected` is not set. Enter or a click on a folder expands it; on a
 * file it selects. Space selects either. The tree never opens a file itself — the
 * path is untrusted text, and what it means on this machine is the host's call.
 */
export type FileTreeProps = Omit<ComponentProps<'div'>, 'children' | 'onSelect'> & {
  /** Paths, or paths with a change kind. Both `/` and `\` separate segments. */
  files: readonly (string | FileChangeInput)[]
  /** The tree's accessible name. Default "Changed files". */
  label?: string
  /**
   * Which folders start open: `true` all, `false` none, a number to that depth,
   * or a list of ids. Unset opens a small tree fully and a large one at its top level.
   */
  defaultExpanded?: FileTreeExpansion
  /** Merge a folder with a single folder child into one row. Default true. */
  compact?: boolean
  /** The selected node's id. Meaningful only with `onSelect`. */
  selected?: string
  /** Make rows selectable. Omit and nothing is selectable. */
  onSelect?: (path: string, node: FileTreeNode) => void
  /** Height of the tree box, which scrolls past it. A number is pixels. Default `20rem`. */
  maxHeight?: number | string
  /** Visible rows mounted at once; more are added a page at a time. Default 500. */
  maxRows?: number
  /** Show the count of changes above the tree. Default true. */
  showSummary?: boolean
}

export const FILE_TREE_MAX_ROWS = 500

const CHANGE_VARIANT: Readonly<
  Record<FileChangeKind, 'success' | 'warning' | 'destructive' | 'info'>
> = {
  added: 'success',
  modified: 'warning',
  deleted: 'destructive',
  renamed: 'info',
}

function descriptor(row: FileTreeRow): TreeItemDescriptor {
  return {
    id: row.node.id,
    parentId: row.parentId,
    level: row.level,
    expandable: row.node.kind === 'directory',
    expanded: row.expanded,
  }
}

function RowContent(props: { row: FileTreeRow }) {
  const node = () => props.row.node
  return (
    <>
      <span
        class={cn('truncate', {
          'text-muted-foreground line-through': node().change === 'deleted',
        })}
        title={node().id}
      >
        {node().name}
      </span>
      <Show when={node().renamedFrom}>
        <span class="sr-only">, renamed from {node().renamedFrom}</span>
      </Show>
    </>
  )
}

function RowTrailing(props: { row: FileTreeRow }) {
  const node = () => props.row.node
  return (
    <>
      <Show when={node().kind === 'file' && (node().additions || node().deletions)}>
        <span class="font-code text-2xs tabular-nums">
          <Show when={node().additions !== undefined}>
            <span class="text-foreground">+{node().additions}</span>
          </Show>{' '}
          <Show when={node().deletions !== undefined}>
            <span class="text-foreground">−{node().deletions}</span>
          </Show>
        </span>
      </Show>
      <Show when={node().kind === 'directory' && !props.row.expanded}>
        <span class="text-2xs tabular-nums">
          {node().fileCount.toLocaleString()} {node().fileCount === 1 ? 'file' : 'files'}
        </span>
      </Show>
      {/* The word is the signal; the tint only helps a sighted reader find it. */}
      <Show when={node().change}>
        {(change) => (
          <Badge variant={CHANGE_VARIANT[change()]} size="sm">
            {FILE_CHANGE_LABELS[change()]}
          </Badge>
        )}
      </Show>
    </>
  )
}

export function FileTree(props: FileTreeProps) {
  const [local, rest] = splitProps(props, [
    'files',
    'label',
    'defaultExpanded',
    'compact',
    'selected',
    'onSelect',
    'maxHeight',
    'maxRows',
    'showSummary',
    'class',
  ])

  const build = createMemo(() => buildFileTree(local.files, { compact: local.compact }))
  const nodes = createMemo(() => indexFileTree(build().roots))
  const counts = createMemo(() => countChanges(build().roots))

  // Folders the tree has already decided about. A change set that grows while
  // the agent works opens its new folders by the same rule as the first render,
  // and never reopens one the reader closed.
  const [expanded, setExpanded] = createSignal<ReadonlySet<string>>(new Set())
  let seen = new Set<string>()
  createComputed(() => {
    const { roots, fileCount } = build()
    const wanted = initialExpanded(roots, local.defaultExpanded, fileCount)
    const folders = new Set<string>()
    for (const [id, node] of nodes()) if (node.kind === 'directory') folders.add(id)
    untrack(() => {
      const next = new Set([...expanded()].filter((id) => folders.has(id)))
      for (const id of wanted) if (!seen.has(id)) next.add(id)
      seen = folders
      setExpanded(next)
    })
  })

  const rows = createMemo(() => flattenFileTree(build().roots, expanded()))
  const pageSize = () => Math.max(1, Math.floor(local.maxRows ?? FILE_TREE_MAX_ROWS))
  const [requested, setRequested] = createSignal<RowWindow>({ start: 0, end: 0 })
  const mountedWindow = createMemo(() =>
    clampWindow(
      requested().end === 0 ? { start: 0, end: pageSize() } : requested(),
      rows().length,
      pageSize()
    )
  )
  const items = createMemo(() => rows().map(descriptor))
  const mounted = keyedRows(
    () => rows().slice(mountedWindow().start, mountedWindow().end),
    (row) => row.node.id
  )
  const rowsBefore = () => mountedWindow().start
  const rowsAfter = () => Math.max(0, rows().length - mountedWindow().end)

  const [activeId, setActiveId] = createSignal<string | null>(null)
  const selectable = () => local.onSelect !== undefined

  const toggle = (id: string, open: boolean) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  }

  /** Mount the rows around one the keyboard is moving to, so focus can land on it. */
  const reveal = (id: string) => {
    const index = rows().findIndex((row) => row.node.id === id)
    setRequested(revealInWindow(mountedWindow(), index, rows().length, pageSize()))
  }

  const select = (id: string) => {
    const node = nodes().get(id)
    if (node) local.onSelect?.(id, node)
  }
  const activate = (id: string) => {
    const node = nodes().get(id)
    if (!node) return
    if (node.kind === 'directory') toggle(id, !expanded().has(id))
    else select(id)
  }

  let container: HTMLDivElement | undefined
  let typed = ''
  let typedTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(typedTimer))
  const typeahead = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.key.length !== 1 ||
      event.key === ' '
    ) {
      return
    }
    typed += event.key
    clearTimeout(typedTimer)
    typedTimer = setTimeout(() => (typed = ''), 700)
    const all = rows()
    const active = all.findIndex((row) => row.node.id === activeId())
    const target = typeaheadIndex(
      all.map((row) => row.node.name),
      active,
      typed
    )
    const row = all[target]
    if (!row) return
    event.preventDefault()
    const id = row.node.id
    reveal(id)
    setActiveId(id)
    queueMicrotask(() => {
      for (const element of container?.querySelectorAll<HTMLElement>('[data-tree-id]') ?? []) {
        if (element.dataset.treeId === id) {
          element.focus()
          break
        }
      }
    })
  }

  const maxHeight = () =>
    typeof local.maxHeight === 'number' ? `${local.maxHeight}px` : (local.maxHeight ?? '20rem')

  return (
    <div
      data-slot="file-tree"
      class={cn('flex min-w-0 flex-col gap-1', local.class)}
      ref={(element) => (container = element)}
      {...rest}
    >
      <Show when={local.showSummary !== false}>
        <p data-slot="file-tree-summary" class="m-0 text-xs text-muted-foreground">
          {describeChanges(counts())}
          <Show when={build().rejected.length > 0}>
            {' '}
            · {build().rejected.length.toLocaleString()}{' '}
            {build().rejected.length === 1 ? 'path' : 'paths'} ignored as not valid
          </Show>
        </p>
      </Show>
      <Show when={rows().length === 0 && local.showSummary === false}>
        <p class="m-0 text-xs text-muted-foreground">No changed files</p>
      </Show>
      <Show when={rows().length > 0}>
        {/* The listener sits on the wrapper because `Tree` owns its own keydown
            and ignores printable keys; typeahead picks up where it stops. */}
        <Show when={rowsBefore() > 0}>
          <div>
            <Button
              variant="ghost"
              size="2xs"
              onClick={() =>
                setRequested({
                  start: Math.max(0, mountedWindow().start - pageSize()),
                  end: mountedWindow().end,
                })
              }
            >
              Show {Math.min(rowsBefore(), pageSize()).toLocaleString()} earlier rows (
              {rowsBefore().toLocaleString()} not shown)
            </Button>
          </div>
        </Show>
        <div
          class="scroll-fade overflow-auto rounded-md"
          style={{ 'max-height': maxHeight() }}
          onKeyDown={typeahead}
        >
          <Tree
            aria-label={local.label ?? 'Changed files'}
            visibleItems={items()}
            activeId={activeId()}
            onActiveIdChange={setActiveId}
            onExpand={toggle}
            onActivate={(id) => activate(id)}
            onSelectItem={(id) => select(id)}
            onRequestReveal={reveal}
            selectionMode={selectable() ? 'single' : undefined}
          >
            <For each={mounted()}>
              {(entry) => (
                <TreeRow
                  item={descriptor(entry.item())}
                  selected={selectable() ? local.selected === entry.item().node.id : undefined}
                  leading={
                    entry.item().node.kind === 'directory' ? (
                      entry.item().expanded ? (
                        <FolderOpen aria-hidden="true" class="text-muted-foreground" />
                      ) : (
                        <Folder aria-hidden="true" class="text-muted-foreground" />
                      )
                    ) : (
                      <File aria-hidden="true" class="text-muted-foreground" />
                    )
                  }
                  trailing={<RowTrailing row={entry.item()} />}
                >
                  <RowContent row={entry.item()} />
                </TreeRow>
              )}
            </For>
          </Tree>
        </div>
        <Show when={rowsAfter() > 0}>
          <div>
            <Button
              variant="ghost"
              size="2xs"
              onClick={() =>
                setRequested({
                  start: mountedWindow().start,
                  end: Math.min(rows().length, mountedWindow().end + pageSize()),
                })
              }
            >
              Show {Math.min(rowsAfter(), pageSize()).toLocaleString()} more rows (
              {rowsAfter().toLocaleString()} not shown)
            </Button>
          </div>
        </Show>
      </Show>
    </div>
  )
}
