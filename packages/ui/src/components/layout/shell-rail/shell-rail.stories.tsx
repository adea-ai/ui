import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Box, Files, Settings } from 'lucide-solid'
import { SideRailItem } from '../side-rail/side-rail'
import { ShellRail } from './shell-rail'

/**
 * ShellRail.
 *
 * The rail both applications show: the app's mark at the top, the search entry
 * point beneath it, then the app's own destinations. It is always the icon
 * column. The sidebar toggle in the top bar controls the sidebar, never this
 * rail, so the rail never changes width under a user who is navigating by it.
 *
 * Reach for `SideRail` for a rail that can expand; the shell rail exists so both
 * applications are the same width and put search in the same place.
 */
const meta = {
  title: 'Layout/Shell rail',
  component: ShellRail,
  parameters: { layout: 'fullscreen' },
  args: { mark: <span class="text-lg font-semibold">A</span> },
  tags: ['autodocs'],
} satisfies Meta<typeof ShellRail>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div class="flex h-96 bg-background">
      <ShellRail
        mark={<span class="text-lg font-semibold">A</span>}
        onSearch={() => {}}
        searchKeys={['⌘', 'K']}
        searchKeyshortcuts="Meta+K"
        footer={
          <SideRailItem as="button" type="button" label="Settings">
            <Settings />
          </SideRailItem>
        }
      >
        <SideRailItem as="button" type="button" label="Home" active>
          <Box />
        </SideRailItem>
        <SideRailItem as="button" type="button" label="Files">
          <Files />
        </SideRailItem>
      </ShellRail>
    </div>
  ),
}
