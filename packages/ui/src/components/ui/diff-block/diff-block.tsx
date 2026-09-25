import { createMemo, For, Show, splitProps, type ComponentProps, type JSX } from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'

/**
 * DiffBlock.
 *
 * A unified diff, classified and toned. Parsing lives here because the
 * classification is the part that is easy to get subtly wrong and impossible to
 * fix from a caller: whether a line is an addition, a deletion, a hunk header,
 * a file header, or context depends on state — a line beginning with `+++` is a
 * file header *before* the first hunk and an added line beginning with `++`
 * *inside* one — and a renderer that tested prefixes without that state would
 * mis-colour real patches.
 *
 * The line grammar:
 *
 * | Prefix | Meaning |
 * | --- | --- |
 * | `diff --git`, `index`, `---`, `+++` (before a hunk) | file header |
 * | `@@` | hunk header |
 * | `+` | addition |
 * | `-` | deletion |
 * | `\` | the "no newline at end of file" marker |
 * | anything else, including a leading space | context |
 *
 * Tones are pairs of surface and text, so an addition is readable in both
 * polarities and with any accent — the greens and reds are the theme's own
 * `success` and `destructive` at low alpha, not fixed hexes. Colour is never the
 * only signal: the gutter carries `+` or `-` as well, which is what makes the
 * block usable in greyscale and by anyone who cannot separate the two hues.
 *
 * Split (side-by-side) view is deliberately not implemented. It is a different
 * layout algorithm — pairing deletions with additions across hunks — and a
 * half-correct one is worse than none. `view="unified"` is the only value, and
 * the prop exists so that adding the second is not a breaking change.
 */

export type DiffLineKind = 'add' | 'delete' | 'context' | 'hunk' | 'header' | 'meta'

export type DiffLine = Readonly<{
  kind: DiffLineKind
  /** The line without its diff prefix. */
  text: string
  /** The prefix as written: `+`, `-`, a space, or nothing for a header. */
  marker: string
  /** The old-side line number, when the line exists on the old side. */
  oldLine?: number
  /** The new-side line number, when the line exists on the new side. */
  newLine?: number
}>

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/**
 * Classify a unified diff.
 *
 * `headerState` is what makes `---` and `+++` unambiguous: git writes them as
 * file headers before the first `@@` and as content after it, and the two need
 * different tones. `oldLine`/`newLine` are tracked so the gutter can number both
 * sides — the numbers a reader uses to find the change in their editor.
 */
export function parseDiff(patch: string): readonly DiffLine[] {
  const lines: DiffLine[] = []
  let inHunk = false
  let oldLine = 0
  let newLine = 0

  for (const raw of patch.replace(/\n$/, '').split('\n')) {
    if (HUNK_HEADER.test(raw)) {
      const match = HUNK_HEADER.exec(raw)!
      oldLine = Number(match[1])
      newLine = Number(match[2])
      inHunk = true
      lines.push({ kind: 'hunk', text: raw, marker: '' })
      continue
    }

    if (!inHunk) {
      const isFileHeader =
        raw.startsWith('diff --git') ||
        raw.startsWith('index ') ||
        raw.startsWith('new file') ||
        raw.startsWith('deleted file') ||
        raw.startsWith('similarity index') ||
        raw.startsWith('rename ') ||
        raw.startsWith('--- ') ||
        raw.startsWith('+++ ')
      lines.push({ kind: isFileHeader ? 'header' : 'meta', text: raw, marker: '' })
      continue
    }

    if (raw.startsWith('\\')) {
      lines.push({ kind: 'meta', text: raw, marker: '' })
      continue
    }

    const marker = raw[0] ?? ' '
    if (marker === '+') {
      lines.push({ kind: 'add', text: raw.slice(1), marker, newLine })
      newLine += 1
    } else if (marker === '-') {
      lines.push({ kind: 'delete', text: raw.slice(1), marker, oldLine })
      oldLine += 1
    } else {
      lines.push({ kind: 'context', text: raw.slice(1), marker: ' ', oldLine, newLine })
      oldLine += 1
      newLine += 1
    }
  }

  return lines
}

/**
 * Whether a line gets gutter numbers. A hunk header and a file header are
 * structural, so numbering them would put a number on a line that has none.
 */
function numbered(line: DiffLine, show: boolean | undefined): boolean {
  return Boolean(show) && line.kind !== 'hunk' && line.kind !== 'header' && line.kind !== 'meta'
}

/** The counts a diff summary reports: how much was added and removed. */
export function diffStats(
  lines: readonly DiffLine[]
): Readonly<{ added: number; removed: number }> {
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.kind === 'add') added += 1
    else if (line.kind === 'delete') removed += 1
  }
  return { added, removed }
}

/**
 * The target path from a unified diff's file header. Prefers `+++ b/<path>` —
 * git's explicit new-side marker — and skips `/dev/null`, which marks an added
 * or deleted side rather than naming a file. Only lines outside a hunk are
 * considered, for the same reason the parser tracks state.
 */
