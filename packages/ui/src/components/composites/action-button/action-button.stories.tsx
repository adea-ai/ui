import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Layers, Plus } from 'lucide-solid'
import { ActionButton } from './action-button'

const meta = {
  title: 'Composites/Actions/ActionButton',
  component: ActionButton,
  parameters: { layout: 'padded' },
  args: { children: 'Save changes' },
  tags: ['autodocs'],
} satisfies Meta<typeof ActionButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The tooltip explains an action without supplying its accessible name. */
export const WithTooltip: Story = {
  args: { tooltip: 'Save the current workspace settings' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Save changes' })
    await userEvent.tab()
    await expect(button).toHaveFocus()
    await expect(canvas.getByRole('tooltip')).toHaveTextContent(
      'Save the current workspace settings'
    )
  },
}

/**
 * The explanation can repeat the trigger's glyph through the shared tooltip's
 * `icon` slot, so a bar of icon actions gets the icon+label tip without
 * hand-composing Button and Tooltip. The glyph is decorative: the trigger keeps
 * its own accessible name and the label carries the meaning.
 */
export const WithTooltipIcon: Story = {
  render: () => (
    <ActionButton
      variant="ghost"
      size="icon-md"
      aria-label="Layers"
      tooltip="Show the layer tree"
      tooltipIcon={<Layers />}
    >
      <Layers />
    </ActionButton>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Layers' })
    await userEvent.tab()
    await expect(button).toHaveFocus()
    const tooltip = canvas.getByRole('tooltip')
    await expect(tooltip).toHaveTextContent('Show the layer tree')
    const icon = tooltip.querySelector('[data-slot="tooltip-icon"]')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon?.querySelector('svg')).not.toBeNull()
  },
}

/** Busy feedback preserves the action's name and click handler, then disables repeats. */
const actionSpy = fn()
export const Busy: Story = {
  args: { busy: true, busyLabel: 'Saving workspace', 'aria-label': 'Save changes' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Save changes' })
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('aria-busy', 'true')
    await expect(canvas.getByRole('status')).toHaveTextContent('Saving workspace')
    await userEvent.click(button)
    await expect(actionSpy).not.toHaveBeenCalled()
  },
  render: (args) => <ActionButton {...args} onClick={() => actionSpy()} />,
}

/** Polymorphic actions keep the same tooltip and visual contract on a real link. */
export const AsLink: Story = {
  render: () => (
    <ActionButton as="a" href="#action-button" variant="outline" tooltip="Open the action docs">
      Open documentation
    </ActionButton>
  ),
}

/**
 * The chosen size stays visually compact; coarse-pointer devices receive the
 * stable touch target. Disabled and polymorphic tooltip states keep the same
 * accessible behavior.
 */
export const ComfortableTouchTarget: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-3">
      <ActionButton
        size="icon-md"
        touchTarget="comfortable"
        aria-label="Open details"
        tooltip="Open the selected item details"
      >
        <Plus />
      </ActionButton>
      <ActionButton
        as="a"
        href="#comfortable-action"
        size="icon-md"
        touchTarget="comfortable"
        aria-label="Open documentation"
        tooltip="Open the action documentation"
      >
        <Plus />
      </ActionButton>
      <ActionButton
        size="icon-md"
        touchTarget="comfortable"
        aria-label="Unavailable action"
        disabled
        tooltip="Ask an owner to restore access before continuing"
      >
        <Plus />
      </ActionButton>
    </div>
  ),
}

/** Busy links keep their name, expose their disabled state, and cannot navigate. */
export const BusyLink: Story = {
  render: () => (
    <ActionButton
      as="a"
      href="#busy-action-button"
      aria-label="Export report"
      busy
      busyLabel="Exporting report"
      variant="outline"
      tooltip="Wait for the current export to finish"
    >
      Export
    </ActionButton>
  ),
}

/** Focusable disabled state lets keyboard and pointer users read the explanation. */
export const DisabledWithExplanation: Story = {
  args: {
    disabled: true,
    tooltip: 'Ask a workspace owner to restore access before deleting',
    'aria-label': 'Delete workspace',
  },
}
