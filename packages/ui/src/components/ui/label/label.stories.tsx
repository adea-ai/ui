import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Input } from '../input/input'
import { Label } from './label'

/**
 * Label.
 *
 * A plain `<label>`, because a free-standing label has to be the real element for
 * the browser's native `for` → control association, click-to-focus, and
 * `aria-labelledby` to keep working. Kobalte has no standalone label primitive —
 * its labels are parts of TextField, Checkbox and friends, carrying the wiring for
 * *their* control.
 *
 * Use the compound controls' own labels (`Switch.Label`, `Checkbox.Label`) when the
 * label belongs to one of them; use this one for an `Input` or `Textarea`.
 */
const meta = {
  title: 'Primitives/Forms/Label',
  component: Label,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div class="flex w-80 flex-col gap-1.5">
      <Label for="label-demo">Branch name</Label>
      <Input id="label-demo" placeholder="feat/…" />
    </div>
  ),
}

/**
 * Clicking the label focuses the control.
 *
 * That is the native behaviour the `for` attribute buys, and the reason a label is
 * not a styled `<span>`.
 */
export const ClickToFocus: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4">
      <div class="flex w-80 flex-col gap-1.5">
        <Label for="label-focus">Click the label above the field</Label>
        <Input id="label-focus" placeholder="Focus lands here" />
      </div>
      <p class="text-sm text-muted-foreground">
        A label that is a span looks identical and does nothing when clicked.
      </p>
    </div>
  ),
}

/** The muted state a label takes inside a disabled group. */
export const DisabledContext: Story = {
  render: () => (
    <div class="flex w-80 flex-col gap-1.5" data-disabled="true">
      <Label for="label-disabled">Managed by your organisation</Label>
      <Input id="label-disabled" value="adea-ai" disabled />
    </div>
  ),
}
