import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/resizable'
import { createSignal, onCleanup } from 'solid-js'
import { cn } from '#lib/utils'

export type PixelResizeHandleProps = {
  /** Which physical edge of the ruler the resizable surface is attached to. */
  side: 'left' | 'right'
  /** Current width in CSS pixels. */
  value: number
  minimum: number
  maximum: number
  step?: number
  label?: string
  controls?: string
  class?: string
  /**
   * The grip drawn on the edge: the quieter rung by default, or the bordered
   * chip for hosts that want the heavier affordance.
   */
  grip?: 'chip' | 'rung'
  onChange(value: number): void
  onCommit?(value: number): void
}

/**
 * PixelResizeHandle.
 *
 * A keyboard- and pointer-operable edge ruler for a host-owned pane. Keep the
 * pane's actual width and any persistence in its layout owner; this component
 * reports a bounded pixel value and places the shared resizable grip at the
 * matching left or right edge.
 *
 * Corvu 0.2.5 supplies geometry, keyboard resizing, ARIA and the shared grip,
 * but its global drag handler does not end on pointer cancellation. Prevent
 * that handler through its public start hook and use local pointer capture
 * for bounded pixel gestures, including cancellation and lost capture.
 */
export function PixelResizeHandle(props: PixelResizeHandleProps) {
  const maximum = () => Math.max(1, props.maximum)
  const minimum = () => Math.min(maximum(), Math.max(0, props.minimum))
  const value = () => Math.min(maximum(), Math.max(minimum(), Math.round(props.value)))
  const ratio = () => value() / maximum()
  const isRight = () => props.side === 'right'
  const rulerSizes = () => (isRight() ? [1 - ratio(), ratio()] : [ratio(), 1 - ratio()])
  const commit = () => props.onCommit?.(value())
  let interacting = false
  const [drag, setDrag] = createSignal<{
    pointerId: number
    startX: number
    startValue: number
    handle: HTMLElement
  }>()
  const endPointer = (shouldCommit: boolean) => {
    const current = drag()
    if (!current) return
    setDrag(undefined)
    if (current.handle.hasPointerCapture(current.pointerId))
      current.handle.releasePointerCapture(current.pointerId)
    if (shouldCommit) commit()
  }
  const endKeyboard = () => {
    const wasInteracting = interacting
    interacting = false
    if (wasInteracting) commit()
  }
  onCleanup(() => {
    endKeyboard()
    endPointer(false)
  })

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      dir="ltr"
      sizes={rulerSizes()}
      keyboardDelta={`${props.step ?? 16}px`}
      style={{ width: `${maximum()}px` }}
      class={cn(
        'pointer-events-none absolute inset-y-0 flex',
        {
          'left-0': props.side === 'left',
          'right-0': props.side === 'right',
        },
        props.class
      )}
      onSizesChange={(sizes) => {
        // Panel registration and teardown also emit sizes. Only user resizing
        // may update the host preference; collapsing must preserve its width.
        if (!interacting || sizes.length !== 2) return
        const next = Math.round((sizes[isRight() ? 1 : 0] ?? ratio()) * maximum())
        const bounded = Math.min(maximum(), Math.max(minimum(), next))
        if (bounded !== value()) props.onChange(bounded)
      }}
    >
      <ResizablePanel
        minSize={isRight() ? 0 : minimum() / maximum()}
        maxSize={1}
        aria-hidden="true"
      />
      <ResizableHandle
        withHandle={props.grip === 'chip' ? true : 'rung'}
        label={props.label ?? `Resize ${props.side} pane`}
        aria-controls={props.controls}
        aria-valuemin={minimum()}
        aria-valuemax={maximum()}
        aria-valuenow={value()}
        aria-valuetext={`${value()} pixels`}
        data-dragging={drag() ? '' : undefined}
        onHandleDragStart={(event) => {
          // Corvu checks defaultPrevented before starting its global handler.
          event.preventDefault()
          if (event.button !== 0 || !event.isPrimary) return
          const handle = event.currentTarget
          if (!(handle instanceof HTMLElement)) return
          endPointer(false)
          interacting = false
          handle.focus()
          handle.setPointerCapture(event.pointerId)
          setDrag({
            pointerId: event.pointerId,
            startX: event.clientX,
            startValue: value(),
            handle,
          })
        }}
        onPointerMove={(event: PointerEvent) => {
          const current = drag()
          if (!current || event.pointerId !== current.pointerId) return
          if (!current.handle.hasPointerCapture(current.pointerId)) {
            endPointer(false)
            return
          }
          const delta = (event.clientX - current.startX) * (isRight() ? -1 : 1)
          const next = Math.min(
            maximum(),
            Math.max(minimum(), Math.round(current.startValue + delta))
          )
          if (next !== value()) props.onChange(next)
        }}
        onPointerUp={(event: PointerEvent) => {
          if (event.pointerId === drag()?.pointerId) endPointer(true)
        }}
        onPointerCancel={(event: PointerEvent) => {
          if (event.pointerId === drag()?.pointerId) endPointer(false)
        }}
        onLostPointerCapture={(event: PointerEvent) => {
          if (event.pointerId === drag()?.pointerId) endPointer(false)
        }}
        onBlur={() => {
          endKeyboard()
          endPointer(false)
        }}
        onKeyDown={(event) => {
          const current = drag()
          if (current && !current.handle.hasPointerCapture(current.pointerId)) endPointer(false)
          if (drag()) {
            event.preventDefault()
            return
          }
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) interacting = true
          // Corvu operates on physical panel order. Home/End here describe
          // the controlled pane width, including a pane after the separator.
          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            props.onChange(event.key === 'Home' ? minimum() : maximum())
          }
        }}
        onKeyUp={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            endKeyboard()
          }
        }}
        class="pointer-events-auto"
      />
      <ResizablePanel
        minSize={isRight() ? minimum() / maximum() : 0}
        maxSize={1}
        aria-hidden="true"
      />
    </ResizablePanelGroup>
  )
}
