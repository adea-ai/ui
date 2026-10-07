import { CornerDownLeft, Paperclip, Send, X } from 'lucide-solid'
import type { ComponentProps, JSX, Ref } from 'solid-js'
import { Show, createSignal, createUniqueId, splitProps } from 'solid-js'
import { cn } from '../../lib/utils'
import { ActionButton } from '../composites/action-button/action-button'
import { Button } from '../ui/button/button'
import { Kbd } from '../ui/kbd/kbd'
import { Spinner } from '../ui/spinner/spinner'
import { Textarea } from '../ui/textarea/textarea'
import { createComposerImeGuard } from './ime-guard'

function invokeEventHandler(handler: unknown, event: Event) {
  if (Array.isArray(handler)) {
    const [callback, data] = handler as [(data: unknown, event: Event) => void, unknown]
    callback(data, event)
  } else if (typeof handler === 'function') {
    const callback = handler as (event: Event) => void
    callback(event)
  }
}

/**
 * MessageComposer.
 *
 * The field a message is written in. It is a form, and it behaves like one: Enter
 * sends, Shift+Enter breaks the line, Escape clears the error from anywhere in
 * the composer unless a nested control or an active IME already owns the key.
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
 *
 * Enter ownership follows KiroCrew's pinned IME latch: candidate commits keep
 * their native default action, and the post-composition Enter cannot send or
 * insert an accidental newline. Composition abandoned by focus/blur recovers;
 * the Solid owner's cleanup settles its timer. See ime-guard.ts for provenance.
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
  /** Accessible name and tooltip for the action, e.g. "Reply". */
  submitLabel?: string
  /** Show the keyboard hint under the field. */
  showHint?: boolean
  /** A leading control group, e.g. an attach button. */
  leading?: JSX.Element
  /** A trailing group before the send button, e.g. a dictation toggle. */
  trailing?: JSX.Element
  /** A menu rendered above the field, e.g. mention suggestions. */
  menu?: JSX.Element
  /**
   * Host progress rendered in the composer's own live region, e.g. dictation
   * state — plain paragraphs are progress, a `role="alert"` paragraph is a
   * failure. Sending and send-failure copy stays the composer's own.
   */
  status?: JSX.Element
  /** The reply target, drawn as a strip above the field. */
  replyTo?: { label: string; onDismiss: () => void }
  /** Ref to the actual message textarea, for host focus and selection behavior. */
  inputRef?: Ref<HTMLTextAreaElement>
  /** Stable host-owned id for the actual textarea. */
  inputId?: string
  /** Accessible name for the actual textarea. Defaults to "Message" or "Reply message". */
  inputLabel?: string
  /** Additional help text associated with the actual textarea. */
  inputDescription?: string
  /** Existing host description id, combined with `inputDescription` when supplied. */
  inputDescribedBy?: string
  /** Comfortable uses the shared 4rem minimum and 12rem maximum field heights. */
  inputSize?: 'default' | 'comfortable'
  /** The shared resize behavior for the actual textarea. */
  inputResize?: 'vertical' | 'none' | 'both'
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
    'status',
    'replyTo',
    'inputRef',
    'inputId',
    'inputLabel',
    'inputDescription',
    'inputDescribedBy',
    'inputSize',
    'inputResize',
    'onKeyDown',
  ])

  const [sending, setSending] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const ime = createComposerImeGuard()
  const descriptionId = `message-composer-help-${createUniqueId()}`
  const describedBy = () =>
    [local.inputDescribedBy, local.inputDescription ? descriptionId : undefined]
      .filter(Boolean)
      .join(' ') || undefined
  const actionLabel = () => local.submitLabel ?? 'Send message'
  const pendingLabel = () =>
    `Sending ${local.submitLabel ? local.submitLabel.toLowerCase() : 'message'}`

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
    if (event.defaultPrevented) return
    if (event.key !== 'Enter') return
    // Shift breaks the line; a bare Enter, or a modified one, sends.
    if (event.shiftKey && !event.metaKey && !event.ctrlKey) return
    if (!ime.claimEnter(event)) return
    void send()
  }

  const onFormKeyDown: JSX.EventHandlerUnion<HTMLFormElement, KeyboardEvent> = (event) => {
    invokeEventHandler(local.onKeyDown, event)
    if (
      event.defaultPrevented ||
      event.key !== 'Escape' ||
      !error() ||
      event.isComposing ||
      event.keyCode === 229
    ) {
      return
    }
    setError(null)
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <form
      data-slot="message-composer"
      class={cn('flex flex-col gap-2', local.class)}
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
      onKeyDown={onFormKeyDown}
      {...rest}
    >
      <Show when={local.menu}>
        <div>{local.menu}</div>
      </Show>

      <Show when={local.replyTo}>
        {(reply) => (
          <div class="bg-muted text-muted-foreground flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs">
            <span class="min-w-0 flex-1 truncate">Replying to {reply().label}</span>
            <ActionButton
              type="button"
              variant="ghost"
              size="icon-2xs"
              aria-label="Cancel reply"
              tooltip="Cancel reply"
              onClick={() => reply().onDismiss()}
            >
              <X />
            </ActionButton>
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
          ref={local.inputRef}
          id={local.inputId}
          onCompositionStart={ime.onCompositionStart}
          onCompositionEnd={ime.onCompositionEnd}
          onFocus={ime.onFocus}
          onBlur={ime.onBlur}
          value={local.value}
          onInput={(event) => local.onValueChange(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder={local.placeholder ?? 'Write a message…'}
          disabled={local.disabled}
          rows={1}
          aria-label={
            local.inputLabel ?? (local.submitLabel ? `${local.submitLabel} message` : 'Message')
          }
          aria-describedby={describedBy()}
          variant="composer"
          size={local.inputSize ?? 'comfortable'}
          resize={local.inputResize ?? 'vertical'}
        />
        <Show when={local.inputDescription}>
          {(description) => (
            <span id={descriptionId} class="sr-only">
              {description()}
            </span>
          )}
        </Show>

        <div class="flex items-center gap-1">
          <Show when={local.leading}>{local.leading}</Show>
          <div class="ms-auto flex items-center gap-1">
            <Show when={local.trailing}>{local.trailing}</Show>
            <ActionButton
              type="submit"
              size="icon-sm"
              disabled={!canSend()}
              aria-label={sending() ? pendingLabel() : actionLabel()}
              tooltip={actionLabel()}
            >
              <Show when={sending()} fallback={<Send />}>
                <Spinner size="sm" label={false} class="text-primary-foreground" />
              </Show>
            </ActionButton>
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
      <div role="status" aria-live="polite" class="min-h-0">
        <Show
          when={sending()}
          fallback={
            <Show when={error()}>
              {(message) => (
                <p class="text-foreground border-s-2 border-destructive ps-2 text-xs">
                  {message()}
                </p>
              )}
            </Show>
          }
        >
          {pendingLabel()}…
        </Show>
        <Show when={local.status}>{local.status}</Show>
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
    <ActionButton
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={local.count ? `${local.count} attached, add an attachment` : 'Add an attachment'}
      aria-expanded={local.open}
      tooltip="Add an attachment"
      class="text-muted-foreground"
      {...rest}
    >
      {local.children ?? <Paperclip />}
    </ActionButton>
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
