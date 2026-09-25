import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarSeparator,
  MenubarTrigger,
} from './menubar'

/**
 * Menubar.
 *
 * A persistent row of menus at the top of a surface — the desktop application
 * pattern. Each trigger opens its own menu, and the arrow keys move *between* menus
 * once one is open, which is what makes a menubar one control rather than five menus
 * that happen to be adjacent.
 *
 * This is window-level chrome. For actions on one thing, use DropdownMenu.
 */
const meta = {
  title: 'Primitives/Navigation/Menubar',
  component: Menubar,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Menubar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Menubar>
      <MenubarTrigger>File</MenubarTrigger>
      <MenubarContent>
        <MenubarLabel>Session</MenubarLabel>
        <MenubarItem shortcut="⌘N">New session</MenubarItem>
        <MenubarItem shortcut="⌘O">Open project…</MenubarItem>
        <MenubarSeparator />
        <MenubarItem variant="destructive">Close workspace</MenubarItem>
      </MenubarContent>

      <MenubarTrigger>Edit</MenubarTrigger>
      <MenubarContent>
        <MenubarItem shortcut="⌘Z">Undo</MenubarItem>
        <MenubarItem shortcut="⇧⌘Z">Redo</MenubarItem>
        <MenubarSeparator />
        <MenubarItem shortcut="⌘F">Find in files…</MenubarItem>
      </MenubarContent>

      <MenubarTrigger>View</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>Toggle rail</MenubarItem>
        <MenubarItem>Toggle terminal</MenubarItem>
      </MenubarContent>
    </Menubar>
  ),
}
