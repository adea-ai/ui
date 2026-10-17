import {
  Check,
  CircleAlert,
  CircleDashed,
  CircleSlash,
  ListChecks,
  LoaderCircle,
} from 'lucide-solid'
import {
  createMemo,
  createSignal,
  For,
  Index,
  Show,
  splitProps,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { cn } from '../../../lib/utils'
import { Attachment, AttachmentList, type AttachmentKind } from '../../ui/attachment'
import { Button } from '../../ui/button'
import { ScrollArea } from '../../ui/scroll-area'
import { TraceLine, type TraceLineProps } from '../../ui/trace'

// A function child runs once, when the content mounts (see `deferred` in `tool.tsx`).
const deferred = (render: () => JSX.Element) => render as unknown as JSX.Element

/**
 * Task.
 *
 * One piece of work the agent is doing, as a `TraceLine` that opens onto its
 * items: a title, then a list in which each item is a sentence, optionally a
 * status, and optionally the files it touched. Reach for `Plan` when the list is
 * a proposal the person approves, for `Queue` when it is the agent's running
 * todo list, and for a `Trace` of tool calls when the items are things that
 * *ran* — a Task item is a statement about work, not a record of a call.
 *
 * ## Items wrap; lines do not
 *
 * A `TraceLine` truncates its title to one row, which is right for "Read
 * src/app.tsx" and wrong for "Backfill locale from profile.language, falling
 * back to en". Items are therefore their own rows with the same mark and colour
 * vocabulary as a Trace line but wrapping text, clamped to three lines so a
 * pasted paragraph cannot take the column. `TaskItemRow` and `TaskItemList` are
 * exported because `Plan` and `Queue` are built from them.
 *
 * ## Status is a claim
 *
 * An item shows a mark and speaks a word only when the host supplied `status`.
 * The "2 of 4 done" in the header is derived from those statuses and appears
 * only if at least one item has one; items without a status are counted in the
 * total and not in "done" (see `taskProgress`). A task with no items is a plain
 * line: there is nothing to open, and an empty disclosure is a control that
 * does nothing.
 *
 * ## Files are untrusted metadata
 *
 * File chips are `Attachment` chips with no handlers, so they are text: a name
 * is never a link or a path. Past six, the rest sit behind one toggle button
 * whose label changes in place, so keyboard focus survives opening and closing
 * it.
 */
export type TaskItemStatus = 'complete' | 'active' | 'pending' | 'failed' | 'skipped'

export type TaskFile = Readonly<{
  name: string
  kind?: AttachmentKind
  /** Bytes. */
  size?: number
}>

export type TaskItem = Readonly<{
  /** Only needed for the host's own bookkeeping; rows are kept by position. */
  id?: string
  text: string
  description?: string
  status?: TaskItemStatus
  files?: readonly TaskFile[]
}>

/** The words spoken for each item status. */
export const TASK_ITEM_STATUS_LABELS: Readonly<Record<TaskItemStatus, string>> = {
  complete: 'Completed',
  active: 'In progress',
  pending: 'Pending',
  failed: 'Failed',
  skipped: 'Skipped',
}

/** Visible files per item before the rest go behind a toggle. */
const VISIBLE_FILES = 6
/** Characters of item text kept; the rest of a pasted wall is not a todo. */
const MAX_TEXT = 1_000

function bound(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * How many items are done, or nothing at all when no item carries a status.
 * Items without a status count toward the total: the host did not say they were
 * finished, so they are not.
 */
export function taskProgress(
  items: readonly Pick<TaskItem, 'status'>[]
): Readonly<{ done: number; total: number }> | undefined {
  if (!items.some((item) => item.status !== undefined)) return undefined
  return {
    done: items.filter((item) => item.status === 'complete').length,
    total: items.length,
  }
}

/** `2 of 4 done`, in words. */
export function taskProgressLabel(progress: { done: number; total: number }): string {
  return `${progress.done} of ${progress.total} done`
}

function ItemMark(props: { status?: TaskItemStatus }) {
  return (
    <span
      aria-hidden="true"
      data-slot="task-item-mark"
      class={cn('mt-0.5 grid size-4 shrink-0 place-items-center [&_svg]:size-3.5', {
        'text-muted-foreground': props.status !== 'active' && props.status !== 'failed',
        'text-info': props.status === 'active',
        'text-destructive': props.status === 'failed',
      })}
    >
      <Show
        when={props.status}
        fallback={<span class="size-1 rounded-full bg-muted-foreground/60" />}
      >
        {(status) => (
          <>
            <Show when={status() === 'complete'}>
              <Check />
            </Show>
            <Show when={status() === 'active'}>
              <LoaderCircle class="motion-safe:animate-spin" />
            </Show>
            <Show when={status() === 'pending'}>
              <CircleDashed />
            </Show>
            <Show when={status() === 'failed'}>
              <CircleAlert />
            </Show>
            <Show when={status() === 'skipped'}>
              <CircleSlash />
            </Show>
          </>
        )}
      </Show>
    </span>
  )
}

export type TaskItemRowProps = Omit<ComponentProps<'li'>, 'children'> & {
  text: string
  description?: string
  status?: TaskItemStatus
  files?: readonly TaskFile[]
  /** Spoken in place of the default status word. */
  statusLabel?: string
}

export function TaskItemRow(props: TaskItemRowProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'text',
    'description',
    'status',
    'files',
    'statusLabel',
  ])
  const [showAllFiles, setShowAllFiles] = createSignal(false)
  const files = () => local.files ?? []
  const shownFiles = () => (showAllFiles() ? files() : files().slice(0, VISIBLE_FILES))
  const hiddenFiles = () => files().length - VISIBLE_FILES
  const text = () => bound(local.text, MAX_TEXT)

  return (
    <li
      data-slot="task-item"
      data-status={local.status}
      class={cn('flex min-w-0 gap-2 rounded-md px-1.5 py-0.5', local.class)}
      {...rest}
    >
      <ItemMark status={local.status} />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <p
          title={text()}
          class={cn(
            'm-0 line-clamp-3 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground',
            {
              'text-muted-foreground': local.status === 'complete' || local.status === 'skipped',
              'text-destructive': local.status === 'failed',
            }
          )}
        >
          {text()}
          <Show when={local.status}>
            {(status) => (
              <span class="sr-only"> {local.statusLabel ?? TASK_ITEM_STATUS_LABELS[status()]}</span>
            )}
          </Show>
        </p>
        <Show when={local.description}>
          {(description) => (
            <p class="m-0 line-clamp-3 text-xs [overflow-wrap:anywhere] text-muted-foreground/80">
              {bound(description(), MAX_TEXT)}
            </p>
          )}
        </Show>
        <Show when={files().length > 0}>
          <AttachmentList aria-label="Files" class="gap-1">
            <For each={shownFiles()}>
              {(file) => (
                <li class="min-w-0 max-w-full">
                  <Attachment variant="chip" name={file.name} kind={file.kind} size={file.size} />
                </li>
              )}
            </For>
            <Show when={hiddenFiles() > 0}>
              <li class="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="2xs"
                  aria-expanded={showAllFiles()}
                  onClick={() => setShowAllFiles((value) => !value)}
                >
                  {showAllFiles() ? 'Show fewer files' : `Show ${hiddenFiles()} more files`}
                </Button>
              </li>
            </Show>
          </AttachmentList>
        </Show>
      </div>
    </li>
  )
}

