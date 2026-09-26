import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button/button'
import { ConversationSurface } from '../../src/components/conversation/conversation-surface'
import '../../src/styles/globals.css'

function Fixture() {
  const [mounted, setMounted] = createSignal(true)
  const [following, setFollowing] = createSignal(true)
  const [key, setKey] = createSignal('first')
  const [scrollEvents, setScrollEvents] = createSignal(0)
  return (
    <main>
      <div class="flex flex-wrap items-center gap-2 p-2">
        <Button size="sm" variant="outline" onClick={() => setMounted((value) => !value)}>
          Toggle transcript
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={following()}
          onClick={() => setFollowing((value) => !value)}
        >
          Toggle follow
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setKey((value) => (value === 'first' ? 'second' : 'first'))}
        >
          Switch conversation
        </Button>
        <output aria-label="Host scroll events">{scrollEvents()}</output>
      </div>
      <Show when={mounted()}>
        <div class="flex h-96 flex-col">
          <ConversationSurface
            role="region"
            aria-label="Transcript"
            tabindex="0"
            follow={following()}
            resetKey={key()}
            onScroll={() => setScrollEvents((value) => value + 1)}
          >
            {Array.from({ length: 30 }, (_, index) => (
              <p class="p-4">Message {index + 1}</p>
            ))}
            <p data-stream class="whitespace-pre-wrap p-4">
              First chunk
            </p>
          </ConversationSurface>
        </div>
      </Show>
    </main>
  )
}
render(() => <Fixture />, document.body)
