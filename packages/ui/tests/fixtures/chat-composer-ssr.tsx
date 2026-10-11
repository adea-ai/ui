import { renderToString } from 'solid-js/web'
import { ChatComposer } from '../../src/components/conversation/chat-composer'
export function renderComposer(collapsed: boolean) {
  return renderToString(() => (
    <ChatComposer
      value="A server-side draft"
      onValueChange={() => undefined}
      onSubmit={() => undefined}
      collapse={{ value: collapsed, onChange: () => undefined }}
      context={<span>Host model context</span>}
    />
  ))
}

export function renderTokenComposer() {
  const block = {
    id: 'node-ssr-1',
    seq: 1,
    lines: 3,
    content: 'first\nsecond\nthird',
  }
  return renderToString(() => (
    <ChatComposer
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
