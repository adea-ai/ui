/*
 * Controlled atomic token composer translated from KiroCrew ChatInput.tsx and
 * PasteHighlightLayer.tsx at 283e136c0f902e965a535a7c9548c57c7504fed0.
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * Licensed under Apache-2.0; see LICENSE and NOTICE.
 */
import { type ChatComposerSharedProps, type ChatComposerSubmitInput } from '../chat-composer'
import { ChatComposerShell } from '../internal/chat-composer-shell'
import { PasteTokenEditor, type PasteTokenDraft } from '../paste-token-editor'
import { pruneBlocks, type PasteBlock } from '../paste-tokens'

export type ChatComposerPasteTokens = {
  /** Current host-owned backing blocks, paired with `value`. */
  blocks: readonly PasteBlock[]
  /** Synchronous host identity allocation; the UI owns no persistent identity. */
  createBlockId: () => string
  /** One synchronous update for the complete text and surviving blocks. */
  onChange: (draft: PasteTokenDraft) => void
}

export type AtomicChatComposerProps = ChatComposerSharedProps & {
  pasteTokens: ChatComposerPasteTokens
  onSubmit: (input: ChatComposerSubmitInput & { blocks: PasteBlock[] }) => void | Promise<void>
}

/** Atomic editor entry, sharing the plain composer's private composition shell. */
export function AtomicChatComposer(props: AtomicChatComposerProps) {
  return (
    <ChatComposerShell
      {...props}
      createSubmitExtra={({ text }) => ({
        blocks: pruneBlocks(text, [...props.pasteTokens.blocks]).map((block) => ({ ...block })),
      })}
      onSubmit={props.onSubmit}
      renderInput={(input) => (
        <PasteTokenEditor
          ref={input.ref}
          value={input.value()}
          resetKey={input.resetKey()}
          blocks={props.pasteTokens.blocks}
          createBlockId={props.pasteTokens.createBlockId}
          onChange={props.pasteTokens.onChange}
          inputLabel={input.inputLabel()}
          placeholder={input.placeholder()}
          disabled={input.disabled()}
          readOnly={input.readOnly()}
          composing={input.composing}
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
