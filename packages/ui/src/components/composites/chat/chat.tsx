import { CircleAlert, Info, TriangleAlert } from 'lucide-solid'
import { Show, splitProps, type ComponentProps, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { cn } from '#lib/utils'
import { cva, type VariantProps } from '#lib/variants'

/**
 * Chat.
 *
 * The frame a conversation lives in: a header, a strip for things the reader
 * must know before reading anything else, the thread, and the composer. It is a
 * layout and nothing more — the thread is a `MessageScroller`, the input is a
 * composer, and what happens in between is the host's — which is why it takes
 * slots instead of data.
 *
 * ## Why notices have their own row
 *
 * "The connection dropped", "this transcript has a gap", "this session is
 * read-only" are about the whole conversation, not about a turn, and they must
 * not scroll away with the turns. They sit between the header and the thread in
 * their own grid track, so a notice appearing never steals the thread's row and
 * collapses to zero height when there are none. Each notice states its cause in
 * words and carries its own remedy (`action`); one that reports a *change*
 * (`live`) is announced, one that describes a standing condition is not.
 *
 * ## Layout
 *
 * `h-full min-h-0`, so the thread scrolls inside the frame rather than the page
 * growing, and a `min-w-0` track, so a long unbroken token in a turn cannot widen
 * the whole conversation. Nothing here sets a width: the reading column is the
 * turn's, and the composer sets its own measure.
 */
export type ChatProps = ComponentProps<'section'> & {
  header?: JSX.Element
  /** `ChatNotice`s. The row collapses when this is empty. */
  notices?: JSX.Element
  /** The composer. */
  composer?: JSX.Element
}

export function Chat(props: ChatProps) {
  const [local, rest] = splitProps(props, ['class', 'header', 'notices', 'composer', 'children'])
  return (
    <section
      data-slot="chat"
      class={cn(
        'grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_minmax(0,1fr)_auto] bg-background text-foreground',
        local.class
      )}
      {...rest}
    >
      <div class="row-start-1 min-w-0">{local.header}</div>
      <div class="row-start-2 flex min-w-0 flex-col">{local.notices}</div>
      <div class="row-start-3 flex min-h-0 min-w-0 flex-col">{local.children}</div>
      <div class="row-start-4 min-w-0">{local.composer}</div>
    </section>
  )
}

export type ChatHeaderProps = Omit<ComponentProps<'header'>, 'title'> & {
  title: JSX.Element
  /** One line under the title: identity, scope, generation. */
  subtitle?: JSX.Element
  /** The conversation's state in words (a `StatusChip`). */
  status?: JSX.Element
  /** Host actions: rename, archive, hand off. */
  actions?: JSX.Element
}

export function ChatHeader(props: ChatHeaderProps) {
  const [local, rest] = splitProps(props, ['class', 'title', 'subtitle', 'status', 'actions'])
  return (
    <header
      data-slot="chat-header"
      class={cn(
        'flex min-h-topbar min-w-0 items-center gap-3 border-b border-border px-4 py-2',
        local.class
      )}
      {...rest}
    >
      <div class="flex min-w-0 flex-1 flex-col">
        <h2 class="m-0 truncate text-sm font-semibold tracking-tight">{local.title}</h2>
        <Show when={local.subtitle}>
          <p class="m-0 truncate text-xs text-muted-foreground">{local.subtitle}</p>
        </Show>
      </div>
      <Show when={local.status}>{local.status}</Show>
      <Show when={local.actions}>
        <div class="flex shrink-0 items-center gap-1">{local.actions}</div>
      </Show>
    </header>
  )
}

export const chatNoticeVariants = cva(
  'flex min-w-0 items-start gap-2.5 border-b px-4 py-2 text-sm',
  {
    variants: {
      tone: {
        info: 'border-border bg-muted/40',
        warning: 'border-warning/30 bg-warning-subtle',
        danger: 'border-destructive/30 bg-destructive-subtle',
      },
    },
    defaultVariants: { tone: 'info' },
  }
)

export type ChatNoticeProps = Omit<ComponentProps<'div'>, 'title'> &
  VariantProps<typeof chatNoticeVariants> & {
    title: JSX.Element
    description?: JSX.Element
    /** The remedy: Reconnect, Jump to terminal. */
    action?: JSX.Element
    /** Announce it. Use for a change (connection lost), not a standing condition. */
    live?: 'polite' | 'assertive'
  }

export function ChatNotice(props: ChatNoticeProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'tone',
    'title',
    'description',
    'action',
    'live',
  ])
  const Glyph = () =>
    local.tone === 'danger' ? CircleAlert : local.tone === 'warning' ? TriangleAlert : Info
  return (
    <div
      data-slot="chat-notice"
      role={local.live === 'assertive' ? 'alert' : local.live === 'polite' ? 'status' : undefined}
      class={cn(chatNoticeVariants({ tone: local.tone }), local.class)}
      {...rest}
    >
      <span
        aria-hidden="true"
        class={cn('mt-0.5 shrink-0 [&_svg]:size-4', {
          'text-muted-foreground': (local.tone ?? 'info') === 'info',
          'text-warning': local.tone === 'warning',
          'text-destructive': local.tone === 'danger',
        })}
      >
        <Dynamic component={Glyph()} />
      </span>
      <div class="min-w-0 flex-1">
        <p class="m-0 font-medium [overflow-wrap:anywhere]">{local.title}</p>
        <Show when={local.description}>
          <p class="m-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {local.description}
          </p>
        </Show>
      </div>
      <Show when={local.action}>
        <div class="flex shrink-0 items-center gap-1.5">{local.action}</div>
      </Show>
    </div>
  )
}

export type ChatEmptyProps = Omit<ComponentProps<'div'>, 'title'> & {
  title: JSX.Element
  description?: JSX.Element
  /** Prompt chips (`Suggestions`), shown only when the host has real ones. */
  suggestions?: JSX.Element
}

/** A conversation with no turns yet. Centred in the thread, never in a card. */
export function ChatEmpty(props: ChatEmptyProps) {
  const [local, rest] = splitProps(props, ['class', 'title', 'description', 'suggestions'])
  return (
    <div
      data-slot="chat-empty"
      class={cn(
        'mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-10 text-center',
        local.class
      )}
      {...rest}
    >
      <div class="flex flex-col gap-1">
        <h3 class="m-0 text-base font-semibold tracking-tight text-balance">{local.title}</h3>
        <Show when={local.description}>
          <p class="m-0 text-sm text-muted-foreground text-balance">{local.description}</p>
        </Show>
      </div>
      <Show when={local.suggestions}>{local.suggestions}</Show>
    </div>
  )
}
