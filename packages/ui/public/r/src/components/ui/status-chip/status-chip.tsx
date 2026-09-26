import { Show, splitProps, type ComponentProps, type JSX } from 'solid-js'
import { cva } from '../../../lib/variants'
import { cn } from '../../../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip'

/**
 * StatusChip.
 *
 * A state, said in one word, with the reason available on hover. It exists
 * because a status readout has three parts that are always the same three parts —
 * a tone, a label, and the detail that justifies the label — and rendering them
 * ad hoc produces the two failures this component is here to prevent: a colour
 * with no text (unreadable to anyone who cannot see it) and a bare word with no
 * explanation ("Needs configuration" — of what?).
 *
 * The tones are deliberately not a rainbow. Six cover what a status can actually
 * mean:
 *
 * - `neutral` — fine, and there is nothing to say about it.
 * - `success` — a check passed, a capability is ready, a job finished.
 * - `warning` — degraded, or needs a decision from the user.
 * - `danger` — blocked, failed, unrecoverable without intervention.
 * - `info` — in flight or scheduled; work is happening, nothing is wrong.
 * - `unknown` — the honest absence of information.
 *
 * `unknown` is not the same as `neutral`, and collapsing them is the mistake
 * worth avoiding: "this is idle" and "we have not been told yet" are different
 * facts, and a product that shows the second as the first is lying quietly. The
 * ring is hollow so it also reads as different in greyscale.
 *
 * The dot is `aria-hidden` and the label carries the meaning, so a tone is never
 * the only signal.
 */
export const statusDotVariants = cva('size-2 shrink-0 rounded-full', {
  variants: {
    tone: {
      neutral: 'bg-muted-foreground',
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-destructive',
      info: 'bg-info',
      unknown: 'border border-muted-foreground bg-transparent',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

const labelTone: Record<StatusTone, string> = {
  neutral: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info',
  unknown: 'text-muted-foreground',
}

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'unknown'

export type StatusChipProps = Omit<ComponentProps<'span'>, 'children'> & {
  tone?: StatusTone
  label: string
  /** Why the status is what it is. Shown in a tooltip; omit for a self-evident label. */
  detail?: string
  /** A trailing slot: a timestamp, a retry affordance, a count. */
  trailing?: JSX.Element
}

export function StatusChip(props: StatusChipProps) {
  const [local, rest] = splitProps(props, ['tone', 'label', 'detail', 'trailing', 'class'])

  const chip = (
    <span
      class={cn(
        'inline-flex w-fit items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        labelTone[local.tone ?? 'neutral'],
        local.class
      )}
      {...rest}
    >
      <span class={statusDotVariants({ tone: local.tone })} aria-hidden="true" />
      {local.label}
      {local.trailing}
    </span>
  )

  return (
    <Show when={local.detail} fallback={chip}>
      {(detail) => (
        <Tooltip>
          <TooltipTrigger as="span" class="inline-flex">
            {chip}
          </TooltipTrigger>
          <TooltipContent>{detail()}</TooltipContent>
        </Tooltip>
      )}
    </Show>
  )
}

export type StatusEntry = Readonly<{
  /** A stable key for the row. */
  id: string
  /** What is being reported — "Configuration", "Runtime", "Sync". */
  name: string
  tone: StatusTone
  label: string
  detail?: string
}>

/**
 * StatusList.
 *
 * The several-facts-about-one-thing shape: an agent with a configuration state, a
 * runtime state and an activity state; a service with a build, a deploy and a
 * health check. It is a definition list rather than a table because there is no
 * column to sort or compare — the rows are facets of a single subject, and a
 * screen reader should hear them as such.
 *
 * Fixed width on the name column is what makes a column of these scannable; the
 * rows line up without a table's semantics.
 */
export function StatusList(props: {
  entries: readonly StatusEntry[]
  class?: string
  /** Hide the name column and show only the chips — for a compact badge strip. */
  compact?: boolean
}) {
  return (
    <dl class={cn('grid gap-2 text-sm', props.class)}>
      {props.entries.map((entry) => (
        <div class="flex items-baseline justify-between gap-4">
          <Show when={!props.compact}>
            <dt class="text-muted-foreground">{entry.name}</dt>
          </Show>
          <dd class={cn(!props.compact && 'shrink-0')}>
            <StatusChip tone={entry.tone} label={entry.label} detail={entry.detail} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
