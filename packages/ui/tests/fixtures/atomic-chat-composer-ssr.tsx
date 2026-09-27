import { renderToString } from 'solid-js/web'
import { AtomicChatComposer } from '../../src/components/conversation/atomic'

export function renderTokenComposer() {
  const block = {
    id: 'node-ssr-1',
    seq: 1,
    lines: 3,
    content: 'first\nsecond\nthird',
  }
  return renderToString(() => (
    <AtomicChatComposer
      value="[ Paste #1 · 3 lines ]"
      pasteTokens={{
        blocks: [block],
        createBlockId: () => 'node-ssr-2',
        onChange: () => undefined,
      }}
      onSubmit={() => undefined}
      inputLabel="Paste-token server draft"
    />
  ))
}
