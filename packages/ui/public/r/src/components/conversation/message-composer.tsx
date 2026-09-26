import { CornerDownLeft, Paperclip, Send, X } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, createSignal, splitProps } from 'solid-js'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button/button'
import { Kbd } from '../ui/kbd/kbd'
import { Spinner } from '../ui/spinner/spinner'
import { Textarea } from '../ui/textarea/textarea'

/**
 * MessageComposer.
 *
 * The field a message is written in. It is a form, and it behaves like one: Enter
 * sends, Shift+Enter breaks the line, Escape clears the error.
 *
 * ## What it does not know
 *
 * No mention model, no attachment model, no dictation, no idempotency keys. The
 * first version of this composer was written against adea's agent and artifact
 * types, which meant it could only ever be used by adea. Here the attachment control
 * is a *slot*, the mention menu is a slot, and a caller that has an agent model
 * renders one; a caller that does not gets a composer without it.
 *
 * ## The three things it does own
 *
 * **Enter sends, Shift+Enter breaks the line.** That is the convention every chat
 * application shares, and getting it wrong is the single most irritating thing a
 * composer can do. `⌘`/`Ctrl`+Enter is accepted too, because someone arriving from an
 * editor will try it.
 *
 * **The send button is disabled when there is nothing to send.** A control that
 * accepts a press and does nothing is worse than one that says it cannot.
 *
 * **The status region is `aria-live`.** "Sending…" and a failure both land there, so
 * a screen reader hears the outcome without the composer stealing focus.
 */
export type MessageComposerProps = Omit<ComponentProps<'form'>, 'onSubmit'> & {
  /** The draft. Controlled: the caller owns the text, because it usually persists. */
  value: string
  onValueChange: (value: string) => void
  /** Called on send. A rejection is surfaced as an error and the draft is kept. */
  onSubmit: () => void | Promise<void>
  placeholder?: string
  /** Disable the whole composer, e.g. while the channel is read-only. */
  disabled?: boolean
  /** Label the send action for a context other than a message, e.g. a reply. */
  submitLabel?: string
  /** Show the keyboard hint under the field. */
  showHint?: boolean
  /** A leading control group, e.g. an attach button. */
  leading?: JSX.Element
  /** A trailing group before the send button, e.g. a dictation toggle. */
  trailing?: JSX.Element
  /** A menu rendered above the field, e.g. mention suggestions. */
  menu?: JSX.Element
  /** The reply target, drawn as a strip above the field. */
  replyTo?: { label: string; onDismiss: () => void }
}

export function MessageComposer(props: MessageComposerProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'value',
    'onValueChange',
    'onSubmit',
    'placeholder',
    'disabled',
    'submitLabel',
    'showHint',
    'leading',
    'trailing',
    'menu',
    'replyTo',
  ])

  const [sending, setSending] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const canSend = () => local.value.trim().length > 0 && !local.disabled && !sending()

  const send = async () => {
    if (!canSend()) return
    setSending(true)
    setError(null)
    try {
      await local.onSubmit()
    } catch {
      // The draft is deliberately left in place. A send that fails and clears the
      // field loses the user's work, which is the worst outcome available here.
      setError('Message not sent. Your draft is still here; retry when the connection recovers.')
    } finally {
      setSending(false)
    }
  }

  const onKeyDown: JSX.EventHandlerUnion<HTMLTextAreaElement, KeyboardEvent> = (event) => {
    if (event.key === 'Escape' && error()) {
      setError(null)
      return
    }
    if (event.key !== 'Enter') return
    // Shift breaks the line; a bare Enter, or a modified one, sends.
    if (event.shiftKey && !event.metaKey && !event.ctrlKey) return
    event.preventDefault()
    void send()
  }

  return (
    <form
      data-slot="message-composer"
      class={cn('flex flex-col gap-2', local.class)}
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
      {...rest}
    >
      <Show when={local.menu}>
        <div>{local.menu}</div>
      </Show>

      <Show when={local.replyTo}>
        {(reply) => (
          <div class="bg-muted text-muted-foreground flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs">
            <span class="min-w-0 flex-1 truncate">Replying to {reply().label}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-2xs"
              aria-label="Cancel reply"
              onClick={() => reply().onDismiss()}
            >
              <X />
            </Button>
          </div>
        )}
      </Show>

      <div
        class={cn(
          'border-input bg-card flex flex-col gap-1 rounded-lg border p-2',
          'transition-[color,box-shadow,border-color] ease-out',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-primary-subtle',
          local.disabled && 'opacity-50'
        )}
      >
        <Textarea
          value={local.value}
          onInput={(event) => local.onValueChange(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder={local.placeholder ?? 'Write a message…'}
          disabled={local.disabled}
          rows={1}
          aria-label={local.submitLabel ? `${local.submitLabel} message` : 'Message'}
          class="min-h-9 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />

        <div class="flex items-center gap-1">
          <Show when={local.leading}>{local.leading}</Show>
          <div class="ms-auto flex items-center gap-1">
            <Show when={local.trailing}>{local.trailing}</Show>
            <Button
              type="submit"
              size="icon-sm"
              disabled={!canSend()}
              aria-label={sending() ? 'Sending message' : 'Send message'}
            >
              <Show when={sending()} fallback={<Send />}>
                <Spinner size="sm" label={false} class="text-primary-foreground" />
              </Show>
            </Button>
          </div>
        </div>
      </div>

      <Show when={local.showHint}>
        <p class="text-muted-foreground flex items-center gap-1.5 text-2xs">
          <Kbd>Enter</Kbd> to send
          <span aria-hidden="true">·</span>
          <Kbd>Shift</Kbd> <Kbd>Enter</Kbd> for a new line
        </p>
      </Show>

      {/* A live region, so the outcome is announced without moving focus out of the
          field the user is typing in. */}
      <div aria-live="polite" class="min-h-0">
        <Show when={error()}>
          {(message) => <p class="text-destructive text-xs">{message()}</p>}
        </Show>
      </div>
    </form>
  )
}

/**
 * The attachment control.
 *
 * A slot rather than a built-in, because what can be attached is the application's
 * business — but the *button* is shared, so it looks and behaves the same in both.
 * The count is announced, since a paperclip alone does not say whether anything is
 * attached.
 */
export function ComposerAttachmentButton(
  props: ComponentProps<typeof Button> & { count?: number; open?: boolean }
) {
  const [local, rest] = splitProps(props, ['count', 'open', 'children'])

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={local.count ? `${local.count} attached, add an attachment` : 'Add an attachment'}
      aria-expanded={local.open}
      class="text-muted-foreground"
      {...rest}
    >
      {local.children ?? <Paperclip />}
    </Button>
  )
}

/** The hint a composer shows when the field is empty, as a one-line prompt. */
export function ComposerHint(props: ComponentProps<'p'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <p
      class={cn('text-muted-foreground flex items-center gap-1.5 text-2xs', local.class)}
      {...rest}
    >
      {local.children ?? (
        <>
          <CornerDownLeft aria-hidden="true" class="size-3" />
          <Kbd>Enter</Kbd> to send
        </>
      )}
    </p>
  )
}
