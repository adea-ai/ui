/**
 * The model behind the changed-files tree: paths in, a folder tree out, and the
 * small pure rules the view needs (what is visible, what to say about the
 * changes, what a typed letter jumps to).
 *
 * Paths come from an agent, which means from a model, which means they are
 * untrusted text. They are used here as labels and as ids, never as places to
 * read or write, and the builder is strict about what counts as a path at all:
 * a `..` segment, a control character or a bidirectional override rejects the
 * path rather than being cleaned up, because a cleaned-up path is a different
 * path and the tree would be making a claim the input did not. Rejected paths
 * are returned, not dropped silently, so the view can say how many it ignored.
 *
 * Everything is iterative. A path with ten thousand segments, or a tree five
 * thousand files wide, must not be able to overflow the stack or stall the page.
 */

export type FileChangeKind = 'added' | 'modified' | 'deleted' | 'renamed'

export type FileChangeInput = Readonly<{
  path: string
  /** Absent means the host did not say; the tree makes no statement about the file. */
  change?: FileChangeKind
  /** For a rename, where the file was. Shown as text only. */
  renamedFrom?: string
  additions?: number
  deletions?: number
}>

export type FileTreeNode = Readonly<{
  /** The normalised path, `/`-separated. Unique within a tree. */
  id: string
  /** The label. For a compacted folder chain this is `a/b/c`. */
  name: string
  kind: 'file' | 'directory'
  change?: FileChangeKind
  renamedFrom?: string
  additions?: number
  deletions?: number
  children: readonly FileTreeNode[]
  /** Files at or below this node. A file counts itself. */
  fileCount: number
}>

export type FileTreeBuild = Readonly<{
  roots: readonly FileTreeNode[]
  /** Inputs that were not accepted as paths, exactly as given. */
  rejected: readonly string[]
  /** Inputs that named a path already present. The first one wins. */
  duplicates: number
  fileCount: number
}>

export type BuildFileTreeOptions = {
  /** Merge a folder with a single folder child into one row (`src/lib`). Default true. */
  compact?: boolean
}

/** Deeper paths are rejected: no real repository nests this far, and a row's indent would be unusable. */
export const FILE_TREE_MAX_DEPTH = 256
const MAX_SEGMENT_LENGTH = 1024

function hasForbiddenCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (
      code < 0x20 ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069) ||
      code === 0x2028 ||
      code === 0x2029
    ) {
      return true
    }
  }
  return false
}

/**
 * A path as its segments, or `null` when it is not acceptable. Both separators
 * are accepted, empty and `.` segments are dropped (`a//b`, `./a`, trailing `/`),
 * and a leading separator is dropped, so an absolute path becomes relative to
 * the tree's root rather than escaping it.
 */
export function normalizePath(path: unknown): string[] | null {
  if (typeof path !== 'string' || hasForbiddenCharacter(path)) return null
  const segments: string[] = []
  let start = 0
  for (let i = 0; i <= path.length; i += 1) {
    if (i !== path.length && path[i] !== '/' && path[i] !== '\\') continue
    const segment = path.slice(start, i)
    start = i + 1
    if (segment === '' || segment === '.') continue
    if (segment === '..' || segment.length > MAX_SEGMENT_LENGTH) return null
    segments.push(segment)
    if (segments.length > FILE_TREE_MAX_DEPTH) return null
  }
  return segments.length === 0 ? null : segments
}

type Draft = {
  id: string
  name: string
  children: Map<string, Draft>
  change?: FileChangeKind
  renamedFrom?: string
  additions?: number
  deletions?: number
  explicit: boolean
}

function newDraft(id: string, name: string): Draft {
  return { id, name, children: new Map(), explicit: false }
}

function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
  const left = a.name.toLowerCase()
  const right = b.name.toLowerCase()
  if (left !== right) return left < right ? -1 : 1
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
}

function safeCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined
}

const CHANGE_KINDS: ReadonlySet<string> = new Set(['added', 'modified', 'deleted', 'renamed'])

/**
 * Build the tree. Folders sort before files, then by name without regard to
 * case. A path that is both a file and the parent of another path is a folder
 * that keeps the file entry's change (a file replaced by a directory is a real
 * thing to report).
 */
