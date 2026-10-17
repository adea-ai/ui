import { createSignal, For, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { MessageScroller } from '../../src/components/composites/message-scroller'
import { Message, MessageContent, MessageText } from '../../src/components/ui/message'
import '../../src/styles/globals.css'

/**
 * A transcript the spec can drive: append turns, stream into the last one, load
 * older turns in several host timings, and switch conversation. Everything the
 * spec needs to measure is exposed on `window.fixture`.
 */
type Turn = { id: number; lines: number; alt: number }
type LoadMode =
  | 'render-then-resolve'
  | 'resolve-then-render'
  | 'delay-then-render'
  | 'render-after-settle'
  | 'gated'
  | 'noop'

type Probe = { id: string; offset: number; max: number }
type Fixture = {
  mode: LoadMode
  delay: number
  calls: number
  concurrent: number
  maxConcurrent: number
  firstPaintMs: number
  append: (count: number) => void
  stream: (text: string) => void
  setTurnCount: (count: number) => void
  switchTo: (conversation: string) => void
  release: () => void
  setHasOlder: (value: boolean) => void
  turnCount: () => number
  probe: Probe | undefined
  /** The host's saved reading position, read when the conversation changes. */
  saved: { top: number; following: boolean } | undefined
  lastLoad: { turnsBefore: number; turnsAfter: number } | undefined
}
const fixture: Fixture = {
  mode: 'render-then-resolve',
  delay: 300,
  calls: 0,
  concurrent: 0,
  maxConcurrent: 0,
  firstPaintMs: 0,
  append: () => undefined,
  stream: () => undefined,
  setTurnCount: () => undefined,
  switchTo: () => undefined,
  release: () => undefined,
  setHasOlder: () => undefined,
  turnCount: () => 0,
  probe: undefined,
  saved: undefined,
  lastLoad: undefined,
}
;(window as Window & { fixture?: Fixture }).fixture = fixture

const FIRST = 1_000
const make = (from: number, count: number, alt: number): Turn[] =>
  Array.from({ length: count }, (_, index) => {
    const id = from + index
    return { id, lines: 1 + ((id + alt) % 4), alt }
  })

const body = (turn: Turn) =>
  Array.from(
    { length: turn.lines },
    (_, line) => `Turn ${turn.id}, line ${line + 1} of ${turn.lines}.`
  ).join('\n')

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const frames = (count: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
    step(count)
  })

/** The first turn whose bottom edge is below the scroller's top, as the scroller itself picks it. */
function firstVisible(scroller: Element): { id: string; offset: number } | undefined {
  const top = scroller.getBoundingClientRect().top
  for (const element of scroller.querySelectorAll('[data-anchor-id]')) {
    const box = element.getBoundingClientRect()
    if (box.bottom > top)
      return { id: element.getAttribute('data-anchor-id')!, offset: box.top - top }
  }
  return undefined
}

