import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { AccentPicker } from './accent-picker'

/**
 * AccentPicker.
 *
 * Swatches for a setting that may override an inherited accent. The leading
 * "none" swatch is a real choice: it means "do not override", so the group
 * always has exactly one checked swatch and the user can always get back to
 * inheriting. Choose `AppearanceEditor` for the app's own theme; this is for a
 * single entity, such as a project's icon colour.
 */
const meta = {
  title: 'Composites/Accent picker',
  component: AccentPicker,
  parameters: { layout: 'padded' },
  args: { label: 'Icon colour', value: null, onValueChange: () => {} },
  tags: ['autodocs'],
} satisfies Meta<typeof AccentPicker>

export default meta
type Story = StoryObj<typeof meta>

/** No override: the entity follows the workspace accent. */
export const Inherit: Story = {
  render: () => {
    const [value, setValue] = createSignal<string | null>(null)
    return (
      <AccentPicker
        label="Icon colour"
        inheritLabel="Inherit workspace accent"
        value={value()}
        onValueChange={setValue}
      />
    )
  },
}

/** An explicit choice, which the "none" swatch can undo. */
export const Chosen: Story = {
  render: () => {
    const [value, setValue] = createSignal<string | null>('pink')
    return <AccentPicker label="Icon colour" value={value()} onValueChange={setValue} />
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}
