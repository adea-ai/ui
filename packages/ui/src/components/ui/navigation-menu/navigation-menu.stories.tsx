import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuLinkItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from './navigation-menu'

/**
 * NavigationMenu.
 *
 * A navigation bar whose items open panels, where the panels **share one surface**:
 * as the pointer moves from one trigger to the next, the panel resizes and slides
 * between them rather than closing and reopening. That continuity is the whole reason
 * this is a component and not a row of Popovers.
 *
 * This is for navigation — moving between areas. For a list of commands, use
 * DropdownMenu.
 */
const meta = {
  title: 'Primitives/Navigation/Navigation Menu',
  component: NavigationMenu,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof NavigationMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Work</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLinkItem>
              <NavigationMenuLink href="#storybook-preview-iframe">Sessions</NavigationMenuLink>
            </NavigationMenuLinkItem>
            <NavigationMenuLinkItem>
              <NavigationMenuLink href="#storybook-preview-iframe">Worktrees</NavigationMenuLink>
            </NavigationMenuLinkItem>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger>Build</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLinkItem>
              <NavigationMenuLink href="#storybook-preview-iframe">Lanes</NavigationMenuLink>
            </NavigationMenuLinkItem>
            <NavigationMenuLinkItem>
              <NavigationMenuLink href="#storybook-preview-iframe">Artifacts</NavigationMenuLink>
            </NavigationMenuLinkItem>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuLink href="#storybook-preview-iframe">Settings</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuViewport />
    </NavigationMenu>
  ),
}
