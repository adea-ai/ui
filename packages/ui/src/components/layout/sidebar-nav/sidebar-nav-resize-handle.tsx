import Resizable from '@corvu/resizable'
import { cn } from '#lib/utils'

export type SidebarNavResizeHandleProps = {
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
 * Resize a contextual sidebar without making its host recreate a separator
 * widget. Corvu owns pointer capture, cancellation, constraints, keyboard
 * movement and cleanup. Its two invisible panels provide a bounded pixel
 * ruler; the host retains the real pane layout and preference persistence.
 * Place this inside the positioned sidebar. The ruler can extend over the
 * adjacent content, but only its handle participates in pointer hit testing.
 */
export function SidebarNavResizeHandle(props: SidebarNavResizeHandleProps) {
  const maximum = () => Math.max(1, props.maximum)
  const minimum = () => Math.min(maximum(), Math.max(0, props.minimum))
  const value = () => Math.min(maximum(), Math.max(minimum(), props.value))
  const commit = () => props.onCommit?.(value())

  return (
    <Resizable
      orientation="horizontal"
      sizes={[value() / maximum(), 1 - value() / maximum()]}
      keyboardDelta={`${props.step ?? 16}px`}
      style={{ width: `${maximum()}px` }}
      class={cn('pointer-events-none absolute inset-y-0 start-0 flex', props.class)}
      onSizesChange={(sizes) => {
        const next = Math.round((sizes[0] ?? 0) * maximum())
        if (next !== value()) props.onChange(Math.min(maximum(), Math.max(minimum(), next)))
      }}
    >
      <Resizable.Panel minSize={minimum() / maximum()} maxSize={1} aria-hidden="true" />
      <Resizable.Handle
        aria-label={props.label ?? 'Resize navigation'}
        aria-controls={props.controls}
        aria-orientation="vertical"
        aria-valuemin={minimum()}
        aria-valuemax={maximum()}
        aria-valuenow={value()}
        onHandleDragEnd={commit}
        onKeyUp={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) commit()
        }}
        class="pointer-events-auto relative z-(--z-docked) w-px -translate-x-full shrink-0 bg-transparent after:absolute after:inset-y-0 after:-inset-x-1 after:w-3 hover:bg-primary focus-visible:bg-primary focus-visible:ring-3 focus-visible:ring-primary-subtle focus-visible:outline-none"
      />
      <Resizable.Panel minSize={0} aria-hidden="true" />
    </Resizable>
  )
}
