import { ListOrdered } from 'lucide-solid'
import { children as resolveChildren, splitProps, type ComponentProps, type JSX } from 'solid-js'
import { cn } from '#lib/utils'
import { Badge } from '../../ui/badge'
import { Trace, TraceLine, type TraceLineProps, type TraceStatus } from '../../ui/trace'

// A function child runs once, when the content mounts (see `deferred` in `tool.tsx`).
const deferred = (render: () => JSX.Element) => render as unknown as JSX.Element

/**
 * ChainOfThought.
 *
 * A summary line that opens onto the steps behind it: "Searched 3 sources and
 * compared them", then each source and each comparison as its own line. Reach for
 * `Reasoning` when the thinking is prose, for `Plan` when the steps are a
 * proposal still to be carried out, and for a plain `Trace` when each line is a
 * tool call — a step here is a statement about the agent's *method*, whatever
 * the host chooses to put in it.
 *
 * Nothing here knows how the steps were produced. The host passes the summary and
 * the steps it wants shown; the component does not imply there is more, and a
 * summary with no steps is a plain line.
 *
 * ## Steps
 *
 * A `ChainOfThoughtStep` is a `TraceLine` with a three-state `status` — `complete`
 * (keeps its own icon, or a tick), `active` (running mark and shimmer) and
 * `pending` (dashed mark). Every status is also spoken. A step without a status
 * makes no claim at all. A step's `children` are its evidence — search-result
 * badges, a snippet — and are open by default: someone who unfolded the summary
 * to see the working wants to see what the working found, and one more click per
 * step to read it defeats the point of the summary.
 *
 * `description` is a single truncated row beside the label. Anything longer
 * belongs in `children`.
 *
 * Both parts are lines: put a `ChainOfThought` inside a `Trace`, next to the
 * other activity of the turn.
 */
export type ChainOfThoughtStepStatus = 'complete' | 'active' | 'pending'

/** The words spoken for each step status. */
export const CHAIN_OF_THOUGHT_STATUS_LABELS: Readonly<Record<ChainOfThoughtStepStatus, string>> = {
  complete: 'Done',
  active: 'In progress',
  pending: 'Pending',
}

const TRACE_STATUS: Readonly<Record<ChainOfThoughtStepStatus, TraceStatus>> = {
  complete: 'success',
  active: 'running',
  pending: 'pending',
}

export type ChainOfThoughtProps = Omit<
  TraceLineProps,
  'title' | 'href' | 'onSelect' | 'selectHaspopup'
> & {
  /** The one-line account of what the steps add up to. */
  summary?: JSX.Element
  /** The steps' accessible name. */
  stepsLabel?: string
}

export function ChainOfThought(props: ChainOfThoughtProps) {
  const [local, rest] = splitProps(props, ['summary', 'stepsLabel', 'icon', 'children'])
  // Resolved once so the steps are created once: a step keeps its own open state
  // and its DOM while the summary is folded and unfolded.
  const steps = resolveChildren(() => local.children)
  const hasSteps = () => steps.toArray().length > 0
  // A function child runs only when the content mounts, and once.
  const stepList = () => (
    <Trace size="sm" aria-label={local.stepsLabel ?? 'Steps'}>
      {steps()}
    </Trace>
  )

  return (
    <TraceLine icon={local.icon ?? <ListOrdered />} title={local.summary ?? 'Steps'} {...rest}>
      {hasSteps() ? deferred(stepList) : undefined}
    </TraceLine>
  )
}

export type ChainOfThoughtStepProps = Omit<
  TraceLineProps,
  'title' | 'status' | 'href' | 'onSelect' | 'selectHaspopup'
> & {
  label: JSX.Element
  status?: ChainOfThoughtStepStatus
}

export function ChainOfThoughtStep(props: ChainOfThoughtStepProps) {
  const [local, rest] = splitProps(props, ['label', 'status', 'statusLabel', 'defaultOpen'])
  return (
    <TraceLine
      title={local.label}
      status={local.status ? TRACE_STATUS[local.status] : undefined}
      statusLabel={
        local.status
          ? (local.statusLabel ?? CHAIN_OF_THOUGHT_STATUS_LABELS[local.status])
          : undefined
      }
      defaultOpen={local.defaultOpen ?? true}
      {...rest}
    />
  )
}

/** Evidence for a step: the sources it searched, as a wrapping row of badges. */
export function ChainOfThoughtResults(props: ComponentProps<'ul'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <ul
      role="list"
      data-slot="chain-of-thought-results"
      class={cn('m-0 flex min-w-0 list-none flex-wrap gap-1.5 p-0', local.class)}
      {...rest}
    >
      {local.children}
    </ul>
  )
}

export type ChainOfThoughtResultProps = Omit<ComponentProps<'li'>, 'children'> & {
  /** Rendered as text. A long label truncates and keeps its full text in `title`. */
  label: string
  icon?: JSX.Element
}

export function ChainOfThoughtResult(props: ChainOfThoughtResultProps) {
  const [local, rest] = splitProps(props, ['class', 'label', 'icon'])
  return (
    <li data-slot="chain-of-thought-result" class={cn('min-w-0 max-w-full', local.class)} {...rest}>
      <Badge variant="outline" class="max-w-full min-w-0" title={local.label}>
        {local.icon}
        <span class="truncate">{local.label}</span>
      </Badge>
    </li>
  )
}
