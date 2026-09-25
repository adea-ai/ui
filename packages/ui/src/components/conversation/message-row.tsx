import { CheckCheck, MessageSquareReply, Pencil, RotateCcw, Trash2 } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { For, Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import { Button } from '../ui/button/button'
import { CodeBlock, InlineCode } from '../ui/code-block'
import { ConversationAvatar, type ConversationAvatarKind } from './conversation-avatar'

/**
 * MessageRow.
 *
 * One turn in a transcript: a speaker, a bubble, and the actions that apply to it.
 *
 * ## What it does not know
 *
 * It takes no domain types. A caller supplies the speaker's name, the timestamp, and
 * the body as children; attachments, a linked task and the action row are slots. That
 * is deliberate and it is the difference between a component a second application can
 * use and one that only fits the application it was written in — the first version of
 * this row was written against adea's message model and could not have been used by
 * cortana at all.
 *
 * ## The two things it does know
 *
 * **The speaker's own messages mirror.** A user's turn puts the avatar on the trailing
 * edge and the bubble on the leading one, so a transcript can be read as a
 * conversation rather than as a log. `senderKind` decides that, and it is the only
 * place the layout branches.
 *
 * **`content-visibility: auto`.** A transcript is the one list in an application that
 * can hold thousands of rows, and this lets the engine skip layout and paint for the
 * ones off screen. `contain-intrinsic-size` is what keeps the scrollbar honest while
 * it does — without it the scroll height collapses as rows are skipped and the
 * thumb jumps. Both are load-bearing rather than an optimisation to add later.
 */
export type MessageRowProps = Omit<ComponentProps<'article'>, 'onSelect'> & {
  /** Who spoke. Decides the mirroring and the avatar's tone. */
  senderKind: ConversationAvatarKind
  /** The speaker's name, announced with the message rather than drawn. */
  senderName: string
  /** An ISO timestamp, rendered by the caller's own formatter. */
  time?: string
  /** The machine-readable time, for `<time datetime>`. */
  dateTime?: string
  /** Set when the message has been edited after sending. */
  edited?: boolean
  /** Set while the message is in flight. */
  pending?: boolean
  /**
   * Set while tokens are still arriving. Shows a caret after the body and drops
   * the delivered tick; distinct from `pending`, which is the *sending* state of
   * a message the user wrote. A turn can be neither, either, or (briefly) both.
   */
  streaming?: boolean
  /** Set when the message has been deleted, which replaces the body. */
  deleted?: boolean
  /** Draw attention to this row, e.g. after arriving from a search result. */
  highlighted?: boolean
  /** The caller's own avatar content. Falls back to a glyph for the kind. */
  avatar?: JSX.Element
  /** Attachments, rendered under the body. */
  attachments?: JSX.Element
  /** A linked entity — a task, an artifact, a session — rendered under the body. */
  link?: JSX.Element
  /** Extra rows in the action strip, before the built-in ones. */
  actions?: JSX.Element
  /** Show the reply affordance. Omit it to hide the action. */
  onOpenThread?: () => void
  /** Fires on hover and focus of the reply affordance, for prefetching. */
  onThreadIntent?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onRetry?: () => void
}

export function MessageRow(props: MessageRowProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'senderKind',
    'senderName',
    'time',
    'dateTime',
    'edited',
    'pending',
    'streaming',
    'deleted',
    'highlighted',
    'avatar',
    'attachments',
    'link',
    'actions',
    'onOpenThread',
    'onThreadIntent',
    'onEdit',
    'onDelete',
    'onRetry',
    'children',
  ])

  const mirrored = () => local.senderKind === 'user'

  return (
    <article
      data-slot="message-row"
      data-message-kind={local.senderKind}
      aria-busy={local.pending || undefined}
      tabindex={local.highlighted ? -1 : undefined}
      class={cn(
        'group/message grid max-w-3xl gap-2.5 px-1 py-1.5',
        /* The row is skipped by the engine while off screen; the intrinsic size keeps
           the scroll height stable while that happens. */
        '[content-visibility:auto] [contain-intrinsic-size:auto_7rem]',
        mirrored() ? 'grid-cols-[minmax(0,1fr)_2rem]' : 'grid-cols-[1.9rem_minmax(0,1fr)]',
        'transition-colors ease-out hover:bg-muted/45',
        local.highlighted && 'bg-primary-subtle shadow-[inset_3px_0_var(--primary)]',
        local.class
      )}
      {...rest}
    >
      <span data-slot="message-avatar" class={cn('mt-0.5', mirrored() ? 'order-2' : 'order-1')}>
        <ConversationAvatar kind={local.senderKind} size={mirrored() ? 'lg' : 'md'}>
          {local.avatar}
        </ConversationAvatar>
      </span>

      <div
        data-slot="message-content"
        class={cn('flex min-w-0 flex-col gap-1', mirrored() ? 'order-1' : 'order-2')}
      >
        <div
          data-slot="message-bubble"
          class={cn(
            'relative w-fit min-w-16 max-w-[min(100%,38rem)] rounded-lg border border-border px-3.5 pt-2.5 pb-2',
            'bg-card text-card-foreground',
            /* The tail: a squared corner on the side the speaker sits, which is what
               makes a bubble read as belonging to one voice. */
            mirrored() ? 'rounded-ee-sm ms-auto' : 'rounded-es-sm'
          )}
        >
          {/* The name is announced with the message rather than drawn: a transcript
              that repeats every speaker's name in every bubble is one nobody reads. */}
          <span class="visually-hidden">{local.senderName}</span>

          <div data-slot="message-body" class="text-sm">
            <Show
              when={!local.deleted}
              fallback={<p class="text-muted-foreground italic">Message deleted</p>}
            >
              {local.children}
            </Show>
          </div>

          <Show when={local.attachments}>
            <div class="mt-2 flex flex-wrap gap-2">{local.attachments}</div>
          </Show>

          <Show when={local.link}>
            <div class="mt-2">{local.link}</div>
          </Show>

          <div
            data-slot="message-meta"
            class="mt-1 flex items-center gap-2 text-2xs text-muted-foreground"
          >
            <Show when={local.time}>
              <time datetime={local.dateTime}>{local.time}</time>
            </Show>
            <Show when={local.edited}>
              <span>edited</span>
            </Show>
            <Show when={local.pending}>
              <span role="status">sending…</span>
            </Show>
            <Show when={local.streaming}>
              <span role="status">responding…</span>
            </Show>
            <Show when={mirrored() && !local.pending && !local.streaming && !local.deleted}>
              <span aria-label="Delivered" class="inline-flex">
                <CheckCheck aria-hidden="true" class="size-3" />
              </span>
            </Show>
          </div>
        </div>

        {/* The action strip is hidden until the row is hovered or focused, so a
            transcript is not a wall of buttons — but it stays in the accessibility
            tree and the tab order, because a control that only exists under the
            pointer cannot be reached by keyboard. */}
        <footer
          data-slot="message-actions"
          class={cn(
            'flex items-center gap-1 opacity-0 transition-opacity ease-out group-hover/message:opacity-100 group-focus-within/message:opacity-100',
            mirrored() && 'justify-end'
          )}
        >
          <Show when={local.actions}>{local.actions}</Show>
          <Show when={local.onOpenThread && !local.deleted}>
            <Button
              variant="ghost"
              size="2xs"
              class="gap-1.5 text-muted-foreground"
              onClick={() => local.onOpenThread?.()}
              onPointerEnter={() => local.onThreadIntent?.()}
              onFocus={() => local.onThreadIntent?.()}
            >
              <MessageSquareReply />
              Thread
            </Button>
          </Show>
          <Show when={local.onEdit && !local.deleted}>
            <Button
              variant="ghost"
              size="2xs"
              class="gap-1.5 text-muted-foreground"
              onClick={() => local.onEdit?.()}
            >
              <Pencil />
              Edit
            </Button>
          </Show>
          <Show when={local.onDelete && !local.deleted}>
            <Button
              variant="ghost"
              size="2xs"
              class="gap-1.5 text-muted-foreground"
              onClick={() => local.onDelete?.()}
            >
              <Trash2 />
              Delete
            </Button>
          </Show>
          <Show when={local.onRetry}>
            <Button
              variant="ghost"
              size="2xs"
              class="gap-1.5 text-muted-foreground"
              onClick={() => local.onRetry?.()}
            >
              <RotateCcw />
              Retry
            </Button>
          </Show>
        </footer>
      </div>
    </article>
  )
}

