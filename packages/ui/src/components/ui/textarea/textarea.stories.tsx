import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Label } from '../label/label'
import { Textarea } from './textarea'

/**
 * Textarea.
 *
 * Shares the Input's border, focus and invalid treatment exactly — the two are the
 * same control at different aspect ratios, and a form that mixes them must not show
 * a seam between them.
 *
 * `field-sizing: content` lets the element grow with its content where the engine
 * supports it, which is the behaviour a composer wants; `rows` remains the fallback
 * so an unsupported engine still gets a usable height.
 */
const meta = {
  title: 'Primitives/Forms/Textarea',
  component: Textarea,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div class="flex w-96 flex-col gap-1.5">
      <Label for="textarea-demo">Objective</Label>
      <Textarea id="textarea-demo" placeholder="What should this session accomplish?" />
    </div>
  ),
}

/** With content, at the minimum height. */
export const WithValue: Story = {
  render: () => (
    <Textarea
      class="w-96"
      value="Materialise worktrees with copy-on-write and record a content digest in the manifest."
      aria-label="Objective"
    />
  ),
}

/** A fixed height, for a form that must not reflow as the user types. */
export const FixedRows: Story = {
  render: () => (
    <Textarea
      class="w-96 field-sizing-fixed"
      rows={6}
      placeholder="Paste a diff here"
      aria-label="Diff"
    />
  ),
}

/** Invalid, with the message wired through `aria-describedby`. */
export const Invalid: Story = {
  render: () => (
    <div class="flex w-96 flex-col gap-1.5">
      <Label for="textarea-invalid">Commit message</Label>
      <Textarea
        id="textarea-invalid"
        value="wip"
        aria-invalid="true"
        aria-describedby="textarea-invalid-error"
      />
      <p id="textarea-invalid-error" class="text-sm text-destructive">
        A commit message needs at least 12 characters.
      </p>
    </div>
  ),
}

/** Disabled, which removes it from the pointer path entirely. */
export const Disabled: Story = {
  render: () => (
    <Textarea class="w-96" value="Locked while the run is in flight." disabled aria-label="Notes" />
  ),
}
