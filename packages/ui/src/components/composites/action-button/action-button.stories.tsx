import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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
