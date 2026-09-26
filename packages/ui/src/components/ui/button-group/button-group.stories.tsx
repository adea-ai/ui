import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Bold, ChevronDown, Italic, Underline } from 'lucide-solid'
import { Button } from '../button/button'
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from './button-group'

/**
 * ButtonGroup.
 *
 * Several controls acting as one. The point is the join: the items share a border,
 * collapse the seam between them, and round only at the ends, so the row reads as a
 * single object with segments rather than as buttons that happen to be adjacent.
 *
 * The joining lives on the group, so an item never has to know whether it sits at an
 * end — and a group composed of a Button, a Select and an InputGroup gets the same
 * treatment without those components knowing about it.
 */
const meta = {
  title: 'Primitives/Actions/Button Group',
  component: ButtonGroup,
  parameters: { layout: 'padded' },
  args: { label: 'Actions' },
  tags: ['autodocs'],
} satisfies Meta<typeof ButtonGroup>

export default meta
type Story = StoryObj<typeof meta>

/** A joined run, which is the shape a segmented action takes. */
export const Default: Story = {
  render: () => (
    <ButtonGroup label="Text formatting">
      <Button variant="outline">
        <Bold />
        Bold
      </Button>
      <Button variant="outline">
        <Italic />
        Italic
      </Button>
      <Button variant="outline">
        <Underline />
        Underline
      </Button>
    </ButtonGroup>
  ),
}

/** A split button: one action, with a menu beside it. */
export const SplitButton: Story = {
  render: () => (
    <ButtonGroup label="Run">
      <Button>Run lane</Button>
      <ButtonGroupSeparator />
      <Button size="icon-md" aria-label="Run options">
        <ChevronDown />
      </Button>
    </ButtonGroup>
  ),
}

/** A readout that is not a control, sitting in the row as a peer. */
export const WithText: Story = {
  render: () => (
    <ButtonGroup label="Zoom">
      <ButtonGroupText>Zoom</ButtonGroupText>
      <Button variant="outline">−</Button>
      <Button variant="outline">100%</Button>
      <Button variant="outline">+</Button>
    </ButtonGroup>
  ),
}

/** Vertical, for a stack of related actions in a narrow column. */
export const Vertical: Story = {
  render: () => (
    <ButtonGroup label="Commit" orientation="vertical">
      <Button variant="outline">Commit</Button>
      <Button variant="outline">Commit and push</Button>
      <Button variant="outline">Amend</Button>
    </ButtonGroup>
  ),
}
