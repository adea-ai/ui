import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { MessageBody, MessageRow } from '../../src/components/conversation/message-row'
import { ThreadPanel } from '../../src/components/conversation/thread-panel'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

function Fixture() {
  const [unread, setUnread] = createSignal(0)
  const [closed, setClosed] = createSignal(0)
  return (
    <main>
      <ThreadPanel
        label="Synthetic thread"
        count={1}
        headerActions={
          <Button variant="ghost" size="sm" onClick={() => setUnread((value) => value + 1)}>
            Mark unread
          </Button>
        }
        onClose={() => setClosed((value) => value + 1)}
      >
        <p>A synthetic reply</p>
        {/* Long enough to fill the bubble's maximum width, which is what exposes
        a replies region with no inline padding of its own. */}
        <MessageRow senderKind="agent" senderName="Synthetic agent" time="09:16">
          <MessageBody text="A synthetic agent reply that is long enough to wrap across the full width the panel gives it." />
        </MessageRow>
        <MessageRow senderKind="user" senderName="Synthetic user" time="09:17">
          <MessageBody text="A synthetic user reply that is also long enough to fill the bubble to its widest." />
        </MessageRow>
      </ThreadPanel>
      <output aria-label="Unread count">{unread()}</output>
      <output aria-label="Close count">{closed()}</output>
    </main>
  )
}
render(() => <Fixture />, document.body)
