/*
 * Substantially translated from KiroCrew website/src/components/ChatInput.tsx
 * at 283e136c0f902e965a535a7c9548c57c7504fed0.
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * Licensed under Apache-2.0; see LICENSE and NOTICE.
 */
import { ChevronsDownUp, ChevronsUpDown, MoreHorizontal, ArrowUp } from 'lucide-solid'
import { Show, createEffect, createSignal, on, onCleanup, onMount, type JSX } from 'solid-js'
import { Button } from '../ui/button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu/dropdown-menu'
import { Spinner } from '../ui/spinner/spinner'
import { BusySendButton, type BusySendButtonProps, type BusySendMode } from './busy-send-button'
import { createComposerImeGuard } from './ime-guard'

export type ChatComposerControl = {
  /** Focus this instance; false when it is unavailable or collapsed. */
  focus: () => boolean
  /** A typing intent, unlike merely navigating to a conversation. */
  expandAndFocus: () => boolean
}
export type ChatComposerProps = {
  value: string
  onValueChange: (value: string) => void
  /** The host owns attachments and delivery; text/action are captured at the gesture. */
  onSubmit: (input: { text: string; action: 'send' | BusySendMode }) => void | Promise<void>
  /** Host scope fence; changes discard local feedback, not the host draft. */
  resetKey?: unknown
  disabled?: boolean
  readOnly?: boolean
  /** A visible capability or connectivity reason. */
  blockedReason?: string
  placeholder?: string
  inputLabel?: string
  /** Opt-in and controlled: the library neither persists nor broadcasts it. */
  collapse?: { value: boolean; onChange: (value: boolean) => void }
  controlRef?: (control: ChatComposerControl | undefined) => void
  /** Host payload eligibility by action; reference-only drafts may queue but not steer. */
  sendableActions?: Partial<Record<'send' | BusySendMode, boolean>>
  busy?: Omit<BusySendButtonProps, 'onFire' | 'disabled' | 'alternateActionHint'>
  knowledge?: JSX.Element
  followUps?: JSX.Element
  band?: JSX.Element
  approval?: JSX.Element
  notices?: JSX.Element
  attachments?: JSX.Element
  leadingActions?: JSX.Element
  trailingActions?: JSX.Element
  /** Host-contributed menu items; no upload, skill or permission services here. */
  menuItems?: JSX.Element
  context?: JSX.Element
  /** Host derives this from the pending approval presentation, not UI policy. */
  approvalFocus?: boolean
}

/**
 * Kiro's composer assembly: context/options, adjacent band, approval/notices,
 * staged content, input/action groups and a context shelf. Reading collapse
 * really unmounts the input and shelf and offers a labeled way back with draft
 * preview. The host retains the only draft, identities, preferences and services.
 *
 * Kobalte owns the options menu. Scoped imperative typing intent replaces the
 * donor global lookup/broadcast so a second composer cannot receive this draft
 * or focus. No animation starts from hidden geometry, no global shortcut, and no
 * runtime/permission/voice/optimizer authority is copied. More specific chips,
 * approval decisions and staged-content semantics are supplied by their owners.
 */
