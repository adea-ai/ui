import { splitProps, type ComponentProps, type JSX } from 'solid-js'
import { cn } from '#lib/utils'
import { cva, type VariantProps } from '#lib/variants'

/**
 * Bubble.
 *
 * The container for what *the person* sends. The assistant's reply is not a
 * bubble: it is the page, set in the reading column with no surface behind it,
 * because a reply that is a card among cards turns every long answer into a box
 * to scroll inside. A bubble marks the one voice that is quoting itself back — a
 * short, bounded message — so the eye can find where each turn begins.
 *
 * `state` is the delivery truth, not decoration: `pending` while the send is in
 * flight, `queued` for a follow-up the runtime has not taken yet (dashed, so it
 * reads as not yet part of the conversation), `failed` when it did not go. Each
 * state has a word in `status`, because the border alone is not a signal.
 *
 * Text is rendered as text. `whitespace-pre-wrap` keeps the sender's line breaks
 * and `overflow-wrap: anywhere` stops a pasted token or URL from widening the
 * column; nothing here interprets markup.
 */
export const bubbleVariants = cva(
  'relative w-fit max-w-full min-w-0 rounded-2xl px-3.5 py-2 font-content text-content break-words whitespace-pre-wrap [overflow-wrap:anywhere]',
  {
    variants: {
      tone: {
        user: 'bg-primary-subtle text-foreground',
        neutral: 'bg-muted text-foreground',
        quiet: 'border border-border bg-transparent text-foreground',
      },
      state: {
        sent: '',
        pending: 'opacity-70',
        queued: 'border border-dashed border-border bg-transparent',
        failed: 'border border-destructive',
      },
    },
    defaultVariants: { tone: 'user', state: 'sent' },
  }
)

export type BubbleProps = Omit<ComponentProps<'div'>, 'children'> &
  VariantProps<typeof bubbleVariants> & {
    children?: JSX.Element
    /** What the state means in words: "Sending…", "Queued", "Not sent". */
    status?: JSX.Element
    /** Shown beside the status, e.g. a Retry button for a failed send. */
    statusAction?: JSX.Element
  }

export function Bubble(props: BubbleProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'tone',
    'state',
    'children',
    'status',
    'statusAction',
  ])
  return (
    <div class="flex max-w-full min-w-0 flex-col items-end gap-1" data-slot="bubble-root">
      <div
        data-slot="bubble"
        data-state={local.state ?? 'sent'}
        class={cn(bubbleVariants({ tone: local.tone, state: local.state }), local.class)}
        {...rest}
      >
        {local.children}
      </div>
      {local.status !== undefined || local.statusAction !== undefined ? (
        <div
          data-slot="bubble-status"
          role={local.state === 'failed' ? 'alert' : 'status'}
          class={cn('flex items-center gap-2 text-xs', {
            'text-destructive': local.state === 'failed',
            'text-muted-foreground': local.state !== 'failed',
          })}
        >
          {local.status}
          {local.statusAction}
        </div>
      ) : null}
    </div>
  )
}
