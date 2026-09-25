import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Separator } from './separator'

/**
 * Separator.
 *
 * Renders `role="separator"` with the right orientation, so a screen reader
 * understands it as a boundary rather than as an empty element. A plain `<div>` with
 * a border looks identical and announces nothing.
 */
const meta = {
  title: 'Primitives/Data display/Separator',
  component: Separator,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

/** Horizontal: the default, and the one a menu or a panel header uses. */
export const Horizontal: Story = {
  render: () => (
    <div class="w-96">
      <div class="py-3 text-sm">Above the rule</div>
      <Separator />
      <div class="py-3 text-sm">Below the rule</div>
    </div>
  ),
}

/** Dashed, for an "or" between alternative paths rather than a boundary. */
export const Dashed: Story = {
  render: () => (
    <div class="flex w-96 flex-col gap-3">
      <div class="text-sm">Sign in with your workspace</div>
      <Separator variant="dashed" />
      <div class="text-sm">Or continue as a guest</div>
    </div>
  ),
}

/** Vertical, for dividing items in a toolbar row. */
export const Vertical: Story = {
  render: () => (
    <div class="flex h-8 items-center gap-3">
      <span class="text-sm">Bold</span>
      <Separator orientation="vertical" />
      <span class="text-sm">Italic</span>
      <Separator orientation="vertical" />
      <span class="text-sm">Underline</span>
    </div>
  ),
}
