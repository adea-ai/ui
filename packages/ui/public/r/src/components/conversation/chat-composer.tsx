/*
 * Substantially translated from KiroCrew website/src/components/ChatInput.tsx
 * at 283e136c0f902e965a535a7c9548c57c7504fed0.
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * Licensed under Apache-2.0; see LICENSE and NOTICE.
 */
import type { JSX } from 'solid-js'
import type { BusySendButtonProps, BusySendMode } from './busy-send-button'
import { ChatComposerShell } from './internal/chat-composer-shell'

export type ChatComposerControl = {
  /** Focus this instance; false when it is unavailable or collapsed. */
  focus: () => boolean
  /** A typing intent, unlike merely navigating to a conversation. */
  expandAndFocus: () => boolean
}

export type ChatComposerSharedProps = {
  value: string
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
  /** Host payload eligibility by action; explicit false refuses even a nonempty draft. */
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

export type ChatComposerSubmitInput = {
  text: string
  action: 'send' | BusySendMode
}

export type ChatComposerProps = ChatComposerSharedProps & {
  onValueChange: (value: string) => void
  onSubmit: (input: ChatComposerSubmitInput) => void | Promise<void>
}

/** Plain-text entry. Atomic paste editing is available from the separate atomic subpath. */
export function ChatComposer(props: ChatComposerProps) {
  return (
    <ChatComposerShell
      {...props}
      createSubmitExtra={() => ({})}
      renderInput={(input) => (
        <textarea
          ref={input.ref}
          data-slot="composer-input"
          aria-label={input.inputLabel()}
          class="field-sizing-content text-foreground placeholder:text-muted-foreground min-h-11 max-h-36 w-full resize-none border-0 bg-transparent px-4 py-3 text-sm outline-none disabled:opacity-50"
          value={input.value()}
          onInput={(event) => props.onValueChange(event.currentTarget.value)}
          disabled={input.disabled()}
          readOnly={input.readOnly()}
          placeholder={input.placeholder()}
          rows={1}
          onCompositionStart={input.onCompositionStart}
          onCompositionEnd={input.onCompositionEnd}
          onFocus={input.onFocus}
          onBlur={input.onBlur}
          onKeyDown={input.onKeyDown}
        />
      )}
    />
  )
}
