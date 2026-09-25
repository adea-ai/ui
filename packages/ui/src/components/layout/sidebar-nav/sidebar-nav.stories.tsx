import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Box, CircleDot, FileText, GitBranch, Plus, Search, Settings, Trash2 } from 'lucide-solid'
import { Badge } from '../../ui/badge/badge'
import { Button } from '../../ui/button/button'
import {
  SidebarNav,
  SidebarNavButton,
  SidebarNavContent,
  SidebarNavFooter,
  SidebarNavHeader,
  SidebarNavItem,
  SidebarNavSection,
  SidebarNavTitle,
} from './sidebar-nav'

/**
 * SidebarNav.
 *
 * The secondary navigation column: the list of things inside the destination the
 * rail selected — projects, sessions, files, threads. It is a different object from
 * the rail, not a wider version of it, which is why it is a separate component.
 *
 * Rows share one recipe with the rail's, so a row in a sidebar and a row in a rail
 * read as the same kind of thing at the same density. That recipe is KiroCrew's nav
 * row: `text-sm font-medium`, `gap-2.5`, `px-3 py-2`, `rounded-md`.
 */
const meta = {
  title: 'Layout/Sidebar navigation',
  component: SidebarNav,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof SidebarNav>

export default meta
type Story = StoryObj<typeof meta>

const projects = [
  { name: 'adea', count: 41 },
  { name: 'cortana', count: 12 },
  { name: 'control-plane', count: 7 },
  { name: 'plugins', count: 3 },
]

/** The canonical shape: a header with a title, grouped rows, a footer action. */
export const Default: Story = {
  render: () => {
    const [active, setActive] = createSignal('adea')

    return (
      <div class="flex h-screen bg-background">
        <SidebarNav aria-label="Projects">
          <SidebarNavHeader>
            <SidebarNavTitle>Projects</SidebarNavTitle>
            <Button size="icon-sm" variant="ghost" aria-label="New project">
              <Plus />
            </Button>
          </SidebarNavHeader>
          <SidebarNavContent>
            <SidebarNavSection label="Recent" count={projects.length}>
              {projects.map((project) => (
                <SidebarNavItem
                  as="button"
                  type="button"
                  active={active() === project.name}
                  onClick={() => setActive(project.name)}
                  trailing={
                    <Badge size="sm" variant="secondary">
                      {project.count}
                    </Badge>
                  }
                >
                  <CircleDot />
                  {project.name}
                </SidebarNavItem>
              ))}
            </SidebarNavSection>
          </SidebarNavContent>
          <SidebarNavFooter>
            <Button size="sm" variant="ghost" class="w-full justify-start gap-2">
              <Settings />
              Settings
            </Button>
          </SidebarNavFooter>
        </SidebarNav>
        <div class="flex-1 p-6">
          <h2 class="text-lg font-semibold tracking-tight">{active()}</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            The sidebar column is 256px wide, from `--sidebar-width`. Everything inside it is one of
            the components shown here — nothing in the column invents its own row.
          </p>
        </div>
      </div>
    )
  },
}

/**
 * Collapsible sections.
 *
 * A list of projects inevitably outgrows the column, and the user needs to put the
 * ones they are not using away *without* them disappearing into a menu. The count
 * and the hover action stay visible when the section is open; collapsing is a
 * reading choice, not a mode.
 */
export const CollapsibleSections: Story = {
  render: () => (
    <div class="flex h-screen bg-background">
      <SidebarNav aria-label="Workspace">
        <SidebarNavHeader>
          <SidebarNavTitle>Workspace</SidebarNavTitle>
        </SidebarNavHeader>
        <SidebarNavContent>
          <SidebarNavSection label="Pinned" collapsible defaultOpen count={2}>
            <SidebarNavItem as="button" type="button" active>
              <CircleDot />
              adea
            </SidebarNavItem>
            <SidebarNavItem as="button" type="button">
              <CircleDot />
              cortana
            </SidebarNavItem>
          </SidebarNavSection>
          <SidebarNavSection
            label="Archived"
            collapsible
            count={3}
            action={
              <Button size="icon-2xs" variant="ghost" aria-label="Manage archived projects">
                <Trash2 />
              </Button>
            }
          >
            <SidebarNavItem as="button" type="button">
              <Box />
              adea-mkt-wt
            </SidebarNavItem>
          </SidebarNavSection>
        </SidebarNavContent>
      </SidebarNav>
      <div class="flex-1 p-6">
        <p class="max-w-prose text-sm text-muted-foreground">
          Each section heading is a real disclosure button with `aria-expanded`, so the state is
          announced rather than only being visible as a rotated chevron.
        </p>
      </div>
    </div>
  ),
}

/**
 * A two-level list: a branch nested under its worktree.
 *
 * `nested` indents one level rather than introducing a second component, so the
 * row height and the type size stay the same down the hierarchy. A nested row that
 * gets smaller is a row that stops being clickable at a glance.
 */
export const Nested: Story = {
  render: () => (
    <div class="flex h-screen bg-background">
      <SidebarNav aria-label="Worktrees">
        <SidebarNavHeader>
          <SidebarNavTitle>Worktrees</SidebarNavTitle>
        </SidebarNavHeader>
        <SidebarNavContent>
          <SidebarNavItem as="button" type="button">
            <GitBranch />
            main
          </SidebarNavItem>
          <SidebarNavItem as="button" type="button" nested>
            <FileText />
            feat/solid-tanstack-start
          </SidebarNavItem>
          <SidebarNavItem as="button" type="button" nested>
            <FileText />
            feat/m12-397-worktrees
          </SidebarNavItem>
          <SidebarNavItem as="button" type="button">
            <GitBranch />
            release/0.55
          </SidebarNavItem>
        </SidebarNavContent>
      </SidebarNav>
      <div class="flex-1 p-6">
        <p class="max-w-prose text-sm text-muted-foreground">
          The hierarchy is expressed by indentation alone. Same row height, same type size, same hit
          target — a smaller nested row is one a user has to aim at.
        </p>
      </div>
    </div>
  ),
}

/**
 * Filtered rows, with a persistent control in the header.
 *
 * The search affordance lives in the sidebar's own header rather than in the top
 * bar, because it filters this column and nothing else. A filter in the window
 * chrome that scopes to one panel is a lie about what it does.
 */
export const Filterable: Story = {
  render: () => {
    const [query, setQuery] = createSignal('')
    const visible = () => projects.filter((project) => project.name.includes(query()))

    return (
      <div class="flex h-screen bg-background">
        <SidebarNav aria-label="Sessions">
          <SidebarNavHeader>
            <SidebarNavTitle>Sessions</SidebarNavTitle>
          </SidebarNavHeader>
          <div class="px-3 pb-2">
            <div class="relative">
              <Search class="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query()}
                onInput={(event) => setQuery(event.currentTarget.value)}
                placeholder="Filter sessions"
                aria-label="Filter sessions"
                class="h-control-sm w-full rounded-md border border-input bg-transparent ps-7 pe-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle"
              />
            </div>
          </div>
          <SidebarNavContent>
            {visible().length === 0 ? (
              <p class="px-3 py-6 text-center text-sm text-muted-foreground">No sessions match.</p>
            ) : (
              visible().map((project) => (
                <SidebarNavItem as="button" type="button">
                  <CircleDot />
                  {project.name}
                </SidebarNavItem>
              ))
            )}
          </SidebarNavContent>
          <SidebarNavFooter>
            <SidebarNavButton>
              <Plus />
              New session
            </SidebarNavButton>
          </SidebarNavFooter>
        </SidebarNav>
        <div class="flex-1 p-6">
          <p class="text-sm text-muted-foreground">
            {visible().length} of {projects.length} sessions.
          </p>
        </div>
      </div>
    )
  },
}
