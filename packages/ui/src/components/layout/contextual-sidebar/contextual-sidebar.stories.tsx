import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { FolderKanban, MessagesSquare } from 'lucide-solid'
import { createSignal } from 'solid-js'
import { Button } from '../../ui/button/button'
import { SidebarNavItem, SidebarNavSection } from '../sidebar-nav/sidebar-nav'
import { ContextualSidebar } from './index'
import './contextual-sidebar.stories.css'

const meta = {
  title: 'Layout/Contextual sidebar',
  component: ContextualSidebar,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: {
    label: 'Workspace navigation',
    title: 'Workspace',
    open: true,
    onOpenChange: () => {},
    width: 272,
    minimum: 208,
    maximum: 448,
    content: () => null,
    onWidthChange: () => {},
  },
} satisfies Meta<typeof ContextualSidebar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The host projects one controlled width into both its grid and top-bar
 * divider. `resizeGrip` is shared by every shell variant: the published
 * default is the rung, and the chip is the explicit opt-back-in.
 */
const renderWorkspaceShell = (resizeGrip: 'chip' | 'rung' | undefined, id: string) => () => {
  const [open, setOpen] = createSignal(true)
  const [width, setWidth] = createSignal(272)
  const [savedWidth, setSavedWidth] = createSignal(272)
  let shell: HTMLElement | undefined
  let opener: HTMLButtonElement | undefined

  const updateWidth = (next: number) => {
    setWidth(next)
    shell?.style.setProperty('--sidebar-width', `${next}px`)
  }

  return (
    <div
      class="workspace-sidebar-story-shell"
      data-sidebar-open={String(open())}
      ref={(element) => {
        shell = element
        element.style.setProperty('--sidebar-width', `${width()}px`)
      }}
    >
      <header class="workspace-sidebar-story-topbar">
        <div class="workspace-sidebar-story-topbar-start">
          <span class="truncate text-sm font-semibold">Workspace</span>
        </div>
        <div class="flex min-w-0 items-center gap-4 px-4 text-sm">
          <Button
            ref={(element) => {
              opener = element
            }}
            size="sm"
            variant="ghost"
            onClick={() => setOpen((value) => !value)}
          >
            {open() ? 'Collapse' : 'Expand'} navigation
          </Button>
          <span>Current view</span>
        </div>
      </header>
      <div class="workspace-sidebar-story-sidebar">
        <ContextualSidebar
          id={id}
          label="Workspace navigation"
          title="Workspace"
          headingAs="h1"
          open={open()}
          onOpenChange={setOpen}
          wideViewportAtLoad={false}
          restoreFocusRef={() => opener}
          width={width()}
          minimum={208}
          maximum={448}
          resizeLabel="Resize workspace navigation"
          resizeGrip={resizeGrip}
          onWidthChange={updateWidth}
          onWidthCommit={setSavedWidth}
          content={(context) => (
            <>
              <SidebarNavSection label="Projects" headingAs="h2" count={2}>
                <SidebarNavItem as="button" type="button" active>
                  <FolderKanban aria-hidden="true" />
                  Atlas workspace
                </SidebarNavItem>
                <SidebarNavItem as="button" type="button">
                  <FolderKanban aria-hidden="true" />
                  Design system
                </SidebarNavItem>
              </SidebarNavSection>
              <SidebarNavSection label="Rooms" headingAs="h2" count={1}>
                <SidebarNavItem as="button" type="button">
                  <MessagesSquare aria-hidden="true" />
                  Product planning
                </SidebarNavItem>
              </SidebarNavSection>
              <output class="sr-only" aria-label="Rendered sidebar mode">
                {context.mobile ? 'mobile' : 'desktop'}
              </output>
            </>
          )}
          footer={() => (
            <Button size="sm" variant="ghost" class="w-full justify-start">
              Archived items
            </Button>
          )}
        />
      </div>
      <main class="workspace-sidebar-story-main">
        <h2 class="text-lg font-semibold">View content</h2>
        <p class="mt-2 text-sm text-muted-foreground">
          The host controls the sidebar preference and projects the same width into this grid and
          the top-bar divider. Resize from the pane edge or use the keyboard separator.
        </p>
        <p class="mt-4 text-sm">
          Current width: <output aria-label="Host sidebar width">{width()}</output> px; saved on
          commit: <output aria-label="Saved sidebar width">{savedWidth()}</output> px.
        </p>
      </main>
    </div>
  )
}

/** No `resizeGrip` prop: pins the published default — the quieter rung. */
export const ResponsiveNavigation: Story = {
  render: renderWorkspaceShell(undefined, 'story-contextual-sidebar'),
}

/** Hosts that want the heavier bordered chip opt back in explicitly. */
export const ChipGripNavigation: Story = {
  render: renderWorkspaceShell('chip', 'story-contextual-sidebar-chip'),
}
