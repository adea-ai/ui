import { Bot } from 'lucide-solid'
import { children as resolveChildren, Show, splitProps, type JSX } from 'solid-js'
import { CodeBlock } from '../../ui/code-block'
import { ScrollArea } from '../../ui/scroll-area'
import {
  Trace,
  TraceDetail,
  TraceLine,
  type TraceLineProps,
  type TraceStatus,
} from '../../ui/trace'
import { formatDuration } from '../reasoning'

// A function child runs once, when the content mounts (see `deferred` in `tool.tsx`).
const deferred = (render: () => JSX.Element) => render as unknown as JSX.Element

/**
 * Subagent.
 *
 * Another agent the main one handed work to, as a `TraceLine`: its name, the task
 * it was given, its status, and — folded away — everything it did. The body is a
 * nested `Trace`, so a subagent's tool calls, reasoning and own subagents are the
 * same lines as the parent's, one level in; nothing about "a run inside a run"
 * needs a new visual. Reach for `Tool` when the call has an input and an output
 * and no steps of its own, and for `Task` when the items are a statement of work
 * rather than a record of what ran.
 *
 * ## The collapsed line is the summary
 *
 * Folded, the line carries what a reader scanning the turn needs: the name, the
 * task, the status, and — in the trailing text — the model, the number of steps
 * and how long it took. Each of those appears only when known: `model` and
 * `duration` are the host's, and the step count is the number of lines passed as
 * `children` unless the host knows better (`stepCount`, for a run whose earlier
 * steps are not loaded). No count is shown for a run with no steps.
 *
 * ## Result and failure
 *
 * `result` is a slot for the answer the subagent returned — usually prose or a
 * `CodeBlock` — below its steps, labelled "Result". `errorText` is a failure as
 * text. Neither is invented: a subagent that finished without a result shows
 * none, and one with no steps, result or error yet is a plain line (there is
 * nothing to open; the line becomes a disclosure when its first step arrives).
 *
 * A `Subagent` is a line: place it inside a `Trace`, and its `children` are
 * `TraceLine`s.
 */
export type SubagentProps = Omit<
  TraceLineProps,
  'title' | 'description' | 'href' | 'onSelect' | 'selectHaspopup' | 'meta'
> & {
  /** The subagent's name. Rendered as text. */
  name: string
  /** The task it was given, on the line. */
  task?: JSX.Element
  status?: TraceStatus
  /** A model label, e.g. `sonnet-5`. Rendered as text. */
  model?: string
  /** Seconds the run took, if the host measured it. */
  duration?: number
  /** Overrides the count taken from `children`. */
  stepCount?: number
  /** What the subagent returned. */
  result?: JSX.Element
  errorText?: string
  /** Trailing text appended after the derived summary. */
  meta?: JSX.Element
}

/** `3 steps`, `1 step`. */
export function stepCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'step' : 'steps'}`
}

export function Subagent(props: SubagentProps) {
  const [local, rest] = splitProps(props, [
    'name',
    'task',
    'status',
    'model',
    'duration',
    'stepCount',
    'result',
    'errorText',
    'icon',
    'meta',
    'children',
  ])
  // Resolved once: the steps are created once and keep their own state (an open
  // tool call, a scrolled output) while the run is folded and unfolded.
  const steps = resolveChildren(() => local.children)
  const count = () => local.stepCount ?? steps.toArray().length
  const hasError = () => local.errorText !== undefined && local.errorText !== ''
  const hasResult = () => local.result !== undefined && local.result !== null
  const hasDetail = () => steps.toArray().length > 0 || hasResult() || hasError()

  const summary = () => {
    const parts = [
      local.model,
      count() > 0 ? stepCountLabel(count()) : undefined,
      formatDuration(local.duration),
    ].filter((part): part is string => part !== undefined && part !== '')
    return parts.length > 0 ? parts.join(' · ') : undefined
  }

  // A model label is host text and may be long; it must not widen the line.
  const meta = () =>
    summary() || local.meta ? (
      <>
        <Show when={summary()}>
          <span class="inline-block max-w-72 truncate align-bottom">{summary()}</span>
        </Show>
        {local.meta}
      </>
    ) : undefined

  const detail = () => (
    <TraceDetail class="flex flex-col gap-2">
      <Show when={steps.toArray().length > 0}>
        <Trace size="sm" aria-label={`${local.name} steps`}>
          {steps()}
        </Trace>
      </Show>
      <Show when={hasError()}>
        <CodeBlock
          size="sm"
          title="Error"
          language="error"
          code={local.errorText ?? ''}
          lineMarks={{ 1: 'error' }}
          complete
          maxHeight="12rem"
          wrap
        />
      </Show>
      <Show when={hasResult()}>
        <div class="flex min-w-0 flex-col gap-1">
          <p class="m-0 font-medium text-foreground">Result</p>
          <ScrollArea role="region" aria-label={`${local.name} result`} class="max-h-72">
            {local.result}
          </ScrollArea>
        </div>
      </Show>
    </TraceDetail>
  )

  return (
    <TraceLine
      icon={local.icon ?? <Bot />}
      title={local.name}
      description={local.task}
      status={local.status}
      meta={meta()}
      {...rest}
    >
      {hasDetail() ? deferred(detail) : undefined}
    </TraceLine>
  )
}
