import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { GitBranch, Wifi, WifiOff } from 'lucide-solid'
import { StatusBar, StatusBarItem, StatusBarSpacer } from './status-bar'

/**
 * StatusBar.
 *
 * The thin strip pinned to the bottom of the window. Its purpose is to hold
 * *ambient* facts the user checks without acting: connection state, branch, counts,
 * the current mode.
 *
 * Anything interactive belongs in the top bar or a pane — a status bar is read, not
 * operated, and a control here is one the user will not find. Height comes from
 * `--statusbar-height`, so a pane's bottom padding can reserve it without a magic
 * number.
 */
const meta = {
  title: 'Layout/Status bar',
  component: StatusBar,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof StatusBar>

export default meta
type Story = StoryObj<typeof meta>

/** The full strip: state leading, counts in the middle, editor position trailing. */
export const Default: Story = {
  render: () => (
    <div class="flex h-40 flex-col justify-end bg-background">
      <StatusBar>
        <StatusBarItem tone="success" dot>
          <Wifi />
          Connected
        </StatusBarItem>
        <StatusBarItem>
          <GitBranch />
          main
        </StatusBarItem>
        <StatusBarItem>4 worktrees</StatusBarItem>
        <StatusBarSpacer />
        <StatusBarItem>UTF-8</StatusBarItem>
        <StatusBarItem>Ln 1, Col 1</StatusBarItem>
      </StatusBar>
    </div>
  ),
}

/**
 * The tones.
 *
 * `tone` carries meaning rather than decoration: it is how a user knows at a glance
 * whether they are online, whether the budget is intact, whether anything failed.
 * A warning tone pulses; the others do not, because a strip of pulsing dots is a
 * strip nobody reads.
 */
export const Tones: Story = {
  render: () => (
    <div class="flex h-40 flex-col justify-end bg-background">
      <StatusBar>
        <StatusBarItem tone="default">Default</StatusBarItem>
        <StatusBarItem tone="success" dot>
          Success
        </StatusBarItem>
        <StatusBarItem tone="warning" dot>
          Warning (pulses)
        </StatusBarItem>
        <StatusBarItem tone="destructive" dot>
          Destructive
        </StatusBarItem>
      </StatusBar>
    </div>
  ),
}

/** Disconnected, which is the state a user checks this strip for. */
export const Disconnected: Story = {
  render: () => (
    <div class="flex h-40 flex-col justify-end bg-background">
      <StatusBar>
        <StatusBarItem tone="destructive" dot>
          <WifiOff />
          Offline · last sync 14m ago
        </StatusBarItem>
        <StatusBarSpacer />
        <StatusBarItem>Local only</StatusBarItem>
      </StatusBar>
    </div>
  ),
}
