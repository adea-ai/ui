import { CornerDownRight, ListChecks, ListTodo, MessageSquarePlus, X } from 'lucide-solid'
import {
  createMemo,
  Index,
  onCleanup,
  Show,
  splitProps,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { Button } from '../../ui/button'
import { Trace, TraceLine } from '../../ui/trace'
import { TaskItemList, TaskItemRow } from '../task'

// A function child runs once, when the content mounts (see `deferred` in `tool.tsx`).
const deferred = (render: () => JSX.Element) => render as unknown as JSX.Element

/**
 * Queue.
 *
 * The agent's todo list, split the way a reader asks about it: what is still to
 * do, and what is already done. Two collapsible sections with their counts,
 * "Pending" open and "Completed" folded — the finished work is the record, the
 * pending work is the question. Reach for `Plan` when the list is a proposal
 * awaiting a decision, for `Task` when it is one piece of work with files
 * attached, and for `QueueFollowUps` (below) when the things waiting are
 * *messages from the person*, not work the agent set itself.
 *
 * ## Sorting is the host's statement, not ours
 *
 * An item is in the Completed section only if its `status` is `complete`.
 * Everything else — `pending`, `active`, or no status at all — is still to do,
 * which is what "not marked done" means; the mark shown matches (an item with
 * no status gets the pending mark, because it is in the Pending section). An
 * empty section is not drawn: "Completed (0)" is noise, and a list with nothing
 * in either section renders nothing, or the `empty` content if the host gave
 * some, rather than a heading over a void.
 *
 * ## Bounded
 *
 * Each section scrolls inside a capped, keyboard-focusable region, and rows are
 * kept by position, so a list of two hundred items does not push the answer out
 * of view and a status change updates a row instead of recreating it. Item text
 * wraps to three lines and is clamped (see `Task`).
 *
 * A `Queue` is a block (its own `Trace`) and can sit between other parts of a
 * turn.
 */
export type QueueItemStatus = 'pending' | 'active' | 'complete'

export type QueueItem = Readonly<{
  id?: string
  text: string
  description?: string
  status?: QueueItemStatus
}>

/** Split a todo list into the two sections. Order is preserved within each. */
export function partitionQueue(items: readonly QueueItem[]): Readonly<{
  pending: readonly QueueItem[]
  completed: readonly QueueItem[]
}> {
  return {
    pending: items.filter((item) => item.status !== 'complete'),
    completed: items.filter((item) => item.status === 'complete'),
  }
}

function itemCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`
}

/** The count, shown as a number and spoken as a phrase. */
function Count(props: { count: number; noun?: string }) {
  return (
    <>
      <span aria-hidden="true">{props.count}</span>
      <span class="sr-only">{props.noun ?? itemCount(props.count)}</span>
    </>
  )
}

export type QueueProps = Omit<ComponentProps<typeof Trace>, 'children'> & {
  items: readonly QueueItem[]
  pendingLabel?: string
  completedLabel?: string
  /** Shown when there is nothing in either section. Omit to draw nothing. */
  empty?: JSX.Element
  /** Open the Completed section initially. */
  defaultCompletedOpen?: boolean
}

export function Queue(props: QueueProps) {
  const [local, rest] = splitProps(props, [
    'items',
    'pendingLabel',
    'completedLabel',
    'empty',
    'defaultCompletedOpen',
  ])
  const sections = createMemo(() => partitionQueue(local.items))
  const pending = () => sections().pending
  const completed = () => sections().completed
  const pendingLabel = () => local.pendingLabel ?? 'Pending'
  const completedLabel = () => local.completedLabel ?? 'Completed'

  return (
    <Show
      when={local.items.length > 0}
      fallback={
        <Show when={local.empty}>
          <Trace aria-label="Queue" {...rest}>
            <TraceLine title={local.empty} />
          </Trace>
        </Show>
      }
    >
      <Trace aria-label="Queue" {...rest}>
        <Show when={pending().length > 0}>
          <TraceLine
            icon={<ListTodo />}
            title={pendingLabel()}
            meta={<Count count={pending().length} />}
            defaultOpen
          >
            {deferred(() => (
              <TaskItemList label={pendingLabel()}>
                <Index each={pending()}>
                  {(item) => (
                    <TaskItemRow
                      text={item().text}
                      description={item().description}
                      status={item().status ?? 'pending'}
                    />
                  )}
                </Index>
              </TaskItemList>
            ))}
          </TraceLine>
        </Show>
        <Show when={completed().length > 0}>
          <TraceLine
            icon={<ListChecks />}
            title={completedLabel()}
            meta={<Count count={completed().length} />}
            defaultOpen={local.defaultCompletedOpen ?? false}
          >
            {deferred(() => (
              <TaskItemList label={completedLabel()}>
                <Index each={completed()}>
                  {(item) => (
                    <TaskItemRow
                      text={item().text}
                      description={item().description}
                      status="complete"
                    />
                  )}
                </Index>
              </TaskItemList>
            ))}
          </TraceLine>
        </Show>
      </Trace>
    </Show>
  )
}

export type QueueFollowUp = Readonly<{
  id?: string
  text: string
  /** Removes it from the queue. Omit it and the row has no remove control. */
  onRemove?: () => void
}>

const REMOVE_LABEL_CHARS = 60

function FollowUpRow(props: { item: QueueFollowUp }) {
  let remove: HTMLButtonElement | undefined

  // Rows are kept by position, so removing a middle row leaves the focused
  // button where it is (now on the next message). Only the last row is ever
  // disposed under focus; hand focus to the one before it rather than to `body`.
  onCleanup(() => {
    if (!remove || document.activeElement !== remove) return
    const buttons = remove
      .closest('ul')
      ?.querySelectorAll<HTMLButtonElement>('button[data-slot="queue-follow-up-remove"]')
    const previous = Array.from(buttons ?? []).filter((button) => button !== remove)
    previous.at(-1)?.focus()
  })

  const text = () =>
    props.item.text.length > 1_000 ? `${props.item.text.slice(0, 1_000)}…` : props.item.text
  const label = () =>
    props.item.text.length > REMOVE_LABEL_CHARS
      ? `${props.item.text.slice(0, REMOVE_LABEL_CHARS)}…`
      : props.item.text

  return (
    <li data-slot="queue-follow-up" class="flex min-w-0 items-start gap-2 rounded-md px-1.5 py-0.5">
      <CornerDownRight aria-hidden="true" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <p
        title={text()}
        class="m-0 line-clamp-3 min-w-0 flex-1 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground"
      >
        {text()}
      </p>
      <Show when={props.item.onRemove}>
        {(onRemove) => (
          <Button
            ref={(element) => (remove = element)}
            data-slot="queue-follow-up-remove"
            type="button"
            variant="ghost"
            size="icon-2xs"
            class="shrink-0"
            aria-label={`Remove queued message: ${label()}`}
            onClick={() => onRemove()()}
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </Show>
    </li>
  )
}

export type QueueFollowUpsProps = Omit<ComponentProps<typeof Trace>, 'children'> & {
  items: readonly QueueFollowUp[]
  /** The section's title. */
  title?: string
  defaultOpen?: boolean
}

/**
 * Follow-up messages the person sent that have not been delivered yet. They are
 * the person's words, so they are shown as sent (wrapped, clamped to three
 * lines) rather than as work. The remove control exists per message only when
 * that message carries `onRemove`: whether it may still be withdrawn is the
 * runtime's to say, and a message past recall simply has no button. With no
 * messages the component draws nothing.
 */
export function QueueFollowUps(props: QueueFollowUpsProps) {
  const [local, rest] = splitProps(props, ['items', 'title', 'defaultOpen'])
  const title = () => local.title ?? 'Queued follow-ups'
  return (
    <Show when={local.items.length > 0}>
      <Trace aria-label={title()} {...rest}>
        <TraceLine
          icon={<MessageSquarePlus />}
          title={title()}
          meta={<Count count={local.items.length} noun={`${local.items.length} waiting`} />}
          defaultOpen={local.defaultOpen ?? true}
        >
          {deferred(() => (
            <TaskItemList label={title()}>
              <Index each={local.items}>{(item) => <FollowUpRow item={item()} />}</Index>
            </TaskItemList>
          ))}
        </TraceLine>
      </Trace>
    </Show>
  )
}