/**
 * A run of messages from the same speaker.
 *
 * Consecutive turns from one voice are a *paragraph*, and a transcript that repeats
 * the avatar and the name for each line reads as noise. The group draws the first
 * row fully and the rest without their avatar.
 */
export function MessageGroup(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <div data-slot="message-group" role="group" class={cn('flex flex-col', local.class)} {...rest}>
      {local.children}
    </div>
  )
}

/** A day divider, so a long transcript has somewhere to rest the eye. */
export function MessageDayDivider(props: ComponentProps<'div'> & { label: string }) {
  const [local, rest] = splitProps(props, ['class', 'label'])
  return (
    <div
      data-slot="message-day-divider"
      role="separator"
      class={cn('flex items-center gap-3 px-4 py-3', local.class)}
      {...rest}
    >
      <span class="h-px flex-1 bg-border" />
      <span class="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
        {local.label}
      </span>
      <span class="h-px flex-1 bg-border" />
    </div>
  )
}

/**
 * Renders a body's code fences as blocks, which a plain `<p>` cannot.
 *
 * The fence grammar is the part worth owning: a fence opens with ``` and an
 * optional language, and closes with ``` on its own. Everything outside a fence
 * is prose, and inside it the language tag belongs to the block's header rather
 * than to the code.
 *
 * Inline code — a single backtick pair inside a line — is rendered too, because
 * the alternative is an identifier in the prose that is indistinguishable from a
 * word. Only the *first* pair on a line is treated as code by the splitter here,
 * which is the common case; a caller that needs full inline grammar should pass
 * already-rendered children instead of `text`.
 */
