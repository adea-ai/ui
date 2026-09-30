import { createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { Button } from '../../ui/button'
import {
  type FloatingPreviewFrame,
  type FloatingPreviewResizeDirection,
  type FloatingPreviewSize,
  resolveFloatingPreviewFrame,
  resizeFloatingPreview,
} from './model'

const directions: readonly { direction: FloatingPreviewResizeDirection; class: string }[] = [
  {
    direction: 'north',
    class: 'absolute -top-3 right-6 left-6 h-control-xs w-auto cursor-ns-resize touch-none',
  },
  {
    direction: 'south',
    class: 'absolute -bottom-3 right-6 left-6 h-control-xs w-auto cursor-ns-resize touch-none',
  },
  {
    direction: 'east',
    class: 'absolute -right-3 top-6 bottom-6 w-6 h-auto cursor-ew-resize touch-none',
  },
  {
    direction: 'west',
    class: 'absolute -left-3 top-6 bottom-6 w-6 h-auto cursor-ew-resize touch-none',
  },
  {
    direction: 'northwest',
    class: 'absolute -top-3 -left-3 size-control-xs cursor-nwse-resize touch-none',
  },
  {
    direction: 'northeast',
    class: 'absolute -top-3 -right-3 size-control-xs cursor-nesw-resize touch-none',
  },
  {
    direction: 'southwest',
    class: 'absolute -bottom-3 -left-3 size-control-xs cursor-nesw-resize touch-none',
  },
  {
    direction: 'southeast',
    class: 'absolute -bottom-3 -right-3 size-control-xs cursor-nwse-resize touch-none',
  },
]

export type FloatingPreviewProps = {
  label: string
  source: FloatingPreviewSize
  onClose?: () => void
  actions?: JSX.Element
  children: JSX.Element
}

/** A host-bounded movable preview frame. Content and actions remain caller-owned. */
export function FloatingPreview(props: FloatingPreviewProps) {
  const [frame, setFrame] = createSignal<FloatingPreviewFrame>({ x: 0, y: 0, width: 1, height: 1 })
  // oxlint-disable-next-line no-unassigned-vars -- assigned through Solid's ref callback.
  let bounds: HTMLDivElement | undefined
  let observer: ResizeObserver | undefined
  let gesture:
    | {
        id: number
        x: number
        y: number
        start: FloatingPreviewFrame
        direction: FloatingPreviewResizeDirection | null
      }
    | undefined

  const measure = () => {
    const rect = bounds?.getBoundingClientRect()
    if (!rect) return
    setFrame((current) =>
      resolveFloatingPreviewFrame({
        width: current.width > 1 ? current.width : null,
        position: current.width > 1 ? { x: current.x, y: current.y } : null,
        source: props.source,
        container: { width: rect.width, height: rect.height },
      })
    )
  }
  onMount(() => {
    if (bounds) {
      observer = new ResizeObserver(measure)
      observer.observe(bounds)
      measure()
    }
  })
  onCleanup(() => observer?.disconnect())

  function start(event: PointerEvent, direction: FloatingPreviewResizeDirection | null) {
    if (event.button !== 0 || gesture) return
    event.preventDefault()
    event.stopPropagation()
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, start: frame(), direction }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent) {
    if (!gesture || gesture.id !== event.pointerId) return
    const rect = bounds?.getBoundingClientRect()
    if (!rect) return
    const container = { width: rect.width, height: rect.height }
    const delta = { x: event.clientX - gesture.x, y: event.clientY - gesture.y }
    setFrame(
      gesture.direction
        ? resizeFloatingPreview({
            start: gesture.start,
            direction: gesture.direction,
            delta,
            source: props.source,
            container,
          })
        : resolveFloatingPreviewFrame({
            width: gesture.start.width,
            position: { x: gesture.start.x + delta.x, y: gesture.start.y + delta.y },
            source: props.source,
            container,
          })
    )
  }
  function end(event: PointerEvent) {
    if (gesture?.id === event.pointerId) gesture = undefined
  }
  function keyboardMove(event: KeyboardEvent) {
    const delta = { x: 0, y: 0 }
    if (event.key === 'ArrowLeft') delta.x = -10
    else if (event.key === 'ArrowRight') delta.x = 10
    else if (event.key === 'ArrowUp') delta.y = -10
    else if (event.key === 'ArrowDown') delta.y = 10
    else return
    event.preventDefault()
    const rect = bounds?.getBoundingClientRect()
    if (!rect) return
    const current = frame()
    setFrame(
      resolveFloatingPreviewFrame({
        width: current.width,
        position: { x: current.x + delta.x, y: current.y + delta.y },
        source: props.source,
        container: { width: rect.width, height: rect.height },
      })
    )
  }
  function keyboardResize(event: KeyboardEvent, direction: FloatingPreviewResizeDirection) {
    if (!event.key.startsWith('Arrow')) return
    event.preventDefault()
    const rect = bounds?.getBoundingClientRect()
    if (!rect) return
    const delta = {
      x: event.key === 'ArrowRight' ? 10 : event.key === 'ArrowLeft' ? -10 : 0,
      y: event.key === 'ArrowDown' ? 10 : event.key === 'ArrowUp' ? -10 : 0,
    }
    setFrame(
      resizeFloatingPreview({
        start: frame(),
        direction,
        delta,
        source: props.source,
        container: { width: rect.width, height: rect.height },
      })
    )
  }

  return (
    <div
      ref={bounds}
      class="pointer-events-none absolute inset-0 z-(--z-tooltip) overflow-hidden"
      aria-label={props.label}
    >
      <section
        class="pointer-events-auto absolute flex flex-col overflow-visible rounded-lg border border-border bg-card text-card-foreground shadow-lg"
        aria-label={props.label}
        style={{
          left: `${frame().x}px`,
          top: `${frame().y}px`,
          width: `${frame().width}px`,
          height: `${frame().height}px`,
        }}
      >
        <header class="flex h-control-sm items-center gap-1 border-b border-border p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="flex-1 cursor-move touch-none"
            aria-label={`Move ${props.label}`}
            onPointerDown={(event) => start(event, null)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onLostPointerCapture={end}
            onKeyDown={keyboardMove}
          >
            Move
          </Button>
          <div class="flex items-center gap-1">{props.actions}</div>
          {props.onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Close ${props.label}`}
              onClick={props.onClose}
            >
              ×
            </Button>
          )}
        </header>
        <div class="min-h-0 flex-1 overflow-auto">{props.children}</div>
        {directions.map(({ direction, class: className }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            class={className}
            data-direction={direction}
            aria-label={`Resize ${props.label} ${direction}`}
            onPointerDown={(event) => start(event, direction)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onLostPointerCapture={end}
            onKeyDown={(event) => keyboardResize(event, direction)}
          />
        ))}
      </section>
    </div>
  )
}
