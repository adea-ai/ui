import { createSignal, onCleanup, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button/button'
import {
  SceneControls,
  type SceneControlLabels,
  type SceneControlsProps,
  type SceneMovementDirection,
} from '../../src/components/composites/scene-controls/scene-controls'
import '../../src/styles/globals.css'

type MovementCallback = NonNullable<SceneControlsProps['onMovementChange']>

declare global {
  interface Window {
    sceneControlsFixture?: {
      unmount: () => void
      replaceMovementCallback: () => void
      disableMovement: () => void
      setLocalizedLabels: () => void
    }
  }
}

function Fixture() {
  const [mounted, setMounted] = createSignal(true)
  const [events, setEvents] = createSignal<string[]>([])
  const [replacementEvents, setReplacementEvents] = createSignal<string[]>([])
  const [zoomCount, setZoomCount] = createSignal(0)
  const [labels, setLabels] = createSignal<Partial<SceneControlLabels>>()
  const record = (event: string) => setEvents((current) => [...current, event])
  const initialMovementCallback: MovementCallback = (direction, pressed) =>
    record(`${direction}:${pressed ? 'down' : 'up'}`)
  const replacementMovementCallback: MovementCallback = (
    direction: SceneMovementDirection,
    pressed: boolean
  ) => setReplacementEvents((current) => [...current, `${direction}:${pressed ? 'down' : 'up'}`])
  const [movementCallback, setMovementCallback] = createSignal<MovementCallback | undefined>(
    initialMovementCallback
  )

  window.sceneControlsFixture = {
    unmount: () => setMounted(false),
    replaceMovementCallback: () => setMovementCallback(() => replacementMovementCallback),
    disableMovement: () => setMovementCallback(undefined),
    setLocalizedLabels: () =>
      setLabels({ forward: 'Avanzar', forwardTooltip: 'Mantén para avanzar' }),
  }
  onCleanup(() => {
    delete window.sceneControlsFixture
  })

  return (
    <main>
      <h1 class="visually-hidden">Scene controls test page</h1>
      <Show when={mounted()}>
        <SceneControls
          labels={labels()}
          onMovementChange={movementCallback()}
          onJumpChange={(pressed) => record(`jump:${pressed ? 'down' : 'up'}`)}
          onZoomIn={() => setZoomCount((count) => count + 1)}
          onZoomOut={() => setZoomCount((count) => count + 1)}
        />
      </Show>
      <div class="flex max-w-full flex-wrap gap-2">
        <Button
          id="scene-controls-capture-transfer"
          aria-label="Capture transfer target"
          onClick={(event) => event.preventDefault()}
        >
          Transfer
        </Button>
        <Button onClick={() => window.sceneControlsFixture?.unmount()}>Unmount controls</Button>
      </div>
      <output aria-label="Interaction events">{events().join(',')}</output>
      <output aria-label="Replacement events">{replacementEvents().join(',')}</output>
      <output aria-label="Zoom activations">{zoomCount()}</output>
    </main>
  )
}

render(() => <Fixture />, document.body)
