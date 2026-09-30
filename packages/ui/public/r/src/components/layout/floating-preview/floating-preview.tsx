import { createEffect, createSignal, onCleanup, onMount, on, type JSX } from 'solid-js'
import { Move, X } from 'lucide-solid'
import { ActionButton } from '../../composites/action-button'
import { ScrollArea } from '../../ui/scroll-area'
import {
  type FloatingPreviewFrame,
  type FloatingPreviewResizeDirection,
  type FloatingPreviewSize,
  resolveFloatingPreviewFrame,
  resizeFloatingPreview,
} from './model'

const directions: readonly {
  direction: FloatingPreviewResizeDirection
  class: string
  glyph: string
}[] = [
  {
    direction: 'north',
    class: 'absolute -top-3 right-6 left-6 h-control-xs w-auto cursor-ns-resize touch-none',
    glyph: '↕',
  },
  {
    direction: 'south',
    class: 'absolute -bottom-3 right-6 left-6 h-control-xs w-auto cursor-ns-resize touch-none',
    glyph: '↕',
  },
  {
    direction: 'east',
    class: 'absolute -right-3 top-6 bottom-6 w-6 h-auto cursor-ew-resize touch-none',
    glyph: '↔',
  },
  {
    direction: 'west',
    class: 'absolute -left-3 top-6 bottom-6 w-6 h-auto cursor-ew-resize touch-none',
    glyph: '↔',
  },
  {
    direction: 'northwest',
    class: 'absolute -top-3 -left-3 size-control-xs cursor-nwse-resize touch-none',
    glyph: '↖',
  },
  {
    direction: 'northeast',
    class: 'absolute -top-3 -right-3 size-control-xs cursor-nesw-resize touch-none',
    glyph: '↗',
  },
  {
    direction: 'southwest',
    class: 'absolute -bottom-3 -left-3 size-control-xs cursor-nesw-resize touch-none',
    glyph: '↙',
  },
  {
    direction: 'southeast',
    class: 'absolute -bottom-3 -right-3 size-control-xs cursor-nwse-resize touch-none',
    glyph: '↘',
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
  createEffect(
    on(
      () => [props.source.width, props.source.height] as const,
      () => measure(),
      { defer: true }
    )
  )
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
      class="pointer-events-none absolute inset-0 z-(--z-sticky) overflow-hidden"
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
          <ActionButton
            type="button"
            variant="ghost"
            size="sm"
            class="flex-1 cursor-move touch-none"
            aria-label={`Move ${props.label}`}
            tooltip={`Move ${props.label}. Use arrow keys to adjust its position.`}
            onPointerDown={(event) => start(event, null)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onLostPointerCapture={end}
            onKeyDown={keyboardMove}
          >
            <>
              <Move aria-hidden="true" />
              Move
            </>
          </ActionButton>
          <div class="flex items-center gap-1">{props.actions}</div>
          {props.onClose && (
            <ActionButton
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Close ${props.label}`}
              tooltip={`Close ${props.label}.`}
              onClick={props.onClose}
            >
              <X aria-hidden="true" />
            </ActionButton>
          )}
        </header>
        <ScrollArea role="region" aria-label={`${props.label} content`} class="flex-1" tabIndex={0}>
          {props.children}
        </ScrollArea>
        {directions.map(({ direction, class: className, glyph }) => (
          <ActionButton
            type="button"
            variant="ghost"
            size="icon-sm"
            class={className}
            data-direction={direction}
            aria-label={`Resize ${props.label} ${direction}`}
            tooltip={`Resize ${props.label} from the ${direction} edge. Use arrow keys to resize.`}
            onPointerDown={(event) => start(event, direction)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onLostPointerCapture={end}
            onKeyDown={(event) => keyboardResize(event, direction)}
          >
            <span aria-hidden="true">{glyph}</span>
          </ActionButton>
        ))}
      </section>
    </div>
  )
}
