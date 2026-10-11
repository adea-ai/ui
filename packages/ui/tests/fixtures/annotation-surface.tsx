import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button'
import {
  AnnotationSurface,
  type AnnotationSurfaceDrag,
  type AnnotationSurfaceRegion,
  type AnnotationSurfaceTool,
} from '../../src/components/ui/annotation-surface'
import '../../src/styles/globals.css'

declare global {
  interface Window {
    annotationSurfacePhases: string[]
    cancelAnnotationSurfacePointer: () => void
    disposeAnnotationSurface: () => void
    resetAnnotationSurface: () => void
    setAnnotationSurfaceInteractive: (value: boolean) => void
    setAnnotationSurfaceTool: (value: AnnotationSurfaceTool) => void
    transferAnnotationSurfaceCapture: () => void
  }
}

function toRegion(drag: AnnotationSurfaceDrag): AnnotationSurfaceRegion {
  const x = Math.min(drag.start.x, drag.current.x)
  const y = Math.min(drag.start.y, drag.current.y)
  return {
    x,
    y,
    width: Math.abs(drag.current.x - drag.start.x),
    height: Math.abs(drag.current.y - drag.start.y),
  }
}

function formatRegion(region: AnnotationSurfaceRegion | undefined): string {
  return region
    ? [region.x, region.y, region.width, region.height].map((value) => value.toFixed(3)).join(',')
    : 'none'
}

function Fixture() {
  const [region, setRegion] = createSignal<AnnotationSurfaceRegion>()
  const [point, setPoint] = createSignal('none')
  const [phases, setPhases] = createSignal<string[]>([])
  const [keys, setKeys] = createSignal<string[]>([])
  const [capture, setCapture] = createSignal('none')
  const [resetKey, setResetKey] = createSignal(0)
  const [interactive, setInteractive] = createSignal(true)
  const [tool, setTool] = createSignal<AnnotationSurfaceTool>('region')
  let surface: HTMLDivElement | undefined
  let captureTransferTarget: HTMLButtonElement | undefined
  let pointerId: number | undefined

  function recordPhase(phase: string) {
    setPhases((current) => {
      const next = [...current, phase]
      window.annotationSurfacePhases = next
      return next
    })
  }

  window.annotationSurfacePhases = []
  window.cancelAnnotationSurfacePointer = () => {
    if (surface && pointerId !== undefined) {
      surface.dispatchEvent(
        new PointerEvent('pointercancel', {
          bubbles: true,
          pointerId,
          pointerType: 'mouse',
        })
      )
    }
  }
  window.resetAnnotationSurface = () => setResetKey((key) => key + 1)
  window.transferAnnotationSurfaceCapture = () => {
    if (captureTransferTarget && pointerId !== undefined) {
      captureTransferTarget.setPointerCapture(pointerId)
    }
  }
  window.setAnnotationSurfaceInteractive = setInteractive
  window.setAnnotationSurfaceTool = setTool

  return (
    <main class="mx-auto grid w-full max-w-3xl gap-2 p-2">
      <AnnotationSurface
        label="Frame preview. Press Space to create a centered region. Arrow keys adjust it; Escape clears it."
        tool={tool()}
        region={region()}
        hint="Drag across the frame or press Space to mark the center."
        interactive={interactive()}
        resetKey={resetKey()}
        ref={(element) => (surface = element)}
        onPoint={(position) => setPoint(`${position.x.toFixed(3)},${position.y.toFixed(3)}`)}
        onDragChange={(drag, phase, event) => {
          recordPhase(phase)
          if (event instanceof PointerEvent) {
            pointerId = event.pointerId
            setCapture(
              event.currentTarget instanceof HTMLDivElement &&
                event.currentTarget.hasPointerCapture(event.pointerId)
                ? 'captured'
                : 'not captured'
            )
          }
          if (phase === 'cancel') setRegion(undefined)
          else if (drag && (phase === 'move' || phase === 'end' || phase === 'keyboard'))
            setRegion(toRegion(drag))
        }}
        onKeyDown={(event) => {
          setKeys((current) => [...current, event.key === ' ' ? 'Space' : event.key])
          if (event.key === 'Escape' && region()) {
            event.preventDefault()
            setRegion(undefined)
            setResetKey((key) => key + 1)
            recordPhase('host-escape')
          }
        }}
      />
      <Button ref={(element) => (captureTransferTarget = element)}>Capture transfer target</Button>
      <output aria-label="Annotation region">{formatRegion(region())}</output>
      <output aria-label="Annotation point">{point()}</output>
      <output aria-label="Pointer capture">{capture()}</output>
      <output aria-label="Interaction phases">{phases().join(',')}</output>
      <output aria-label="Keyboard events">{keys().join(',')}</output>
    </main>
  )
}

window.disposeAnnotationSurface = render(() => <Fixture />, document.body)