export function buildFileTree(
  paths: readonly (string | FileChangeInput)[],
  options: BuildFileTreeOptions = {}
): FileTreeBuild {
  const root = newDraft('', '')
  const rejected: string[] = []
  let duplicates = 0

  for (const input of paths) {
    const entry: FileChangeInput | undefined =
      typeof input === 'string'
        ? { path: input }
        : input && typeof input === 'object'
          ? input
          : undefined
    const segments = normalizePath(entry?.path)
    if (!entry || !segments) {
      rejected.push(
        typeof input === 'string' ? input : String((input as { path?: unknown })?.path ?? '')
      )
      continue
    }

    let node = root
    let id = ''
    for (const segment of segments) {
      id = id === '' ? segment : `${id}/${segment}`
      let child = node.children.get(segment)
      if (!child) {
        child = newDraft(id, segment)
        node.children.set(segment, child)
      }
      node = child
    }
    if (node.explicit) {
      duplicates += 1
      continue
    }
    node.explicit = true
    if (entry.change && CHANGE_KINDS.has(entry.change)) node.change = entry.change
    if (typeof entry.renamedFrom === 'string' && !hasForbiddenCharacter(entry.renamedFrom)) {
      node.renamedFrom = entry.renamedFrom
    }
    node.additions = safeCount(entry.additions)
    node.deletions = safeCount(entry.deletions)
  }

  // Pre-order flatten, then fold back in reverse: a child always has a larger
  // index than its parent, so one backwards pass builds every node after its
  // children without recursion.
  const order: Draft[] = []
  const parentOf: number[] = []
  const stack: [Draft, number][] = [...root.children.values()].map((draft) => [draft, -1])
  while (stack.length > 0) {
    const [draft, parent] = stack.pop()!
    const index = order.length
    order.push(draft)
    parentOf.push(parent)
    for (const child of draft.children.values()) stack.push([child, index])
  }

  const built: FileTreeNode[][] = order.map(() => [])
  const roots: FileTreeNode[] = []
  const compact = options.compact !== false
  let fileCount = 0

  for (let index = order.length - 1; index >= 0; index -= 1) {
    const draft = order[index]!
    const children = built[index]!.toSorted(compareNodes)
    let node: FileTreeNode
    const only = children.length === 1 ? children[0]! : undefined
    if (compact && only?.kind === 'directory' && draft.change === undefined) {
      // A folder holding only another folder reads as one row: `src/lib`, not two.
      node = { ...only, name: `${draft.name}/${only.name}` }
    } else if (children.length > 0) {
      node = {
        id: draft.id,
        name: draft.name,
        kind: 'directory',
        ...(draft.change && { change: draft.change }),
        ...(draft.renamedFrom !== undefined && { renamedFrom: draft.renamedFrom }),
        children,
        fileCount: children.reduce((sum, child) => sum + child.fileCount, 0),
      }
    } else {
      fileCount += 1
      node = {
        id: draft.id,
        name: draft.name,
        kind: 'file',
        ...(draft.change && { change: draft.change }),
        ...(draft.renamedFrom !== undefined && { renamedFrom: draft.renamedFrom }),
        ...(draft.additions !== undefined && { additions: draft.additions }),
        ...(draft.deletions !== undefined && { deletions: draft.deletions }),
        children: [],
        fileCount: 1,
      }
    }
    const parent = parentOf[index]!
    if (parent === -1) roots.push(node)
    else built[parent]!.push(node)
  }

  roots.sort(compareNodes)
  return { roots, rejected, duplicates, fileCount }
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

export type FileTreeRow = Readonly<{
  node: FileTreeNode
  /** One-based depth. */
  level: number
  parentId: string | null
  expanded: boolean
}>

/**
 * The rows that are on screen, in reading order. A collapsed folder's subtree
 * is never visited, so toggling a folder in a 5 000-file tree costs the size of
 * what is visible, not of what exists.
 */
export function flattenFileTree(
  roots: readonly FileTreeNode[],
  expanded: ReadonlySet<string>
): FileTreeRow[] {
  const rows: FileTreeRow[] = []
  const stack: [FileTreeNode, number, string | null][] = []
  for (let i = roots.length - 1; i >= 0; i -= 1) stack.push([roots[i]!, 1, null])
  while (stack.length > 0) {
    const [node, level, parentId] = stack.pop()!
    const open = node.kind === 'directory' && expanded.has(node.id)
    rows.push({ node, level, parentId, expanded: open })
    if (open) {
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        stack.push([node.children[i]!, level + 1, node.id])
      }
    }
  }
  return rows
}

/** Every node by id, for turning a row id back into its node. */
export function indexFileTree(roots: readonly FileTreeNode[]): Map<string, FileTreeNode> {
  const index = new Map<string, FileTreeNode>()
  const stack = [...roots]
  while (stack.length > 0) {
    const node = stack.pop()!
    index.set(node.id, node)
    for (const child of node.children) stack.push(child)
  }
  return index
}

export type FileTreeExpansion = boolean | number | readonly string[] | undefined

/** Tree this small opens fully by default; a larger one opens only its top level. */
export const FILE_TREE_AUTO_EXPAND_LIMIT = 100

/**
 * Which folders start open. `true` opens every folder, a number opens folders up
 * to that depth (1 is the top level), a list opens exactly those ids, `false`
 * none. Unset is "auto": everything for a small tree, the top level for a large
 * one, because a tree that opens 5 000 rows is the freeze this exists to avoid.
 */
