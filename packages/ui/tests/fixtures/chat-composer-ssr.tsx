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
