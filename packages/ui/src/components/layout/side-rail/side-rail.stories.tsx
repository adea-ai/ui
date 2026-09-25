import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import {
  Box,
  Files,
  GitBranch,
  Home,
  Search,
  Settings,
  Sparkles,
  Terminal,
  Users,
} from 'lucide-solid'
import { Badge } from '../../ui/badge/badge'
import {
  SideRail,
  SideRailButton,
  SideRailContent,
  SideRailFooter,
  SideRailHeader,
  SideRailItem,
  SideRailSection,
} from './side-rail'

/**
 * SideRail.
 *
 * The narrow, persistent column of top-level destinations at the window's leading
 * edge. It is the one piece of chrome that is always on screen, which is why it is
 * a component rather than something each view arranges.
 *
 * Two forms, one component. Collapsed it is an icon column; expanded it carries
 * labels. Both widths come from tokens, so an app cannot pick its own and end up a
 * few pixels out of step with the app beside it.
 *
 * **The label is never hidden, only moved.** Collapsed, it becomes a tooltip and a
 * visually hidden span, so the rail stays navigable by screen reader, by keyboard
 * and by voice control. An icon-only rail with no accessible names is the single
 * most common accessibility failure in desktop application chrome.
 */
const meta = {
  title: 'Layout/Side rail',
  component: SideRail,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof SideRail>

export default meta
type Story = StoryObj<typeof meta>

const items = [
  { label: 'Home', icon: Home },
  { label: 'Dev view', icon: Terminal },
  { label: 'Files', icon: Files },
  { label: 'Worktrees', icon: GitBranch },
  { label: 'Agents', icon: Users },
  { label: 'Artifacts', icon: Box },
]

/** The expanded form: 236px, with labels and section titles. */
export const Expanded: Story = {
  render: () => (
    <div class="h-screen bg-background">
      <SideRail>
        <SideRailHeader>
          <span class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-2xs font-semibold text-primary-foreground">
            A
          </span>
          <span class="truncate text-sm font-semibold group-data-[collapsed=true]/rail:sr-only">
            Adea
          </span>
        </SideRailHeader>
        <SideRailContent>
          <SideRailSection label="Workspace">
            {items.map((item, index) => (
              <SideRailItem as="button" type="button" active={index === 0} label={item.label}>
                <item.icon />
              </SideRailItem>
            ))}
          </SideRailSection>
          <SideRailSection label="Discover">
            <SideRailItem
              as="button"
              type="button"
              label="App library"
              badge={
                <Badge size="sm" variant="secondary">
                  12
                </Badge>
              }
            >
              <Sparkles />
            </SideRailItem>
          </SideRailSection>
        </SideRailContent>
        <SideRailFooter>
          <SideRailItem
            as="button"
            type="button"
            label="Search"
            trailing={<span class="font-mono text-2xs">⌘K</span>}
          >
            <Search />
          </SideRailItem>
          <SideRailItem as="button" type="button" label="Settings">
            <Settings />
          </SideRailItem>
        </SideRailFooter>
      </SideRail>
    </div>
  ),
}

/**
 * The collapsed form: 58px, icons only, with tooltips on hover.
 *
 * Hover a row to see the label. Note the badge moves to the corner of its row
 * rather than disappearing with the label — an unread count is the one piece of
 * information a collapsed rail must not lose.
 */
export const Collapsed: Story = {
  render: () => (
    <div class="h-screen bg-background">
      <SideRail collapsed>
        <SideRailHeader>
          <span class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-2xs font-semibold text-primary-foreground">
            A
          </span>
        </SideRailHeader>
        <SideRailContent>
          {items.map((item, index) => (
            <SideRailItem as="button" type="button" active={index === 0} label={item.label}>
              <item.icon />
            </SideRailItem>
          ))}
        </SideRailContent>
        <SideRailFooter>
          <SideRailItem
            as="button"
            type="button"
            label="Artifacts"
            badge={<span class="block size-2 rounded-full bg-destructive" />}
          >
            <Box />
          </SideRailItem>
          <SideRailItem as="button" type="button" label="Settings">
            <Settings />
          </SideRailItem>
        </SideRailFooter>
      </SideRail>
    </div>
  ),
}

/** Both widths, side by side, at the size they ship. */
export const BothForms: Story = {
  render: () => (
    <div class="flex h-screen gap-8 bg-background p-8">
      <div class="flex flex-col gap-3">
        <code class="text-xs text-muted-foreground">collapsed · 58px</code>
        <div class="h-[28rem] overflow-hidden rounded-lg border border-border">
          <SideRail collapsed aria-label="Primary, collapsed">
            <SideRailHeader>
              <span class="flex size-6 items-center justify-center rounded-md bg-primary text-2xs font-semibold text-primary-foreground">
                A
              </span>
            </SideRailHeader>
            <SideRailContent>
              {items.slice(0, 4).map((item, index) => (
                <SideRailItem as="button" type="button" active={index === 0} label={item.label}>
                  <item.icon />
                </SideRailItem>
              ))}
            </SideRailContent>
          </SideRail>
        </div>
      </div>
      <div class="flex flex-col gap-3">
        <code class="text-xs text-muted-foreground">expanded · 236px</code>
        <div class="h-[28rem] overflow-hidden rounded-lg border border-border">
          <SideRail aria-label="Primary, expanded">
            <SideRailHeader>
              <span class="flex size-6 items-center justify-center rounded-md bg-primary text-2xs font-semibold text-primary-foreground">
                A
              </span>
              <span class="truncate text-sm font-semibold">Adea</span>
            </SideRailHeader>
            <SideRailContent>
              {items.slice(0, 4).map((item, index) => (
                <SideRailItem as="button" type="button" active={index === 0} label={item.label}>
                  <item.icon />
                </SideRailItem>
              ))}
            </SideRailContent>
          </SideRail>
        </div>
      </div>
    </div>
  ),
}

/**
 * A rail control that is not a destination.
 *
 * A collapse toggle, a "new" action: same geometry as a row, but it carries no
 * `aria-current` and is never the current page. Keeping the two apart is what
 * makes the rail's landmark meaningful.
 */
export const WithControls: Story = {
  render: () => (
    <div class="h-screen bg-background">
      <SideRail>
        <SideRailHeader>
          <span class="flex size-6 items-center justify-center rounded-md bg-primary text-2xs font-semibold text-primary-foreground">
            A
          </span>
          <span class="truncate text-sm font-semibold group-data-[collapsed=true]/rail:sr-only">
            Adea
          </span>
        </SideRailHeader>
        <SideRailContent>
          <SideRailButton label="New session">
            <Sparkles />
          </SideRailButton>
          {items.slice(0, 3).map((item, index) => (
            <SideRailItem as="button" type="button" active={index === 0} label={item.label}>
              <item.icon />
            </SideRailItem>
          ))}
        </SideRailContent>
      </SideRail>
    </div>
  ),
}
