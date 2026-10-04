import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/resizable'
import { onCleanup } from 'solid-js'
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
  onCleanup(() => {
    interacting = false
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
        if (!interacting) return
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
        withHandle
        label={props.label ?? `Resize ${props.side} pane`}
        aria-controls={props.controls}
        aria-valuemin={minimum()}
        aria-valuemax={maximum()}
        aria-valuenow={value()}
        aria-valuetext={`${value()} pixels`}
        onHandleDragStart={() => {
          interacting = true
        }}
        onHandleDragEnd={() => {
          if (interacting) commit()
          interacting = false
        }}
        onPointerCancel={() => {
          interacting = false
        }}
        onLostPointerCapture={() => {
          interacting = false
        }}
        onBlur={() => {
          interacting = false
        }}
        onKeyDown={(event) => {
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
            commit()
            interacting = false
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
