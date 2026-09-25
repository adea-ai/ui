import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import {
  Box,
  CircleDot,
  Files,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Terminal,
  Users,
} from 'lucide-solid'
import { AppShell, AppShellBody, AppShellMain } from '../app-shell/app-shell'
import { Button } from '../../ui/button/button'
import { Panel, PanelBody, PanelHeader, PanelTitle } from '../panel/panel'
import {
  SideRail,
  SideRailContent,
  SideRailFooter,
  SideRailHeader,
  SideRailItem,
} from '../side-rail/side-rail'
import {
  SidebarNav,
  SidebarNavContent,
  SidebarNavHeader,
  SidebarNavItem,
  SidebarNavSection,
  SidebarNavTitle,
} from '../sidebar-nav/sidebar-nav'
import { StatusBar, StatusBarItem, StatusBarSpacer } from '../status-bar/status-bar'
import { TopBar, TopBarSearch, TopBarSection, TopBarTitle } from '../top-bar/top-bar'

/**
 * AppShell.
 *
 * The window's skeleton. Its whole job is to be the *one* place that decides the
 * geometry, so two applications built on this library cannot disagree about how
 * tall the top bar is or where the content begins.
 *
 * Every region is height-locked: the shell fills the viewport, each region scrolls
 * internally, and the document itself never scrolls. That is what stops a wheel
 * event over a pane from dragging the whole window, and it is why the desktop
 * shell can be driven entirely by the panes.
 *
 * The stories below are full-window compositions because a shell cannot be judged
 * inside a centred box — a 58px rail next to a 256px sidebar reads completely
 * differently at 400px than at 1440px, which is the size it ships at.
 */