function App() {
  const params = new URLSearchParams(location.search)
  const initial = Number(params.get('turns') ?? 30)
  const [conversation, setConversation] = createSignal('A')
  const [turns, setTurns] = createSignal(make(FIRST, initial, 0))
  const [stream, setStream] = createSignal<string | undefined>()
  const [hasOlder, setHasOlder] = createSignal(true)
  const [loadingOlder, setLoadingOlder] = createSignal(false)
  const [announcement, setAnnouncement] = createSignal('')
  let oldest = FIRST
  let nextId = FIRST + initial
  let gate: (() => void) | undefined
  let sampler = 0

  fixture.append = (count) => {
    setTurns((current) => [...current, ...make(nextId, count, 0)])
    nextId += count
  }
  fixture.stream = (text) => {
    setStream(text)
    setAnnouncement(text ? 'Assistant is responding' : 'Assistant finished')
  }
  fixture.setTurnCount = (count) => {
    oldest = FIRST
    nextId = FIRST + count
    setTurns(make(FIRST, count, 0))
  }
  fixture.switchTo = (next) => {
    oldest = FIRST
    nextId = FIRST + 30
    setStream(undefined)
    setConversation(next)
    setTurns(make(FIRST, 30, next === 'A' ? 0 : 1))
    setHasOlder(true)
  }
  fixture.release = () => gate?.()
  fixture.setHasOlder = setHasOlder
  fixture.turnCount = () => turns().length

  // The scroller measures its anchor before it swaps the "Load earlier" button for
  // the loading line, so the reference is the last reading taken before that swap
  // (a scroll event is dispatched before the observer that starts the load).
  let seen: { id: string; offset: number } | undefined
  document.addEventListener(
    'scroll',
    (event) => {
      if ((event.target as Element | null)?.id === 'scroller') {
        seen = firstVisible(event.target as Element)
      }
    },
    true
  )

  const startProbe = () => {
    const scroller = document.querySelector('#scroller')!
    const reference = seen ?? firstVisible(scroller)
    cancelAnimationFrame(sampler)
    if (!reference) return
    const probe: Probe = { id: reference.id, offset: reference.offset, max: 0 }
    fixture.probe = probe
    const sample = () => {
      const element = scroller.querySelector(`[data-anchor-id="${probe.id}"]`)
      if (element) {
        const now = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top
        probe.max = Math.max(probe.max, Math.abs(now - probe.offset))
      }
      sampler = requestAnimationFrame(sample)
    }
    sample()
  }

  const loadOlder = async () => {
    fixture.calls += 1
    fixture.concurrent += 1
    fixture.maxConcurrent = Math.max(fixture.maxConcurrent, fixture.concurrent)
    startProbe()
    const before = turns().length
    const commit = () => {
      const batch = make(oldest - 10, 10, conversation() === 'A' ? 0 : 1)
      oldest -= 10
      setTurns((current) => [...batch, ...current])
      if (oldest <= FIRST - 50) setHasOlder(false)
      fixture.lastLoad = { turnsBefore: before, turnsAfter: turns().length }
    }
    try {
      switch (fixture.mode) {
        case 'render-then-resolve':
          commit()
          break
        case 'resolve-then-render':
          setTimeout(commit, 0)
          break
        case 'delay-then-render':
          await sleep(fixture.delay)
          commit()
          break
        case 'render-after-settle':
          setLoadingOlder(true)
          setTimeout(() => {
            commit()
            setLoadingOlder(false)
          }, fixture.delay)
          break
        case 'gated':
          await new Promise<void>((resolve) => (gate = resolve))
          commit()
          break
        case 'noop':
          break
      }
    } finally {
      fixture.concurrent -= 1
    }
  }

  return (
    <main class="flex h-128 w-2xl max-w-full flex-col" id="frame">
      <button id="before" type="button">
        Before the thread
      </button>
      <MessageScroller
        id="scroller"
        aria-label="Conversation"
        gutter
        resetKey={conversation()}
        initialReadingPosition={fixture.saved}
        hasOlder={hasOlder()}
        loadingOlder={loadingOlder()}
        onLoadOlder={loadOlder}
        announcement={announcement()}
        empty={<p>No messages yet.</p>}
      >
        <For each={turns()}>
          {(turn) => (
            <Message
              role={turn.id % 2 === 0 ? 'user' : 'assistant'}
              label={turn.id % 2 === 0 ? 'You' : 'Assistant'}
              anchorId={`turn-${turn.id}`}
            >
              <MessageContent>
                <p class="m-0 whitespace-pre-wrap">{body(turn)}</p>
              </MessageContent>
            </Message>
          )}
        </For>
        <Show when={stream() !== undefined}>
          <Message role="assistant" label="Assistant" streaming anchorId="streaming-turn">
            <MessageContent>
              <MessageText text={stream() ?? ''} streaming />
            </MessageContent>
          </Message>
        </Show>
      </MessageScroller>
      <button id="after" type="button">
        After the thread
      </button>
    </main>
  )
}

const start = performance.now()
render(() => <App />, document.body)
void frames(2).then(() => {
  fixture.firstPaintMs = performance.now() - start
})