export function ChatComposer(props: ChatComposerProps) {
  const ime = createComposerImeGuard()
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  let field: HTMLTextAreaElement | undefined
  let restoreBar: HTMLButtonElement | undefined
  let focusFrame: number | undefined
  let focusTarget: 'input' | 'bar' | undefined
  let selection:
    | { start: number; end: number; direction: 'forward' | 'backward' | 'none' }
    | undefined
  let generation = 0
  let active = true
  const collapsed = () => props.collapse?.value === true
  const unavailable = () => props.disabled || props.readOnly || !!props.blockedReason
  const cancelFocus = () => {
    if (focusFrame !== undefined) cancelAnimationFrame(focusFrame)
    focusFrame = undefined
  }
  const requestFocus = (target: 'input' | 'bar') => {
    cancelFocus()
    focusTarget = target
    focusFrame = requestAnimationFrame(() => {
      focusFrame = undefined
      if (!active || props.approvalFocus) return
      if (target === 'bar' && collapsed()) restoreBar?.focus()
      if (target === 'input' && !collapsed() && !props.disabled && field) {
        field.focus()
        if (selection)
          field.setSelectionRange(
            Math.min(selection.start, field.value.length),
            Math.min(selection.end, field.value.length),
            selection.direction
          )
      }
      focusTarget = undefined
    })
  }
  const changeCollapsed = (value: boolean) => {
    if (!props.collapse || props.approvalFocus) return
    if (value && field)
      selection = {
        start: field.selectionStart,
        end: field.selectionEnd,
        direction: field.selectionDirection,
      }
    props.collapse.onChange(value)
    requestFocus(value ? 'bar' : 'input')
  }
  const control: ChatComposerControl = {
    focus() {
      if (collapsed() || props.approvalFocus || props.disabled || !field) return false
      field.focus()
      return true
    },
    expandAndFocus() {
      if (props.approvalFocus || props.disabled) return false
      if (collapsed()) changeCollapsed(false)
      else requestFocus('input')
      return true
    },
  }
  onMount(() => props.controlRef?.(control))
  createEffect(
    on(
      () => props.resetKey,
      () => {
        generation += 1
        selection = undefined
        cancelFocus()
        focusTarget = undefined
        setPending(false)
        setError(null)
        ime.onBlur()
      },
      { defer: true }
    )
  )
  onCleanup(() => {
    active = false
    generation += 1
    cancelFocus()
    props.controlRef?.(undefined)
  })
  const action = (): 'send' | BusySendMode => props.busy?.mode ?? 'send'
  const canSend = (selected: 'send' | BusySendMode = action()) =>
    !unavailable() &&
    !pending() &&
    (props.value.trim().length > 0 || props.sendableActions?.[selected]) &&
    !(selected !== 'send' && props.busy?.unavailable?.[selected])
  const submit = async (selected: 'send' | BusySendMode = action()) => {
    if (!canSend(selected)) return
    const started = generation
    const input = { text: props.value, action: selected }
    setPending(true)
    setError(null)
    try {
      await props.onSubmit(input)
    } catch {
      if (active && started === generation)
        setError('Message not sent. Check your draft and retry when the connection recovers.')
    } finally {
      if (active && started === generation) setPending(false)
    }
  }
  const preview = () => {
    const first =
      props.value
        .split('\n')
        .find((line) => line.trim().length > 0)
        ?.trim() ?? ''
    return first.length > 120 ? `${first.slice(0, 120)}…` : first
  }
  return (
    <div data-slot="chat-composer" class="mx-auto flex w-full max-w-4xl flex-col px-4 pb-1">
      <Show when={!props.approvalFocus}>
        <Show when={props.knowledge}>
          <div data-slot="composer-knowledge">{props.knowledge}</div>
        </Show>
        <Show when={props.followUps}>
          <div data-slot="composer-follow-ups">{props.followUps}</div>
        </Show>
      </Show>
      <Show when={props.band}>
        <div data-slot="composer-band">{props.band}</div>
      </Show>
      <div aria-hidden="true" class="h-1.5 shrink-0" />
      <Show when={props.approval}>
        <div data-slot="composer-approval">{props.approval}</div>
      </Show>
      <Show when={props.notices}>
        <div data-slot="composer-notices">{props.notices}</div>
      </Show>
      <Show when={props.blockedReason}>
        <p role="status" class="text-muted-foreground mb-1 text-xs">
          {props.blockedReason}
        </p>
      </Show>
      <Show when={error()}>
        {(message) => (
          <p role="alert" class="text-destructive mb-1 text-xs">
            {message()}
          </p>
        )}
      </Show>
      <Show when={!props.approvalFocus}>
        <Show
          when={!collapsed()}
          fallback={
            <Button
              ref={(element) => {
                restoreBar = element
                onCleanup(() => {
                  if (restoreBar === element) restoreBar = undefined
                })
              }}
              type="button"
              variant="outline"
              size="sm"
              class="w-full justify-start"
              aria-expanded={false}
              aria-label="Show the message input"
              onClick={() => changeCollapsed(false)}
            >
              <ChevronsUpDown />
              <span aria-hidden="true" class="shrink-0">
                Show the message input
              </span>
              <Show when={preview()}>
                <span aria-hidden="true" class="min-w-0 flex-1 truncate">
                  {preview()}
                </span>
              </Show>
            </Button>
          }
        >
          <form
            data-slot="composer-input-box"
            class="border-input bg-card flex flex-col overflow-hidden rounded-2xl border transition-colors focus-within:border-ring"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <Show when={props.attachments}>
              <div data-slot="composer-staged-content">{props.attachments}</div>
            </Show>
            <textarea
              ref={(element) => {
                field = element
                onCleanup(() => {
                  if (field === element) field = undefined
                })
              }}
              data-slot="composer-input"
              aria-label={props.inputLabel ?? 'Message'}
              class="field-sizing-content text-foreground placeholder:text-muted-foreground min-h-11 max-h-36 w-full resize-none border-0 bg-transparent px-4 py-3 text-sm outline-none disabled:opacity-50"
              value={props.value}
              onInput={(event) => props.onValueChange(event.currentTarget.value)}
              disabled={props.disabled}
              readOnly={props.readOnly || pending()}
              placeholder={props.placeholder ?? 'Write a message…'}
              rows={1}
              onCompositionStart={ime.onCompositionStart}
              onCompositionEnd={ime.onCompositionEnd}
              onFocus={ime.onFocus}
              onBlur={ime.onBlur}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && error()) {
                  setError(null)
                  return
                }
                if (event.key !== 'Enter' || event.shiftKey || event.defaultPrevented) return
                if (ime.claimEnter(event)) {
                  const selected =
                    props.busy && (event.metaKey || event.ctrlKey)
                      ? props.busy.mode === 'steer'
                        ? 'queue'
                        : 'steer'
                      : action()
                  void submit(selected)
                }
              }}
            />
            <div
              data-slot="composer-action-row"
              class="flex items-center justify-between gap-2 px-2.5 pb-2 pt-0.5"
            >
              <div class="flex min-w-0 items-center gap-1">
                <Show when={props.collapse || props.menuItems}>
                  <DropdownMenu placement="top-start">
                    <DropdownMenuTrigger
                      as={Button}
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Message input options"
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      onCloseAutoFocus={(event) => {
                        if (focusTarget) event.preventDefault()
                      }}
                    >
                      {props.menuItems}
                      <Show when={props.collapse}>
                        <DropdownMenuItem onSelect={() => changeCollapsed(true)}>
                          <ChevronsDownUp />
                          <div class="flex min-w-0 flex-col">
                            <span>Collapse the message input</span>
                            <span class="text-muted-foreground text-xs">
                              Make room to read; keep your draft
                            </span>
                          </div>
                        </DropdownMenuItem>
                      </Show>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Show>
                {props.leadingActions}
              </div>
              <div class="flex shrink-0 items-center gap-1">
                {props.trailingActions}
                <Show
                  when={props.busy}
                  fallback={
                    <Button
                      type="submit"
                      size="icon-sm"
                      disabled={!canSend()}
                      aria-label={pending() ? 'Sending message' : 'Send message'}
                    >
                      <Show when={pending()} fallback={<ArrowUp />}>
                        <Spinner size="sm" label={false} />
                      </Show>
                    </Button>
                  }
                >
                  {(busy) => (
                    <BusySendButton
                      {...busy()}
                      alternateActionHint={
                        busy().unavailable?.[busy().mode === 'steer' ? 'queue' : 'steer']
                          ? undefined
                          : 'Ctrl/Cmd+Enter uses the other action'
                      }
                      disabled={!canSend()}
                      onFire={() => {
                        void submit()
                      }}
                    />
                  )}
                </Show>
              </div>
            </div>
          </form>
          <Show when={props.context}>
            <div data-slot="composer-context" class="flex min-w-0 items-center gap-2 pt-1">
              {props.context}
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  )
}
