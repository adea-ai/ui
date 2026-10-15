import { Show, splitProps, type ComponentProps, type JSX } from 'solid-js'
import { cn } from '../../../lib/utils'
import { cva, type VariantProps } from '../../../lib/variants'

/**
 * Marker.
 *
 * A note or divider *between* turns: a day change, a reconnect, a cancelled run,
 * an event the transcript does not recognise. It is deliberately the quietest
 * element in the column — a hairline with a label — because the transcript has
 * dozens of these and any one that shouts teaches the reader to stop looking.
 *
 * `variant="rule"` draws the hairline either side (a boundary: "Today",
 * "Reconnected"); `variant="note"` is a bare line of text with its mark (an
 * observation that sits inside the flow). `tone` colours the mark and label and
 * is never the only signal — the `label` always says it in words.
 *
 * A marker is static by default. Pass `live` for one that reports a change the
 * reader must not miss (connection lost): it becomes a status region (`polite`)
 * or an alert (`assertive`). A divider is not an ARIA separator, because
 * `separator` is defined to carry no content.
 */
export const markerVariants = cva('flex min-w-0 items-center gap-3 text-xs', {
  variants: {
    tone: {
      neutral: 'text-muted-foreground',
      info: 'text-info',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-destructive',
    },
    variant: {
      rule: 'w-full',
      note: 'w-full justify-start',
    },
  },
  defaultVariants: { tone: 'neutral', variant: 'rule' },
})

export type MarkerProps = Omit<ComponentProps<'div'>, 'children'> &
  VariantProps<typeof markerVariants> & {
    label: JSX.Element
    icon?: JSX.Element
    /** Secondary text after the label: a time, a count. */
    description?: JSX.Element
    /** A control that belongs to the note: Retry, Reconnect. */
    action?: JSX.Element
    live?: 'polite' | 'assertive'
  }

export function Marker(props: MarkerProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'tone',
    'variant',
    'label',
    'icon',
    'description',
    'action',
    'live',
  ])
  const rule = () => (local.variant ?? 'rule') === 'rule'
  return (
    <div
      data-slot="marker"
      role={local.live === 'assertive' ? 'alert' : local.live === 'polite' ? 'status' : undefined}
      class={cn(markerVariants({ tone: local.tone, variant: local.variant }), local.class)}
      {...rest}
    >
      <Show when={rule()}>
        <span aria-hidden="true" class="h-px min-w-4 flex-1 bg-border" />
      </Show>
      <span class="flex min-w-0 items-center gap-1.5">
        <Show when={local.icon}>
          <span aria-hidden="true" class="grid shrink-0 place-items-center [&_svg]:size-3.5">
            {local.icon}
          </span>
        </Show>
        <span class="font-medium [overflow-wrap:anywhere]">{local.label}</span>
        <Show when={local.description}>
          <span class="text-muted-foreground [overflow-wrap:anywhere]">{local.description}</span>
        </Show>
        <Show when={local.action}>{local.action}</Show>
      </span>
      <Show when={rule()}>
        <span aria-hidden="true" class="h-px min-w-4 flex-1 bg-border" />
      </Show>
    </div>
  )
}
