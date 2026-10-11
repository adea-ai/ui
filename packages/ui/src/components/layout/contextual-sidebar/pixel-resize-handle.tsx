import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../ui/resizable'
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
  const rulerSizes = () => [ratio(), 1 - ratio()]
  const commit = () => props.onCommit?.(value())

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      dir={props.side === 'right' ? 'rtl' : 'ltr'}
      sizes={rulerSizes()}
      keyboardDelta={`${props.step ?? 16}px`}
      style={{ width: `${maximum()}px` }}
      class={cn('pointer-events-none absolute inset-y-0 flex', {
        'start-0': props.side === 'left',
        'end-0': props.side === 'right',
      }, props.class)}
      onSizesChange={(sizes) => {
        const next = Math.round((sizes[0] ?? ratio()) * maximum())
        const bounded = Math.min(maximum(), Math.max(minimum(), next))
        if (bounded !== value()) props.onChange(bounded)
      }}
    >
      <ResizablePanel
        minSize={minimum() / maximum()}
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
        onHandleDragEnd={commit}
        onKeyUp={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) commit()
        }}
        class="pointer-events-auto"
      />
      <ResizablePanel
        minSize={0}
        maxSize={1}
        aria-hidden="true"
      />
    </ResizablePanelGroup>
  )
}
