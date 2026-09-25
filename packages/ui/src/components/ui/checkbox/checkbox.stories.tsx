import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Button } from '../button/button'
import { Checkbox, CheckboxDescription, CheckboxLabel } from './checkbox'

/**
 * Checkbox.
 *
 * Three states: unchecked, checked and indeterminate. Indeterminate is what a
 * "select all" box shows when only some rows are selected, and Kobalte expresses
 * it through `checked="indeterminate"` rather than a second boolean, so there is
 * no way to render a box that is both.
 *
 * The paint is the control; the value is a real hidden input behind it. So the
 * control participates in a form submission and in native validation while
 * looking nothing like a browser checkbox.
 */
const meta = {
  title: 'Primitives/Forms/Checkbox',
  component: Checkbox,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Checkbox aria-label="Subscribe to release notes" />,
}

/** With a label and a description, which is the form this actually takes. */
export const Labelled: Story = {
  render: () => (
    <Checkbox>
      <CheckboxLabel>Run the soak lane nightly</CheckboxLabel>
      <CheckboxDescription>
        Starts at 02:00 local time and stops if the budget is exceeded.
      </CheckboxDescription>
    </Checkbox>
  ),
}

/**
 * All three states.
 *
 * The indeterminate box is not "partially checked" in a visual sense — it is a
 * distinct state that says "some of the things below are selected". A caller
 * must compute it; the platform will not.
 */
export const States: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      <Checkbox aria-label="Unchecked" />
      <Checkbox aria-label="Checked" checked />
      <Checkbox aria-label="Partially selected" indeterminate checked="indeterminate" />
      <Checkbox aria-label="Invalid" aria-invalid="true" />
      <Checkbox aria-label="Disabled" disabled />
      <Checkbox aria-label="Disabled and checked" disabled checked />
    </div>
  ),
}

/**
 * A select-all header with its children, which is the only reason the
 * indeterminate state exists.
 */
export const SelectAll: Story = {
  render: () => {
    const [selected, setSelected] = createSignal<string[]>(['alpha'])

    const all = ['alpha', 'beta', 'gamma']
    const toggle = (name: string) => {
      const next = selected().includes(name)
        ? selected().filter((n) => n !== name)
        : [...selected(), name]
      setSelected(next)
    }

    const state = () => {
      if (selected().length === 0) return false
      if (selected().length === all.length) return true
      return 'indeterminate' as const
    }

    return (
      <div class="flex w-72 flex-col gap-3 rounded-xl border border-border p-4">
        <Checkbox checked={state()} onChange={(next: boolean) => setSelected(next ? all : [])}>
          <CheckboxLabel>All environments</CheckboxLabel>
        </Checkbox>
        <div class="flex flex-col gap-3 ps-7">
          {all.map((name) => (
            <Checkbox
              aria-label={name}
              checked={selected().includes(name)}
              onChange={() => toggle(name)}
            >
              <CheckboxLabel>{name}</CheckboxLabel>
            </Checkbox>
          ))}
        </div>
      </div>
    )
  },
}

/**
 * A checkbox inside an unsaved form: the value is composed and applied on
 * submit, which is the distinction between a Checkbox and a Switch. A Switch
 * applies immediately; a Checkbox is a value the user is still building.
 */
export const InAForm: Story = {
  render: () => (
    <div class="flex w-80 flex-col gap-4 rounded-xl border border-border p-4">
      <div class="flex flex-col gap-3">
        <Checkbox defaultChecked>
          <CheckboxLabel>Include screenshots</CheckboxLabel>
        </Checkbox>
        <Checkbox>
          <CheckboxLabel>Include a coverage report</CheckboxLabel>
        </Checkbox>
        <Checkbox>
          <CheckboxLabel>Notify the team channel</CheckboxLabel>
        </Checkbox>
      </div>
      <div class="flex gap-2">
        <Button size="sm">Save report</Button>
        <Button size="sm" variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  ),
}