export function initialExpanded(
  roots: readonly FileTreeNode[],
  spec: FileTreeExpansion,
  fileCount: number
): Set<string> {
  const open = new Set<string>()
  if (Array.isArray(spec)) {
    for (const id of spec) open.add(id)
    return open
  }
  const depth =
    spec === true
      ? Infinity
      : spec === false
        ? 0
        : typeof spec === 'number'
          ? Math.max(0, Math.floor(spec))
          : fileCount <= FILE_TREE_AUTO_EXPAND_LIMIT
            ? Infinity
            : 1
  const stack: [FileTreeNode, number][] = roots.map((node) => [node, 1])
  while (stack.length > 0) {
    const [node, level] = stack.pop()!
    if (node.kind !== 'directory' || level > depth) continue
    open.add(node.id)
    for (const child of node.children) stack.push([child, level + 1])
  }
  return open
}

// ---------------------------------------------------------------------------
// Mounted window
// ---------------------------------------------------------------------------

/** The slice of visible rows that is mounted: `start` inclusive, `end` exclusive. */
export type RowWindow = Readonly<{ start: number; end: number }>

/**
 * A window clamped to what exists, and never narrower than one page when that
 * many rows are there. Rows collapse and files are removed while a window is
 * held, so every read goes through this.
 */
export function clampWindow(window: RowWindow, total: number, page: number): RowWindow {
  if (total <= 0) return { start: 0, end: 0 }
  const start = Math.min(Math.max(0, window.start), total - 1)
  return { start, end: Math.min(total, Math.max(window.end, start + Math.max(1, page))) }
}

/**
 * The window after the keyboard (or typeahead) asks for a row. A row inside the
 * window changes nothing. A row just outside it — an arrow key at the edge — grows
 * the window by one page, so walking the tree costs a page at a time. Anything
 * further is a jump (End, Home, a typed letter): the window moves to the page that
 * holds the row instead of mounting every row between, which is what keeps End on
 * a 5 000-row tree from being a multi-second freeze.
 */
export function revealInWindow(
  window: RowWindow,
  index: number,
  total: number,
  page: number
): RowWindow {
  const current = clampWindow(window, total, page)
  if (index < 0 || index >= total) return current
  if (index >= current.start && index < current.end) return current
  if (index === current.start - 1) {
    return { start: Math.max(0, current.start - page), end: current.end }
  }
  if (index === current.end)
    return { start: current.start, end: Math.min(total, current.end + page) }
  const start = Math.floor(index / page) * page
  return { start, end: Math.min(total, start + page) }
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export type ChangeCounts = Readonly<{
  total: number
  added: number
  modified: number
  deleted: number
  renamed: number
  /** Files with no change kind supplied. */
  unspecified: number
}>

export function countChanges(roots: readonly FileTreeNode[]): ChangeCounts {
  const counts = { total: 0, added: 0, modified: 0, deleted: 0, renamed: 0, unspecified: 0 }
  const stack = [...roots]
  while (stack.length > 0) {
    const node = stack.pop()!
    for (const child of node.children) stack.push(child)
    if (node.kind !== 'file') continue
    counts.total += 1
    if (node.change) counts[node.change] += 1
    else counts.unspecified += 1
  }
  return counts
}

/**
 * The summary in words: "12 files changed: 3 added, 8 modified, 1 deleted". Only
 * kinds that occur are named, and files with no kind are not folded into any of
 * them. Empty is empty, not "0 files changed".
 */
export function describeChanges(counts: ChangeCounts): string {
  if (counts.total === 0) return 'No changed files'
  const parts: string[] = []
  for (const kind of ['added', 'modified', 'deleted', 'renamed'] as const) {
    if (counts[kind] > 0) parts.push(`${counts[kind].toLocaleString()} ${kind}`)
  }
  const noun = counts.total === 1 ? 'file' : 'files'
  const head = `${counts.total.toLocaleString()} ${noun} changed`
  return parts.length > 0 ? `${head}: ${parts.join(', ')}` : head
}

/** The words for a change, which are drawn on the row and so also spoken. */
export const FILE_CHANGE_LABELS: Readonly<Record<FileChangeKind, string>> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
}

// ---------------------------------------------------------------------------
// Typeahead
// ---------------------------------------------------------------------------

/**
 * The row a typed prefix jumps to. One typed letter searches from the row after
 * the active one, so pressing it again cycles; a longer string searches from the
 * active row, so refining a match does not skip past it. Matching ignores case.
 */
export function typeaheadIndex(
  labels: readonly string[],
  activeIndex: number,
  query: string
): number {
  const needle = query.toLowerCase()
  if (needle === '' || labels.length === 0) return -1
  const repeated = needle.length > 1 && [...needle].every((char) => char === needle[0])
  const prefix = repeated ? needle[0]! : needle
  const first = needle.length === 1 || repeated ? activeIndex + 1 : Math.max(0, activeIndex)
  for (let offset = 0; offset < labels.length; offset += 1) {
    const index = (first + offset) % labels.length
    if (labels[index]!.toLowerCase().startsWith(prefix)) return index
  }
  return -1
}
