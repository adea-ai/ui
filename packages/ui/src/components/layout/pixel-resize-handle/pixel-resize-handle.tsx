import { GripVertical } from 'lucide-solid'
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
 * reports a bounded pixel value and draws the grip at the matching left or
 * right edge.
 *
 * The ruler is a single separator positioned inside a box as wide as the
 * maximum, so it needs no panel-group geometry (and none of the split-layout
 * code that comes with one): arrow keys move it by `step` along its visual
 * edge, Home and End jump to the bounds, and a pointer drag is captured on the
 * handle so cancellation and lost capture end the gesture.
 */
export function PixelResizeHandle(props: PixelResizeHandleProps) {
  const maximum = () => Math.max(1, props.maximum)
  const minimum = () => Math.min(maximum(), Math.max(0, props.minimum))
  const value = () => Math.min(maximum(), Math.max(minimum(), Math.round(props.value)))
  const isRight = () => props.side === 'right'
  const bounded = (next: number) => Math.min(maximum(), Math.max(minimum(), Math.round(next)))
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
  const move = (next: number) => {
    if (next !== value()) props.onChange(next)
  }
  // Arrow keys describe physical movement of the handle: on a right-edge pane
  // moving the handle left widens the pane.
  const KEY_DIRECTION: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }

  return (
    <div
      class={cn(
        'pointer-events-none absolute inset-y-0',
        {
          'left-0': props.side === 'left',
          'right-0': props.side === 'right',
        },
        props.class
      )}
      style={{ width: `${maximum()}px` }}
    >
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={props.label ?? `Resize ${props.side} pane`}
        aria-controls={props.controls}
        aria-valuemin={minimum()}
        aria-valuemax={maximum()}
        aria-valuenow={value()}
        aria-valuetext={`${value()} pixels`}
        data-dragging={drag() ? '' : undefined}
        style={{ left: `${isRight() ? maximum() - value() : value()}px` }}
        class={cn(
          'group/resize bg-border pointer-events-auto absolute inset-y-0 flex w-px cursor-pointer items-center justify-center',
          /* Widen the hit target without moving the visual line: 24px on the
             drag axis meets WCAG 2.5.8's minimum target. */
          'after:absolute after:inset-y-0 after:-inset-x-3 after:w-6',
          'transition-colors ease-out focus-visible:bg-primary focus-visible:outline-none',
          props.grip === 'chip' ? 'hover:bg-primary' : 'hover:bg-primary/45'
        )}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return
          const handle = event.currentTarget
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
        onPointerMove={(event) => {
          const current = drag()
          if (!current || event.pointerId !== current.pointerId) return
          if (!current.handle.hasPointerCapture(current.pointerId)) {
            endPointer(false)
            return
          }
          const delta = (event.clientX - current.startX) * (isRight() ? -1 : 1)
          move(bounded(current.startValue + delta))
        }}
        onPointerUp={(event) => {
          if (event.pointerId === drag()?.pointerId) endPointer(true)
        }}
        onPointerCancel={(event) => {
          if (event.pointerId === drag()?.pointerId) endPointer(false)
        }}
        onLostPointerCapture={(event) => {
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
          const direction = KEY_DIRECTION[event.key]
          if (direction !== undefined) {
            event.preventDefault()
            interacting = true
            move(bounded(value() + direction * (isRight() ? -1 : 1) * (props.step ?? 16)))
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            interacting = true
            move(event.key === 'Home' ? minimum() : maximum())
          }
        }}
        onKeyUp={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) endKeyboard()
        }}
      >
        {props.grip === 'chip' ? (
          <div class="bg-border z-(--z-docked) flex h-4 w-2.5 items-center justify-center rounded-sm border border-border">
            <GripVertical class="size-2.5 text-muted-foreground" />
          </div>
        ) : (
          <div
            data-slot="resizable-grip"
            class="z-(--z-docked) h-11 w-1.5 flex-none rounded-full bg-border/55"
          />
        )}
      </div>
    </div>
  )
}
