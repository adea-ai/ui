import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Badge } from '../../ui/badge/badge'
import { WorkspaceMark } from './workspace-mark'

/**
 * WorkspaceMark.
 *
 * The mark for one workspace in a rail. Deliberately not an `Avatar`: a workspace is
 * not a person, needs no image, and a rail holding both has to tell them apart at a
 * glance — which is why this is square with a rounded corner rather than round.
 *
 * It carries an *active* treatment, which an avatar does not: a rail of workspaces is
 * a switcher, and the one you are in has to be visible without reading the tooltip.
 */
const meta = {
  title: 'Composites/Workspace mark',
  component: WorkspaceMark,
  parameters: { layout: 'padded' },
  args: { name: 'adea' },
  tags: ['autodocs'],
} satisfies Meta<typeof WorkspaceMark>

export default meta
type Story = StoryObj<typeof meta>

/** A rail's worth, with one active — the switcher shape. */
export const Rail: Story = {
  render: () => (
    <div class="flex flex-col gap-2 rounded-xl border border-border p-3">
      <WorkspaceMark name="adea" active />
      <WorkspaceMark name="cortana" />
      <WorkspaceMark name="control-plane" />
      <WorkspaceMark
        name="plugins"
        badge={
          <Badge size="sm" variant="destructive">
            2
          </Badge>
        }
      />
      <WorkspaceMark
        name="agent-sim"
        badge={<span class="block size-2 rounded-full bg-primary" />}
      />
    </div>
  ),
}

/** The states, including a disabled one for a workspace you cannot open. */
export const States: Story = {
  render: () => (
    <div class="flex items-center gap-3">
      <WorkspaceMark name="active" active />
      <WorkspaceMark name="idle" />
      <WorkspaceMark name="disabled" disabled />
      <WorkspaceMark
        name="unread"
        badge={<span class="block size-2 rounded-full bg-destructive" />}
      />
    </div>
  ),
}