export function MessageBody(
  props: ComponentProps<'div'> & {
    text: string
    /** True while the turn is still streaming, so a partial fence renders as a block. */
    streaming?: boolean
  }
) {
  const [local, rest] = splitProps(props, ['class', 'text', 'streaming'])

  /**
   * Split on fences, then on inline code. `filter(Boolean)` because a text that
   * begins with a fence produces an empty leading segment.
   */
  const segments = () =>
    local.text
      .split(/(```[\s\S]*?(?:```|$))/g)
      .filter(Boolean)
      .map((segment) => {
        if (!segment.startsWith('```')) {
          return { kind: 'prose' as const, value: segment }
        }
        const body = segment.replace(/^```/, '').replace(/```$/, '')
        // The language is the first token on the opening line, and only when the
        // fence actually carried one — a fence with a bare newline has none.
        const newline = body.indexOf('\n')
        const firstLine = newline === -1 ? '' : body.slice(0, newline)
        const language = /^[\w+#.-]+$/.test(firstLine.trim()) ? firstLine.trim() : undefined
        return {
          kind: 'code' as const,
          value: language ? body.slice(newline + 1) : body,
          language,
        }
      })

  const last = () => segments().at(-1)

  return (
    <div data-slot="message-body" class={cn('flex flex-col gap-2', local.class)} {...rest}>
      <For each={segments()}>
        {(segment) => (
          <Show when={segment.kind === 'code'} fallback={<Prose text={segment.value} />}>
            <CodeBlock
              code={segment.value}
              language={segment.kind === 'code' ? segment.language : undefined}
              complete={!local.streaming}
            />
          </Show>
        )}
      </For>
      {/*
        The caret trails the last segment, and only when that segment is prose: a
        streaming code block already carries its own generating indicator, and two
        of them on one turn read as two streams.
      */}
      <Show when={local.streaming && last()?.kind === 'prose'}>
        <span class="streaming-caret" aria-hidden="true" />
      </Show>
    </div>
  )
}

/**
 * A run of prose, with its inline code marked. The split is non-greedy and
 * requires a non-empty span, so an unmatched backtick stays a backtick rather
 * than swallowing the rest of the paragraph.
 */
function Prose(props: { text: string }) {
  const parts = () => props.text.split(/(`[^`\n]+`)/g).filter(Boolean)

  return (
    <p class="whitespace-pre-wrap">
      <For each={parts()}>
        {(part) => (
          <Show
            when={part.startsWith('`') && part.endsWith('`') && part.length > 2}
            fallback={part}
          >
            <InlineCode>{part.slice(1, -1)}</InlineCode>
          </Show>
        )}
      </For>
    </p>
  )
}