export type TaskItemListProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** The list's accessible name. A scrolling region without one is an unlabelled tab stop. */
  label: string
  children?: JSX.Element
}

/**
 * The items, bounded. Two hundred todo items must scroll inside their line and
 * not push the answer out of view; the region is keyboard-focusable and named,
 * which is what makes the overflow reachable without a pointer.
 */
export function TaskItemList(props: TaskItemListProps) {
  const [local, rest] = splitProps(props, ['class', 'label', 'children'])
  return (
    <ScrollArea
      role="region"
      aria-label={local.label}
      class={cn('max-h-72', local.class)}
      {...rest}
    >
      <ul role="list" class="m-0 flex list-none flex-col gap-0.5 p-0">
        {local.children}
      </ul>
    </ScrollArea>
  )
}

export type TaskProps = Omit<
  TraceLineProps,
  'description' | 'href' | 'onSelect' | 'selectHaspopup' | 'children'
> & {
  items: readonly TaskItem[]
  /** The item list's accessible name. Defaults to the title when it is a string. */
  itemsLabel?: string
}

export function Task(props: TaskProps) {
  const [local, rest] = splitProps(props, ['items', 'itemsLabel', 'icon', 'meta', 'title'])
  const progress = createMemo(() => taskProgress(local.items))
  const derivedMeta = () => {
    const value = progress()
    return value ? taskProgressLabel(value) : undefined
  }
  const label = () =>
    local.itemsLabel ?? (typeof local.title === 'string' ? `${local.title} items` : 'Task items')

  // A function child is only run when the content mounts, so a collapsed task
  // with hundreds of items renders none of them.
  const list = () => (
    <TaskItemList label={label()}>
      <Index each={local.items}>
        {(item) => (
          <TaskItemRow
            text={item().text}
            description={item().description}
            status={item().status}
            files={item().files}
          />
        )}
      </Index>
    </TaskItemList>
  )

  return (
    <TraceLine
      icon={local.icon ?? <ListChecks />}
      title={local.title}
      meta={local.meta ?? derivedMeta()}
      {...rest}
    >
      {local.items.length > 0 ? deferred(list) : undefined}
    </TraceLine>
  )
}
