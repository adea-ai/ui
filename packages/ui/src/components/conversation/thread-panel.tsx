import { X } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import { Button } from '../ui/button/button'

/**
 * ThreadPanel.
 *
 * The replies to one message, shown beside the transcript rather than in it. Keeping
 * a thread out of the main flow is what stops a busy side conversation from burying
 * the conversation everyone is having.
 *
 * The root message is repeated at the top — with `pinned` — because a thread read out
 * of context is a set of answers to a question the reader can no longer see.
 *
 * The panel is a `complementary` landmark with a label, so it is reachable by
 * landmark navigation rather than by tabbing through the transcript to find it.
 */
export type ThreadPanelProps = ComponentProps<'aside'> & {
  /** The thread's title, usually the root message's author. */
  label: string
  /** A count of replies, shown beside the label. */
  count?: number
  /** The root message, drawn above the replies. */
  root?: JSX.Element
  /** The composer for a reply. */
  composer?: JSX.Element
  onClose?: () => void
}

export function ThreadPanel(props: ThreadPanelProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'label',
    'count',
    'root',
    'composer',
    'onClose',
    'children',
  ])

  return (
    <aside
      data-slot="thread-panel"
      aria-label={`Thread: ${local.label}`}
      class={cn(
        'bg-surface flex h-full w-96 shrink-0 flex-col border-s border-border',
        local.class
      )}
      {...rest}
    >
      <header class="flex h-topbar shrink-0 items-center gap-2 border-b border-border px-3">
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-sm font-semibold tracking-tight">Thread</span>
          <Show when={local.count !== undefined}>
            <span class="text-muted-foreground text-2xs">
              {local.count} {local.count === 1 ? 'reply' : 'replies'}
            </span>
          </Show>
        </div>
        <Show when={local.onClose}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close thread"
            class="ms-auto text-muted-foreground"
            onClick={() => local.onClose?.()}
          >
            <X />
          </Button>
        </Show>
      </header>

      <Show when={local.root}>
        <div class="bg-muted/40 shrink-0 border-b border-border px-3 py-2">{local.root}</div>
      </Show>

      <div
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        role="region"
        aria-label="Thread replies"
        tabindex="0"
      >
        {local.children}
      </div>

      <Show when={local.composer}>
        <div class="shrink-0 border-t border-border p-2">{local.composer}</div>
      </Show>
    </aside>
  )
}

/**
 * An attachment card.
 *
 * A file is not a link: the reader wants to know what it is and how big it is before
 * deciding to open it, so the media type and size are on the card rather than behind
 * a click. `unavailable` is a real state — an artifact can be deleted, or live on a
 * device this one is not authorized for — and it is drawn as text rather than as a
 * dead link.
 */
export type AttachmentCardProps = ComponentProps<'button'> & {
  name: string
  /** A short description of the type and size, e.g. "image/png · 24,120 bytes". */
  detail?: string
  /** Draw the card as unavailable, with the reason as the detail. */
  unavailable?: boolean
  icon?: JSX.Element
}

export function AttachmentCard(props: AttachmentCardProps) {
  const [local, rest] = splitProps(props, ['class', 'name', 'detail', 'unavailable', 'icon'])

  return (
    <button
      type="button"
      disabled={local.unavailable}
      class={cn(
        'flex max-w-64 items-center gap-2.5 rounded-md border border-border bg-surface-sunken px-2.5 py-2 text-start',
        'transition-colors ease-out outline-none',
        local.unavailable
          ? 'cursor-not-allowed opacity-60'
          : 'hover:border-input hover:bg-surface-hover',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        local.class
      )}
      {...rest}
    >
      {local.icon}
      <span class="flex min-w-0 flex-col">
        <span class="truncate text-xs font-medium">{local.name}</span>
        <Show when={local.detail}>
          <span class="text-muted-foreground truncate text-2xs">{local.detail}</span>
        </Show>
      </span>
    </button>
  )
}
