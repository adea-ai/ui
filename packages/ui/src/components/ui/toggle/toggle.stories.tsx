import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Bold, Italic, Strikethrough, Underline } from 'lucide-solid'
import { Toggle } from './toggle'

/**
 * Toggle.
 *
 * A button that stays pressed. The difference from Button is state, not looks: a
 * Toggle reports `aria-pressed` and holds its pressed appearance until released,
 * which is what makes it right for a formatting control and wrong for a command.
 *
 * Kobalte supplies the pressed state and the keyboard behaviour; the styling adds the
 * one thing a headless primitive cannot know — that a pressed toggle in a toolbar
 * should read as *filled*, not merely outlined.
 */
const meta = {
  title: 'Primitives/Actions/Toggle',
  component: Toggle,
  parameters: { layout: 'padded' },
  argTypes: {
    variant: { control: 'select', options: ['default', 'outline', 'subtle'] },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'icon-sm', 'icon-md', 'icon-lg'],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Toggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Toggle aria-label="Bold">Bold</Toggle>,
}

/** Both states side by side, which is the only way to judge the pressed fill. */
export const States: Story = {
  render: () => (
    <div class="flex items-center gap-3">
      <Toggle aria-label="Not pressed">Not pressed</Toggle>
      <Toggle pressed aria-label="Pressed">
        Pressed
      </Toggle>
      <Toggle disabled aria-label="Disabled">
        Disabled
      </Toggle>
    </div>
  ),
}

/** The three variants. `outline` is for a surface that already has a fill. */
export const Variants: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      {(['default', 'outline', 'subtle'] as const).map((variant) => (
        <div class="flex items-center gap-3">
          <Toggle variant={variant} aria-label={`${variant} off`}>
            {variant} off
          </Toggle>
          <Toggle variant={variant} pressed aria-label={`${variant} on`}>
            {variant} on
          </Toggle>
        </div>
      ))}
    </div>
  ),
}

/** Icon-only toggles in a formatting row, which is the main use. */
export const FormattingRow: Story = {
  render: () => (
    <div class="flex items-center gap-1 rounded-lg border border-border p-1">
      <Toggle size="icon-sm" pressed aria-label="Bold">
        <Bold />
      </Toggle>
      <Toggle size="icon-sm" aria-label="Italic">
        <Italic />
      </Toggle>
      <Toggle size="icon-sm" pressed aria-label="Underline">
        <Underline />
      </Toggle>
      <Toggle size="icon-sm" aria-label="Strikethrough">
        <Strikethrough />
      </Toggle>
    </div>
  ),
}

/** The six sizes, which match the shared control ladder. */
export const Sizes: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-3">
      <Toggle size="sm">sm</Toggle>
      <Toggle size="md">md</Toggle>
      <Toggle size="lg">lg</Toggle>
      <Toggle size="icon-sm" aria-label="Icon sm">
        <Bold />
      </Toggle>
      <Toggle size="icon-md" aria-label="Icon md">
        <Bold />
      </Toggle>
      <Toggle size="icon-lg" aria-label="Icon lg">
        <Bold />
      </Toggle>
    </div>
  ),
}