const meta = {
  title: 'Layout/App shell',
  component: AppShell,
  parameters: {
    layout: 'fullscreen',
    docs: { canvas: { sourceState: 'hidden' } },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

const railItems = [
  { value: 'dev', label: 'Dev view', icon: Terminal },
  { value: 'files', label: 'Files', icon: Files },
  { value: 'branches', label: 'Worktrees', icon: GitBranch },
  { value: 'agents', label: 'Agents', icon: Users },
  { value: 'artifacts', label: 'Artifacts', icon: Box },
]

const projects = ['adea', 'cortana', 'control-plane', 'plugins', 'agent-sim']

/**
 * The complete shell: rail, sidebar, top bar, content, status bar.
 *
 * This is the arrangement both applications ship. Read it as the reference for
 * where a new region belongs — and note that nothing here sets a width, a height
 * or a colour: every dimension comes from a token, so the two applications cannot
 * drift apart by a few pixels.
 */
export const FullShell: Story = {
  render: () => {
    const [collapsed, setCollapsed] = createSignal(false)
    const [active, setActive] = createSignal('dev')
    const [project, setProject] = createSignal('adea')

    return (
      <AppShell>
        <SideRail collapsed={collapsed()}>
          <SideRailHeader>
            <span class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-2xs font-semibold text-primary-foreground">
              A
            </span>
            <span class="truncate text-sm font-semibold group-data-[collapsed=true]/rail:sr-only">
              Adea
            </span>
          </SideRailHeader>
          <SideRailContent>
            {railItems.map((item) => (
              <SideRailItem
                as="button"
                type="button"
                active={active() === item.value}
                label={item.label}
                onClick={() => setActive(item.value)}
              >
                <item.icon />
              </SideRailItem>
            ))}
          </SideRailContent>
          <SideRailFooter>
            <SideRailItem as="button" type="button" label="Settings">
              <Settings />
            </SideRailItem>
            <SideRailItem
              as="button"
              type="button"
              label={collapsed() ? 'Expand rail' : 'Collapse rail'}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed() ? <PanelLeftOpen /> : <PanelLeftClose />}
            </SideRailItem>
          </SideRailFooter>
        </SideRail>

        <AppShellBody>
          <TopBar>
            <TopBarSection>
              <TopBarTitle>{project()}</TopBarTitle>
            </TopBarSection>
            <TopBarSearch placeholder="Search projects, files and sessions" shortcut="⌘K" />
            <TopBarSection align="end">
              <StatusBarItem tone="success" dot>
                Connected
              </StatusBarItem>
            </TopBarSection>
          </TopBar>

          <div class="flex min-h-0 flex-1">
            <SidebarNav aria-label="Projects">
              <SidebarNavHeader>
                <SidebarNavTitle>Projects</SidebarNavTitle>
              </SidebarNavHeader>
              <SidebarNavContent>
                <SidebarNavSection label="Recent" count={projects.length}>
                  {projects.map((name) => (
                    <SidebarNavItem
                      as="button"
                      type="button"
                      active={project() === name}
                      onClick={() => setProject(name)}
                    >
                      <CircleDot />
                      {name}
                    </SidebarNavItem>
                  ))}
                </SidebarNavSection>
              </SidebarNavContent>
            </SidebarNav>

            <AppShellMain>
              <Panel>
                <PanelHeader>
                  <PanelTitle>{project()}</PanelTitle>
                </PanelHeader>
                <PanelBody>
                  <div class="grid gap-3 sm:grid-cols-3">
                    {['Sessions', 'Terminals', 'Files'].map((label) => (
                      <div class="rounded-lg border border-border bg-card p-3">
                        <div class="text-xs text-muted-foreground">{label}</div>
                        <div class="text-xl font-semibold tabular-nums">12</div>
                      </div>
                    ))}
                  </div>
                </PanelBody>
              </Panel>
            </AppShellMain>
          </div>

          <StatusBar>
            <StatusBarItem tone="success" dot>
              main
            </StatusBarItem>
            <StatusBarItem>4 worktrees</StatusBarItem>
            <StatusBarSpacer />
            <StatusBarItem>UTF-8</StatusBarItem>
            <StatusBarItem>Ln 1, Col 1</StatusBarItem>
          </StatusBar>
        </AppShellBody>
      </AppShell>
    )
  },
}

/** The rail collapsed: the same shell at its most compact, 58px instead of 236px. */
export const CollapsedRail: Story = {
  render: () => (
    <AppShell>
      <SideRail collapsed>
        <SideRailHeader>
          <span class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-2xs font-semibold text-primary-foreground">
            A
          </span>
        </SideRailHeader>
        <SideRailContent>
          {railItems.map((item, index) => (
            <SideRailItem as="button" type="button" active={index === 0} label={item.label}>
              <item.icon />
            </SideRailItem>
          ))}
        </SideRailContent>
        <SideRailFooter>
          <SideRailItem as="button" type="button" label="Settings">
            <Settings />
          </SideRailItem>
        </SideRailFooter>
      </SideRail>
      <AppShellBody>
        <TopBar>
          <TopBarSection>
            <TopBarTitle>adea</TopBarTitle>
          </TopBarSection>
          <TopBarSearch placeholder="Search" shortcut="⌘K" />
          <TopBarSection align="end" />
        </TopBar>
        <AppShellMain>
          <Panel>
            <PanelHeader>
              <PanelTitle>Content</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <p class="text-sm text-muted-foreground">
                Hover a rail icon: the label appears as a tooltip and stays in the accessibility
                tree as a visually hidden span. An icon-only rail with no names is unusable with a
                screen reader and guesswork with a mouse.
              </p>
            </PanelBody>
          </Panel>
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  ),
}

/** A single-pane shell, for an app with no secondary navigation. */
export const WithoutSidebar: Story = {
  render: () => (
    <AppShell>
      <SideRail>
        <SideRailHeader>
          <span class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-2xs font-semibold text-primary-foreground">
            C
          </span>
          <span class="truncate text-sm font-semibold group-data-[collapsed=true]/rail:sr-only">
            Cortana
          </span>
        </SideRailHeader>
        <SideRailContent>
          <SideRailItem as="button" type="button" active label="Sources">
            <Files />
          </SideRailItem>
          <SideRailItem as="button" type="button" label="Settings">
            <Settings />
          </SideRailItem>
        </SideRailContent>
      </SideRail>
      <AppShellBody>
        <TopBar>
          <TopBarSection>
            <TopBarTitle>Sources</TopBarTitle>
          </TopBarSection>
          <TopBarSearch placeholder="Search documents" shortcut="⌘K" />
          <TopBarSection align="end">
            <Button size="sm">Sync now</Button>
          </TopBarSection>
        </TopBar>
        <AppShellMain>
          <Panel>
            <PanelBody>
              <p class="text-sm text-muted-foreground">
                Cortana's shape: one rail, no secondary column, and the content filling the
                remainder. The same components, a different arrangement — which is the point of the
                shell being separate from what goes in it.
              </p>
            </PanelBody>
          </Panel>
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  ),
}

/**
 * A startup state with no rail at all.
 *
 * The rail is a navigation surface; before there is anything to navigate, it is
 * chrome. An onboarding or sign-in view uses the shell for its viewport lock and
 * nothing else.
 */
export const BareContent: Story = {
  render: () => (
    <AppShell>
      <AppShellBody>
        <AppShellMain class="items-center justify-center">
          <div class="flex max-w-sm flex-col items-center gap-3 text-center">
            <span class="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
              A
            </span>
            <h1 class="text-xl font-semibold tracking-tight">Welcome to Adea</h1>
            <p class="text-sm text-muted-foreground text-pretty">
              Sign in to sync your workspaces. Nothing is uploaded without asking.
            </p>
            <Button class="mt-1">Sign in</Button>
          </div>
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  ),
}
