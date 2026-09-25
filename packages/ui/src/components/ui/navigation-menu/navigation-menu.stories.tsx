import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { BookOpen, Layers, LifeBuoy, Settings } from 'lucide-solid'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuGroup,
  NavigationMenuGroupLabel,
  NavigationMenuItem,
  NavigationMenuMenu,
  NavigationMenuSeparator,
  NavigationMenuTrigger,
} from './navigation-menu'

const meta = {
  title: 'UI/Navigation Menu',
  component: NavigationMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A site-style menu bar: top-level triggers that open panels of links. Not a `Menubar` — that is a row of application menus whose items are commands, this is a row of destinations whose panels are links. Composition is unforgiving: `Menu` renders nothing (it names an entry so the bar's arrow keys can reach it), `Trigger` already renders its own `<li>`, and all panels share one `Viewport` that is a sibling of the menus.",
      },
    },
  },
  decorators: [
    () => (
      <div class="flex h-64 justify-center pt-8">
        <NavigationMenu label="Documentation">
          <NavigationMenuMenu>
            <NavigationMenuTrigger>Guides</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuGroup>
                <NavigationMenuGroupLabel>Getting started</NavigationMenuGroupLabel>
                <NavigationMenuItem
                  href="#install"
                  icon={<BookOpen aria-hidden="true" class="size-4" />}
                >
                  Installation
                </NavigationMenuItem>
                <NavigationMenuItem
                  href="#themes"
                  icon={<Layers aria-hidden="true" class="size-4" />}
                  description="The accent, font and appearance axes."
                >
                  Theming
                </NavigationMenuItem>
              </NavigationMenuGroup>
              <NavigationMenuSeparator />
              <NavigationMenuItem
                href="#support"
                icon={<LifeBuoy aria-hidden="true" class="size-4" />}
              >
                Support
              </NavigationMenuItem>
            </NavigationMenuContent>
          </NavigationMenuMenu>
          <NavigationMenuMenu>
            <NavigationMenuTrigger>Components</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuItem href="#button">Button</NavigationMenuItem>
              <NavigationMenuItem href="#dialog">Dialog</NavigationMenuItem>
              <NavigationMenuItem href="#board">Board</NavigationMenuItem>
            </NavigationMenuContent>
          </NavigationMenuMenu>
          <NavigationMenuMenu>
            <NavigationMenuTrigger>Settings</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuItem
                href="#general"
                icon={<Settings aria-hidden="true" class="size-4" />}
              >
                General
              </NavigationMenuItem>
            </NavigationMenuContent>
          </NavigationMenuMenu>
        </NavigationMenu>
      </div>
    ),
  ],
} satisfies Meta<typeof NavigationMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A single entry, for a bar with one panel. */
export const SingleEntry: Story = {
  render: () => (
    <div class="flex h-40 justify-center pt-8">
      <NavigationMenu label="Resources">
        <NavigationMenuMenu>
          <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuItem href="#docs">Documentation</NavigationMenuItem>
            <NavigationMenuItem href="#changelog">Changelog</NavigationMenuItem>
          </NavigationMenuContent>
        </NavigationMenuMenu>
      </NavigationMenu>
    </div>
  ),
}

/** Descriptions make a panel self-explaining rather than a list of nouns. */
export const WithDescriptions: Story = {
  render: () => (
    <div class="flex h-64 justify-center pt-8">
      <NavigationMenu label="Products">
        <NavigationMenuMenu>
          <NavigationMenuTrigger>Products</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuItem href="#hq" description="The agent headquarters.">
              Agent HQ
            </NavigationMenuItem>
            <NavigationMenuItem href="#control" description="Profiles, skills and routing.">
              Control Plane
            </NavigationMenuItem>
            <NavigationMenuItem href="#dev" description="Terminals, worktrees and projects.">
              Dev View
            </NavigationMenuItem>
          </NavigationMenuContent>
        </NavigationMenuMenu>
      </NavigationMenu>
    </div>
  ),
}
