import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from 'lucide-solid'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'

/**
 * ToggleGroup.
 *
 * A set of related toggles that behave as one control: at most one pressed
 * (`multiple={false}`, the default) or any number (`multiple={true}`). The group owns
 * the selection and the roving focus, which is what makes arrow keys move between
 * items and a screen reader announce the position within the set. A row of
 * independent Toggles looks identical and does neither.
 */
const meta = {
  title: 'Primitives/Actions/Toggle Group',
  component: ToggleGroup,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof ToggleGroup>

export default meta
type Story = StoryObj<typeof meta>

/** Single selection: a segmented control in the attached form. */
export const SingleSelection: Story = {
  render: () => (
    <ToggleGroup attached defaultValue={['left']} aria-label="Alignment">
      <ToggleGroupItem value="left" size="icon-sm" aria-label="Align left">
        <AlignLeft />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" size="icon-sm" aria-label="Align centre">
        <AlignCenter />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" size="icon-sm" aria-label="Align right">
        <AlignRight />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}

/** Multiple selection: a formatting row, where several can be on at once. */
export const MultipleSelection: Story = {
  render: () => (
    <ToggleGroup multiple defaultValue={['bold']} aria-label="Formatting">
      <ToggleGroupItem value="bold" size="icon-sm" aria-label="Bold">
        <Bold />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" size="icon-sm" aria-label="Italic">
        <Italic />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" size="icon-sm" aria-label="Underline">
        <Underline />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}

/**
 * The two layouts: attached (one rounded run) and spaced (discrete controls).
 *
 * Attached reads as one control with one meaning; spaced reads as a set of
 * independent switches that happen to be related. Pick by what they do, not by what
 * looks tighter in the moment.
 */
export const Layouts: Story = {
  render: () => (
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <code class="w-24 text-xs text-muted-foreground">attached</code>
        <ToggleGroup attached aria-label="Density">
          <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
          <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div class="flex items-center gap-4">
        <code class="w-24 text-xs text-muted-foreground">spaced</code>
        <ToggleGroup aria-label="Panels">
          <ToggleGroupItem value="sidebar">Sidebar</ToggleGroupItem>
          <ToggleGroupItem value="terminal">Terminal</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  ),
}

/** The outline variant, for a group sitting on a surface with its own fill. */
export const Outline: Story = {
  render: () => (
    <ToggleGroup attached variant="outline" aria-label="View mode">
      <ToggleGroupItem value="code" variant="outline">
        Code
      </ToggleGroupItem>
      <ToggleGroupItem value="diff" variant="outline">
        Diff
      </ToggleGroupItem>
      <ToggleGroupItem value="history" variant="outline">
        History
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}
