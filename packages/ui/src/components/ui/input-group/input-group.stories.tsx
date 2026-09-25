import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { AtSign, Eye, Search, X } from 'lucide-solid'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from './input-group'

/**
 * InputGroup.
 *
 * A field with attached chrome: a leading icon, a unit, a trailing button. The point
 * of the component is that the adornments and the input share *one* border and *one*
 * focus ring, so the group reads as a single control. Two separate elements side by
 * side always drift — the ring appears on the wrong box, or the border doubles where
 * they meet.
 *
 * The focus ring therefore lives on the group and follows `focus-within`. A group
 * containing several focusable things still reads as focused once, which is the
 * correct affordance: the user is somewhere inside it.
 */
const meta = {
  title: 'Primitives/Forms/Input Group',
  component: InputGroup,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof InputGroup>

export default meta
type Story = StoryObj<typeof meta>

/** A leading icon. */
export const WithIcon: Story = {
  render: () => (
    <InputGroup class="w-80">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search projects…" aria-label="Search projects" />
    </InputGroup>
  ),
}

/** A trailing button, which is how a clear affordance reads. */
export const WithTrailingButton: Story = {
  render: () => (
    <InputGroup class="w-80">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput value="worktree evidence" aria-label="Search" />
      <InputGroupButton aria-label="Clear search">
        <X />
      </InputGroupButton>
    </InputGroup>
  ),
}

/**
 * A fixed prefix that is not part of the value.
 *
 * `InputGroupText` is text rather than an input, because a prefix the user cannot
 * edit but can accidentally select and delete is a support ticket.
 */
export const WithPrefixAndSuffix: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      <InputGroup class="w-80">
        <InputGroupAddon>
          <AtSign />
        </InputGroupAddon>
        <InputGroupInput placeholder="handle" aria-label="Handle" />
        <InputGroupText>.adea.dev</InputGroupText>
      </InputGroup>
      <InputGroup class="w-80">
        <InputGroupInput type="number" value="8080" aria-label="Port" />
        <InputGroupText>ms</InputGroupText>
      </InputGroup>
    </div>
  ),
}

/** A password field with a reveal control, which must be labelled. */
export const Password: Story = {
  render: () => (
    <InputGroup class="w-80">
      <InputGroupInput type="password" value="correct horse battery staple" aria-label="Password" />
      <InputGroupButton aria-label="Show password">
        <Eye />
      </InputGroupButton>
    </InputGroup>
  ),
}

/** Disabled propagates to the whole group, not only to the input. */
export const Disabled: Story = {
  render: () => (
    <InputGroup class="w-80">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput value="Managed by your organisation" disabled aria-label="Search" />
    </InputGroup>
  ),
}
