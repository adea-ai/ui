import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Bell, ChevronLeft, ChevronRight, Play, Search, Settings } from 'lucide-solid'
import { Badge } from '../../ui/badge/badge'
import { Button } from '../../ui/button/button'
import {
  TopBar,
  TopBarBreadcrumb,
  TopBarPill,
  TopBarSearch,
  TopBarSection,
  TopBarTitle,
} from './top-bar'

/**
 * TopBar.
 *
 * The window's title row and primary toolbar. Three tracks: a leading group, a
 * centred search, and a trailing group. The search is a fixed function of the
 * window width and the two side groups are equal remainders, which is what makes
 * the search *exactly* window-centred by construction — no measurement, no
 * observer, no absolutely-positioned overlay to keep clear of.
 *
 * On a frameless desktop window this row is also the drag region, so it carries
 * `window-drag` and the controls inside it opt back out with `window-no-drag`.
 * Without that opt-out, clicking a button in the title bar drags the window
 * instead of pressing.
 */
const meta = {
  title: 'Layout/Top bar',
  component: TopBar,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof TopBar>

export default meta
type Story = StoryObj<typeof meta>

/** The default arrangement: title leading, search centred, actions trailing. */
export const Default: Story = {
  render: () => (
    <div class="h-40 bg-background">
      <TopBar>
        <TopBarSection>
          <TopBarTitle>adea</TopBarTitle>
        </TopBarSection>
        <TopBarSearch placeholder="Search projects, files and sessions" shortcut="⌘K" />
        <TopBarSection align="end">
          <Button size="sm" variant="ghost" aria-label="Play">
            <Play />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Notifications">
            <Bell />
          </Button>
        </TopBarSection>
      </TopBar>
      <div class="p-4">
        <p class="max-w-prose text-sm text-muted-foreground">
          Resize the window and the search stays centred. The side tracks are pure remainder, so
          content never pushes the search out of existence — which is what happens when a search is
          placed in a flex row between two auto-width groups.
        </p>
      </div>
    </div>
  ),
}

/**
 * A breadcrumb instead of a title, for a view that is nested.
 *
 * The last crumb is the current page and carries `aria-current` rather than being
 * a link to itself, so the path is announced correctly.
 */
export const WithBreadcrumb: Story = {
  render: () => (
    <div class="h-32 bg-background">
      <TopBar>
        <TopBarSection>
          <TopBarBreadcrumb>
            <a href="#storybook-preview-iframe" class="text-muted-foreground hover:text-foreground">
              adea
            </a>
            <span class="text-muted-foreground" aria-hidden="true">
              /
            </span>
            <a href="#storybook-preview-iframe" class="text-muted-foreground hover:text-foreground">
              packages
            </a>
            <span class="text-muted-foreground" aria-hidden="true">
              /
            </span>
            <span aria-current="page" class="font-medium">
              ui
            </span>
          </TopBarBreadcrumb>
        </TopBarSection>
        <TopBarSearch placeholder="Search this package" shortcut="⌘K" />
        <TopBarSection align="end" />
      </TopBar>
    </div>
  ),
}

/**
 * A navigation history pair and a status readout in the trailing group.
 *
 * These are the elements that drop first when the window narrows: the arrows are
 * redundant with the keyboard shortcuts and the readouts are ambient, so they yield
 * before the search or the title does.
 */
export const WithHistoryAndReadouts: Story = {
  render: () => (
    <div class="h-40 bg-background">
      <TopBar>
        <TopBarSection>
          <Button size="sm" variant="ghost" aria-label="Back">
            <ChevronLeft />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Forward">
            <ChevronRight />
          </Button>
          <TopBarTitle>feat/m12-397-worktrees</TopBarTitle>
        </TopBarSection>
        <TopBarSearch placeholder="Search" shortcut="⌘K" />
        <TopBarSection align="end">
          <TopBarPill label="main" />
          <TopBarPill label="4 worktrees" />
          <Badge variant="success" size="md">
            Passing
          </Badge>
        </TopBarSection>
      </TopBar>
    </div>
  ),
}

/**
 * A frameless desktop window.
 *
 * The macOS traffic lights occupy the leading 84px, so the row's content box
 * starts after them. The search is centred in the space that remains — which is
 * why it can look off-centre in a screenshot and be correct: it is centred in the
 * region the user can actually see.
 */
export const FramelessWindow: Story = {
  render: () => (
    <div class="h-40 bg-background">
      <TopBar draggable glass macosInset>
        <TopBarSection>
          <TopBarTitle>adea</TopBarTitle>
        </TopBarSection>
        <TopBarSearch placeholder="Search" shortcut="⌘K" />
        <TopBarSection align="end">
          <Button size="sm" variant="ghost" aria-label="Settings">
            <Settings />
          </Button>
        </TopBarSection>
      </TopBar>
      <div class="p-4">
        <p class="max-w-prose text-sm text-muted-foreground">
          The row is a drag region; every control inside it is `window-no-drag`. The glass variant
          blurs what scrolls under it, and it falls back to a solid fill under
          `prefers-reduced-transparency` and on any engine without `backdrop-filter`.
        </p>
      </div>
    </div>
  ),
}

/**
 * A search that is a button, not an input.
 *
 * Clicking it opens the command palette, which already owns the input, the ranking
 * and the keyboard handling. A second live input here would be a second source of
 * truth for the same query; a field that looks like a control and behaves like a
 * button is the honest version of this affordance.
 */
export const SearchAffordance: Story = {
  render: () => (
    <div class="h-56 bg-background">
      <TopBar>
        <TopBarSection>
          <TopBarTitle>Search</TopBarTitle>
        </TopBarSection>
        <TopBarSearch placeholder="Search projects, files and sessions" shortcut="⌘K" />
        <TopBarSection align="end" />
      </TopBar>
      <div class="flex flex-col gap-3 p-4">
        <div class="flex items-center gap-2">
          <Search class="size-4 text-muted-foreground" />
          <span class="text-sm text-muted-foreground">
            It is a <code>&lt;button&gt;</code>: focusable, keyboard-operable, and it opens the
            palette.
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-muted-foreground">⌘K</span>
          <span class="text-sm text-muted-foreground">
            The shortcut is drawn in the trailing slot, hidden below the `sm` breakpoint where there
            is no room for it.
          </span>
        </div>
      </div>
    </div>
  ),
}
