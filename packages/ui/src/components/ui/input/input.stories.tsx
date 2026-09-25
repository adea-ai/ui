import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Search } from 'lucide-solid'
import { Label } from '../label/label'
import { Input } from './input'

/**
 * Input.
 *
 * Deliberately a plain `<input>` rather than a Kobalte TextField part: the
 * styling contract is what a consumer needs from an input, while validation,
 * description and error wiring come from `Field`, which composes this. Keeping
 * them separate is what lets an input sit inside a custom control without
 * inheriting a form's ARIA graph.
 *
 * Height comes from `h-control-md`. An input cannot be given a new height
 * without a new token, which is what keeps it aligned with Button and Select.
 */
const meta = {
  title: 'Primitives/Forms/Input',
  component: Input,
  parameters: { layout: 'padded' },
  argTypes: {
    type: { control: 'select', options: ['text', 'email', 'password', 'number', 'search', 'url'] },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  args: { placeholder: 'Workspace name' },
  tags: ['autodocs'],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Labelled, described and invalid: what a real field looks like. */
export const States: Story = {
  render: () => (
    <div class="flex w-80 flex-col gap-5">
      <div class="flex flex-col gap-1.5">
        <Label for="input-default">Workspace name</Label>
        <Input id="input-default" placeholder="Adea" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="input-filled">With a value</Label>
        <Input id="input-filled" value="adea-ai/ui" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="input-readonly">Read-only</Label>
        <Input id="input-readonly" value="ws_01H8XYZ" readOnly />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="input-disabled">Disabled</Label>
        <Input id="input-disabled" value="Managed by your organisation" disabled />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="input-invalid">Invalid</Label>
        <Input
          id="input-invalid"
          value="not-a-url"
          aria-invalid="true"
          aria-describedby="input-invalid-error"
        />
        <p id="input-invalid-error" class="text-sm text-destructive">
          Enter a URL beginning with https://
        </p>
      </div>
    </div>
  ),
}

/**
 * The invalid state is `aria-invalid`, not a class.
 *
 * A red border alone is invisible to a screen reader and to anyone who cannot
 * distinguish the hue. The attribute is what carries the state; the border is
 * how it is painted.
 */
export const Invalid: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        The border and the ring both change, and the message is wired through
        <code>aria-describedby</code> so it is announced with the field rather than only being
        visible next to it.
      </p>
      <Input aria-invalid="true" value="adea" class="w-80" aria-label="Workspace name" />
    </div>
  ),
}

/** Placeholder, which is a hint rather than a label. */
export const Placeholder: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4">
      <Input placeholder="Search projects…" class="w-80" aria-label="Search projects" />
      <p class="text-sm text-muted-foreground">
        A placeholder disappears the moment typing starts, so it can never be the only label for a
        field. Every input in the system is expected to have a `Label`, a visually hidden one, or an
        `aria-label`.
      </p>
    </div>
  ),
}

/** Field types, which mostly differ in the platform keyboard and validation. */
export const Types: Story = {
  render: () => (
    <div class="flex w-80 flex-col gap-4">
      <Input type="email" placeholder="you@example.com" aria-label="Email" />
      <Input type="password" placeholder="••••••••" aria-label="Password" />
      <Input type="number" placeholder="8080" aria-label="Port" />
      <Input type="search" placeholder="Search" aria-label="Search" />
    </div>
  ),
}

/**
 * A leading icon, which is the shape of a search field.
 *
 * The wrapper only positions the icon and reserves the space; the input keeps
 * its own border and focus ring, so the field is still one control with one
 * focus target. Where the group should own the border instead, use
 * `InputGroup`.
 */
export const WithLeadingIcon: Story = {
  render: () => (
    <div class="relative w-80">
      <Search class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input placeholder="Search projects…" class="ps-9" aria-label="Search projects" />
    </div>
  ),
}
