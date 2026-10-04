import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import {
  AnnotationSurface,
  type AnnotationSurfaceDrag,
  type AnnotationSurfaceRegion,
} from './annotation-surface'

const meta = {
  title: 'UI/Annotation Surface',
  component: AnnotationSurface,
  args: {
    label: 'Frame preview. Press Space to create a centered region.',
    tool: 'region',
  },
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A host-owned drawing viewport. Space creates a centered region (or point in point mode); pointer drags report normalized coordinates. The host owns arrow, submit, cancel, and persistence behavior.',
      },
    },
  },
} satisfies Meta<typeof AnnotationSurface>

export default meta
type Story = StoryObj<typeof meta>

function regionFromDrag(drag: AnnotationSurfaceDrag): AnnotationSurfaceRegion {
  const x = Math.min(drag.start.x, drag.current.x)
  const y = Math.min(drag.start.y, drag.current.y)
  return {
    x,
    y,
    width: Math.abs(drag.current.x - drag.start.x),
    height: Math.abs(drag.current.y - drag.start.y),
  }
}

function InteractiveRegion() {
  const [region, setRegion] = createSignal<AnnotationSurfaceRegion>()
  const [resetKey, setResetKey] = createSignal(0)
  const [status, setStatus] = createSignal('No region selected.')

  function handleDrag(
    drag: AnnotationSurfaceDrag | undefined,
    phase: 'start' | 'move' | 'end' | 'cancel' | 'keyboard'
  ) {
    if (phase === 'cancel') {
      setRegion(undefined)
      setStatus('Draft cleared.')
      return
    }
    if (!drag) return
    if (phase === 'keyboard' || phase === 'end' || phase === 'move') {
      setRegion(regionFromDrag(drag))
      setStatus(phase === 'keyboard' ? 'Centered keyboard region selected.' : 'Region selected.')
    }
  }

  return (
    <div class="grid w-full max-w-2xl gap-2">
      <AnnotationSurface
        label="Frame preview. Press Space to create a centered region. Arrow keys adjust it; Escape clears it."
        tool="region"
        region={region()}
        hint="Drag across the frame or press Space to mark the center."
        resetKey={resetKey()}
        onDragChange={handleDrag}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && region()) {
            event.preventDefault()
            setRegion(undefined)
            setResetKey((key) => key + 1)
            setStatus('Draft cleared by the host.')
            return
          }

          const delta = 0.01
          const offset = {
            ArrowLeft: { x: -delta, y: 0 },
            ArrowRight: { x: delta, y: 0 },
            ArrowUp: { x: 0, y: -delta },
            ArrowDown: { x: 0, y: delta },
          }[event.key]
          const current = region()
          if (!offset || !current) return

          event.preventDefault()
          setRegion({
            ...current,
            x: Math.min(Math.max(current.x + offset.x, 0), 1 - current.width),
            y: Math.min(Math.max(current.y + offset.y, 0), 1 - current.height),
          })
          setStatus('Region moved with the arrow keys.')
        }}
      />
      <p class="text-xs text-muted-foreground" role="status" aria-live="polite">
        {status()}
      </p>
    </div>
  )
}

export const Default: Story = {
  render: () => <InteractiveRegion />,
}

export const ExistingRegion: Story = {
  render: () => (
    <AnnotationSurface
      label="Frame preview with an existing region. Press Space to replace it."
      tool="region"
      region={{ x: 0.18, y: 0.22, width: 0.42, height: 0.46 }}
      hint="A host-provided region is shown in the frame."
      onDragChange={() => undefined}
    />
  ),
}

export const PointPlacement: Story = {
  render: () => <PointPlacementExample />,
}

function PointPlacementExample() {
  const [point, setPoint] = createSignal<{ x: number; y: number }>()

  return (
    <div class="grid w-full max-w-2xl gap-2">
      <AnnotationSurface
        label="Frame preview. Click or press Space to place a note anchor at the center."
        tool="point"
        hint="Click the frame or press Space to place a note anchor."
        onPoint={setPoint}
      />
      <p class="text-xs text-muted-foreground" role="status" aria-live="polite">
        {point()
          ? `Anchor at ${point()!.x.toFixed(2)}, ${point()!.y.toFixed(2)}.`
          : 'No point placed.'}
      </p>
    </div>
  )
}