export function diffTargetPath(patch: string): string | null {
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) break
    const git = /^\+\+\+ b\/(.+?)(?:\t|$)/.exec(line)
    if (git) return git[1]!
    const plain = /^\+\+\+ ([^\s/][^\t]*?)(?:\t|$)/.exec(line)
    if (plain && plain[1] !== '/dev/null') return plain[1]!
    const fromHeader = /^diff --git a\/.+ b\/(.+)/.exec(line)
    if (fromHeader) return fromHeader[1]!
  }
  return null
}

export const diffLineVariants = cva('flex items-baseline font-mono text-xs', {
  variants: {
    kind: {
      add: 'bg-success-subtle text-foreground',
      delete: 'bg-destructive-subtle text-foreground',
      context: 'text-foreground',
      hunk: 'bg-muted text-muted-foreground',
      header: 'bg-muted font-semibold text-foreground',
      meta: 'text-muted-foreground italic',
    },
  },
  defaultVariants: { kind: 'context' },
})

export type DiffBlockProps = Omit<ComponentProps<'div'>, 'children'> &
  VariantProps<typeof diffLineVariants> & {
    /** The unified diff. */
    patch: string
    /** A filename. Defaults to the path in the patch's header, or "diff". */
    title?: string
    /** False while the patch is still streaming. */
    complete?: boolean
    /** Show the two line-number gutters. Off for a fragment with no line numbers. */
    showLineNumbers?: boolean
    /** Extra header controls. */
    actions?: JSX.Element
  }

export function DiffBlock(props: DiffBlockProps) {
  const [local, rest] = splitProps(props, [
    'patch',
    'title',
    'complete',
    'showLineNumbers',
    'actions',
    'class',
  ])

  const lines = createMemo(() => parseDiff(local.patch))
  const stats = createMemo(() => diffStats(lines()))
  const name = () => local.title ?? diffTargetPath(local.patch)?.split('/').pop() ?? 'diff'

  return (
    <div
      class={cn('overflow-hidden rounded-xl border border-border bg-card', local.class)}
      {...rest}
    >
      <div class="flex items-center justify-between gap-2 border-b border-border px-3 py-1">
        <span class="flex min-w-0 items-baseline gap-2">
          <span class="truncate font-mono text-xs text-foreground">{name()}</span>
          {/* The counts are text, so the summary survives greyscale and a reader
              who cannot separate the two line tones still gets the shape of it. */}
          <span class="shrink-0 font-mono text-2xs text-muted-foreground">
            <span class="text-success">+{stats().added}</span>{' '}
            <span class="text-destructive">−{stats().removed}</span>
          </span>
        </span>
        {local.actions}
      </div>
      <div
        class="scroll-fade overflow-x-auto"
        tabindex="0"
        role="region"
        aria-label={`Diff for ${name()}`}
      >
        <div class="min-w-fit">
          <For each={lines()}>
            {(line) => (
              <div class={diffLineVariants({ kind: line.kind })}>
                <Show when={numbered(line, local.showLineNumbers)}>
                  <span
                    class="w-10 shrink-0 pr-2 text-right text-2xs text-muted-foreground tabular-nums select-none"
                    aria-hidden="true"
                  >
                    {line.oldLine ?? ''}
                  </span>
                  <span
                    class="w-10 shrink-0 pr-2 text-right text-2xs text-muted-foreground tabular-nums select-none"
                    aria-hidden="true"
                  >
                    {line.newLine ?? ''}
                  </span>
                </Show>
                {/* The marker is the signal that is not a colour. */}
                <span class="w-4 shrink-0 text-center select-none" aria-hidden="true">
                  {line.kind === 'add' ? '+' : line.kind === 'delete' ? '−' : ''}
                </span>
                <span class="min-w-0 whitespace-pre pr-4">
                  {/* A screen reader gets the kind as a word, not a glyph. */}
                  <span class="visually-hidden">
                    {line.kind === 'add' ? 'Added: ' : line.kind === 'delete' ? 'Removed: ' : ''}
                  </span>
                  {line.text || ' '}
                </span>
              </div>
            )}
          </For>
        </div>
        <Show when={!local.complete}>
          <p class="px-3 py-1 text-xs text-muted-foreground italic">Generating diff…</p>
        </Show>
      </div>
    </div>
  )
}

/**
 * A diff summary line, for a list of changes rather than one patch: the file and
 * its counts. Uses `CodeBlock`'s height rules and nothing else, because a summary
 * is a row and not a surface.
 */
export function DiffSummary(props: { patch: string; class?: string; onSelect?: () => void }) {
  const stats = createMemo(() => diffStats(parseDiff(props.patch)))
  const name = () => diffTargetPath(props.patch) ?? 'diff'

  return (
    <button
      type="button"
      class={cn(
        'flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1 text-left font-mono text-xs hover:bg-muted',
        props.class
      )}
      onClick={() => props.onSelect?.()}
    >
      <span class="truncate text-foreground">{name()}</span>
      <span class="shrink-0 text-2xs">
        <span class="text-success">+{stats().added}</span>{' '}
        <span class="text-destructive">−{stats().removed}</span>
      </span>
    </button>
  )
}
