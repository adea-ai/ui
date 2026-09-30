import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
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
      </ThreadPanel>
      <output aria-label="Unread count">{unread()}</output>
      <output aria-label="Close count">{closed()}</output>
    </main>
  )
}
render(() => <Fixture />, document.body)
