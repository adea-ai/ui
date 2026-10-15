import { ListTodo } from 'lucide-solid'
import { createMemo, Index, Show, splitProps, type JSX } from 'solid-js'
import { Progress } from '../../ui/progress'
import { TraceDetail, TraceLine, type TraceLineProps } from '../../ui/trace'
import {
  TaskItemList,
  TaskItemRow,
  taskProgress,
  taskProgressLabel,
  type TaskItemStatus,
} from '../task'

// A function child runs once, when the content mounts (see `deferred` in `tool.tsx`).
const deferred = (render: () => JSX.Element) => render as unknown as JSX.Element

/**
 * Plan.
 *
 * What the agent intends to do, as a `TraceLine` that opens onto the steps: a
 * title, an optional description, the steps with their status, how far along
 * they are, and — when the host supplies them — the actions the reader can take
 * (approve, edit, run). Reach for `Task` when the list is a unit of work that is
 * already under way and not a proposal, for `Queue` when it is the agent's
 * running todo list, and for `ChainOfThought` when the steps describe how an
 * answer was reached rather than what will be done.
 *
 * ## It opens by default
 *
 * Unlike a tool call, the plan is the thing being decided or followed, so it
 * starts open (`defaultOpen={false}` folds it). A plan with no steps, no
 * description and no actions is a plain line.
 *
 * ## Progress is derived, in words
 *
 * "2 of 5 steps done" and the bar come from the steps' own `status` and appear
 * only when at least one step has one; a step with no status counts toward the
 * total and not toward "done" (the host did not say it was finished). The bar is
 * the shared `Progress`, which publishes the same phrase to assistive
 * technology, so the number is never only a length.
 *
 * ## Streaming
 *
 * While `streaming` the plan is still being written, so its length is not known
 * and no progress is claimed: the title shimmers, the line says "Drafting", and
 * a caret trails the last step. Finished steps keep their DOM while the last one
 * grows (rows are kept by position).
 *
 * ## The host owns authority
 *
 * `actions` is a slot. The plan neither enables nor disables what is in it, and
 * with no `actions` there are no controls — a plan the reader may not approve
 * simply has no Approve button.
 *
 * A `Plan` is a line: place it inside a `Trace`.
 */
export type PlanStepStatus = TaskItemStatus

export type PlanStep = Readonly<{
  id?: string
  label: string
  description?: string
  status?: PlanStepStatus
}>

export type PlanProps = Omit<
  TraceLineProps,
  'description' | 'href' | 'onSelect' | 'selectHaspopup' | 'children' | 'status' | 'statusLabel'
> & {
  steps: readonly PlanStep[]
  /** What the plan is for, above the steps. */
  description?: JSX.Element
  /** True while the plan is still being generated. */
  streaming?: boolean
  /** Controls for the reader: approve, edit, run. Absent means there are none. */
  actions?: JSX.Element
}

export function Plan(props: PlanProps) {
  const [local, rest] = splitProps(props, [
    'steps',
    'description',
    'streaming',
    'actions',
    'icon',
    'meta',
    'defaultOpen',
  ])
  const progress = createMemo(() => (local.streaming ? undefined : taskProgress(local.steps)))
  const meta = () => {
    if (local.meta !== undefined) return local.meta
    if (local.streaming) return 'Drafting'
    const value = progress()
    return value ? taskProgressLabel(value) : undefined
  }
  const hasDetail = () =>
    local.steps.length > 0 ||
    local.description !== undefined ||
    local.actions !== undefined ||
    local.streaming === true

  const detail = () => (
    <TraceDetail class="flex flex-col gap-2">
      <Show when={local.description}>
        <div class="text-sm text-muted-foreground">{local.description}</div>
      </Show>
      <Show when={progress()}>
        {(value) => (
          <Progress
            value={value().done}
            minValue={0}
            maxValue={Math.max(1, value().total)}
            aria-label="Plan progress"
            getValueLabel={({ value: done, max }) =>
              `${done} of ${max} ${max === 1 ? 'step' : 'steps'} done`
            }
          />
        )}
      </Show>
      <Show when={local.steps.length > 0}>
        <TaskItemList label="Plan steps">
          <Index each={local.steps}>
            {(step) => (
              <TaskItemRow
                text={step().label}
                description={step().description}
                status={step().status}
              />
            )}
          </Index>
        </TaskItemList>
      </Show>
      <Show when={local.streaming}>
        <span class="streaming-caret" aria-hidden="true" />
      </Show>
      <Show when={local.actions}>
        <div data-slot="plan-actions" class="flex flex-wrap items-center gap-2 pt-1">
          {local.actions}
        </div>
      </Show>
    </TraceDetail>
  )

  return (
    <TraceLine
      icon={local.icon ?? <ListTodo />}
      status={local.streaming ? 'running' : undefined}
      statusLabel="Generating"
      meta={meta()}
      defaultOpen={local.defaultOpen ?? true}
      {...rest}
    >
      {hasDetail() ? deferred(detail) : undefined}
    </TraceLine>
  )
}
