import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Slider } from './slider'

/**
 * Slider.
 *
 * For a value on a continuum where position matters more than precision — a zoom, a
 * volume, a threshold. When the number matters, pass `valueLabel` so the value is
 * both adjustable *and* readable; a bare slider is a control nobody can set exactly.
 *
 * Kobalte handles pointer capture, keyboard stepping and the ARIA value wiring.
 */
const meta = {
  title: 'Primitives/Forms/Slider',
  component: Slider,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Slider>

export default meta
type Story = StoryObj<typeof meta>

/** The default: a single thumb with a live readout. */
export const Default: Story = {
  render: () => (
    <div class="w-80">
      <Slider defaultValue={[40]} valueLabel aria-label="Zoom" />
    </div>
  ),
}

/** A range, for a threshold with two ends. */
export const Range: Story = {
  render: () => (
    <div class="w-80">
      <Slider defaultValue={[20, 70]} valueLabel aria-label="Port range" />
    </div>
  ),
}

/** Stepped, for a value that only lands on integers the system understands. */
export const Stepped: Story = {
  render: () => (
    <div class="flex w-80 flex-col gap-3">
      <Slider
        defaultValue={[2]}
        minValue={1}
        maxValue={5}
        step={1}
        valueLabel
        aria-label="Retries"
      />
      <p class="text-sm text-muted-foreground">
        Five steps, so the thumb can only land on a value the retry policy accepts.
      </p>
    </div>
  ),
}

/** A controlled slider, which is what a persisted preference looks like. */
export const Controlled: Story = {
  render: () => {
    const [value, setValue] = createSignal([60])

    return (
      <div class="flex w-80 flex-col gap-3">
        <Slider value={value()} onChange={setValue} valueLabel aria-label="Opacity" />
        <p class="text-sm text-muted-foreground">Value: {value()[0]}</p>
      </div>
    )
  },
}

/** Disabled, which dims the whole control rather than only the thumb. */
export const Disabled: Story = {
  render: () => (
    <div class="w-80">
      <Slider defaultValue={[75]} disabled aria-label="Not available" />
    </div>
  ),
}
