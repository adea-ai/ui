import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { ChevronLeft, ChevronRight, Home, PanelLeft, Plus, Settings } from 'lucide-solid'
import { createSignal } from 'solid-js'
import { Button } from '../../ui/button/button'
import { ActionButton } from '../../composites/action-button'
import { TopBarBreadcrumb, TopBarSearch } from '../top-bar/top-bar'
import { WorkspaceSwitcher } from '../../composites/workspace-switcher/workspace-switcher'
import { ShellTopBar } from './shell-top-bar'

/**
 * ShellTopBar.
 *
 * The top bar both applications draw: history arrows, the sidebar toggle and the
 * workspace switcher on the left of a vertical divider; breadcrumbs, search and
 * actions on the right. Reach for `TopBar` instead for a window that has no
 * sidebar to align with.
 *
 * The divider lands on the sidebar's edge because the bar is as wide as the rail
 * and sidebar together; the host publishes the sidebar's width as
 * `--shell-sidebar-width`. Closing the sidebar lets the leading half shrink to
 * its controls, so the toggle never moves under the pointer more than it must.
 */
const meta = {
  title: 'Layout/Shell top bar',
  component: ShellTopBar,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ShellTopBar>

export default meta
type Story = StoryObj<typeof meta>

function Bar(props: { open: boolean }) {
  const [value, setValue] = createSignal('home')
  return (
    <ShellTopBar
      sidebarOpen={props.open}
      navigation={
        <>
          <ActionButton variant="ghost" size="sm" aria-label="Back" tooltip="Back">
            <ChevronLeft />
          </ActionButton>
          <ActionButton variant="ghost" size="sm" aria-label="Forward" tooltip="Forward" disabled>
            <ChevronRight />
          </ActionButton>
        </>
      }
      sidebarToggle={
        <ActionButton
          variant="ghost"
          size="sm"
          aria-label={props.open ? 'Collapse sidebar' : 'Expand sidebar'}
          tooltip={props.open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <PanelLeft />
        </ActionButton>
      }
      workspace={
        <WorkspaceSwitcher
          value={value()}
          onValueChange={setValue}
          workspaces={[
            { id: 'home', name: 'Home', mark: <Home class="size-4" /> },
            { id: 'adea', name: 'adea', mark: <Home class="size-4" /> },
          ]}
        />
      }
      breadcrumb={
        <TopBarBreadcrumb>
          <span class="truncate">Projects</span>
          <span aria-hidden="true">/</span>
          <span class="truncate font-medium">Redesign</span>
        </TopBarBreadcrumb>
      }
      search={<TopBarSearch placeholder="Search" shortcut="⌘K" keyshortcuts="Meta+K" />}
      actions={
        <>
          <Button size="sm" variant="ghost" aria-label="New session">
            <Plus />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Settings">
            <Settings />
          </Button>
        </>
      }
    />
  )
}

/** Sidebar open: the divider aligns with the sidebar's trailing edge (17rem fallback here). */
export const SidebarOpen: Story = {
  render: () => (
    <div class="h-40 bg-background">
      <Bar open />
    </div>
  ),
}

/** Sidebar collapsed: only the controls remain in the leading half. */
export const SidebarClosed: Story = {
  render: () => (
    <div class="h-40 bg-background">
      <Bar open={false} />
    </div>
  ),
}

/** A phone-width window: the sidebar is a drawer, so the leading half is only its controls. */
export const Narrow: Story = {
  render: () => (
    <div class="h-40 w-80 bg-background">
      <Bar open />
    </div>
  ),
}
