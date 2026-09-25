import { Slider as KobalteSlider } from '@kobalte/core/slider'
import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Slider.
 *
 * For a value on a continuum where position matters more than precision — a
 * zoom, a volume, a threshold. When the number matters, pass `valueLabel` so
 * the value is both adjustable *and* readable; a bare slider is a control
 * nobody can set exactly.
 *
 * Kobalte handles pointer capture, keyboard stepping and the ARIA value
 * wiring; this paints the track, fill and thumb.
 */
export type SliderProps = ComponentProps<typeof KobalteSlider> & {
  trackClass?: string
  rangeClass?: string
  thumbClass?: string
  /** Show the current value beside the thumb while dragging. */
  valueLabel?: boolean
}

export function Slider(props: SliderProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'trackClass',
    'rangeClass',
    'thumbClass',
    'valueLabel',
    'children',
    'aria-label',
    'aria-labelledby',
  ])

  return (
    <KobalteSlider
      class={cn(
        'relative flex touch-none flex-col justify-center select-none',
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-5 data-[orientation=horizontal]:w-full',
        'data-[disabled]:opacity-50',
        local.class
      )}
      {...rest}
    >
      <KobalteSlider.Track
        class={cn(
          'bg-input relative grow overflow-hidden rounded-full',
          'data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full',
          'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
          local.trackClass
        )}
      >
        <KobalteSlider.Fill
          class={cn(
            'bg-primary absolute rounded-full',
            'data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full',
            local.rangeClass
          )}
        />
      </KobalteSlider.Track>
      {local.children}
      <KobalteSlider.Thumb
        aria-label={local['aria-label']}
        aria-labelledby={local['aria-labelledby']}
        class={cn(
          'border-primary bg-background block size-4 shrink-0 rounded-full border-2 shadow-xs',
          'transition-[color,box-shadow] ease-out outline-none',
          'hover:ring-4 hover:ring-primary-subtle',
          'focus-visible:ring-4 focus-visible:ring-primary-subtle',
          local.thumbClass
        )}
      >
        <Show when={local.valueLabel}>
          <KobalteSlider.ValueLabel class="bg-popover text-popover-foreground absolute -top-6 left-1/2 -translate-x-1/2 rounded-sm border border-border px-1 text-2xs tabular-nums" />
        </Show>
      </KobalteSlider.Thumb>
    </KobalteSlider>
  )
}
