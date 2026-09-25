import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Copy, Download, Pencil, Share2, Trash2 } from 'lucide-solid'
import { Button } from '../button/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu'

/**
 * DropdownMenu.
 *
 * A list of actions on a trigger: "what can I do with this thing". It is not a
 * Select, which holds a *value* the user is choosing, and not a Popover, which
 * holds arbitrary content.
 *
 * Kobalte supplies the full menu contract — arrow keys, typeahead, the roving
 * highlight, Escape, and focus returning to the trigger — which is exactly what a
 * hand-rolled `div` with click handlers gets wrong.
 */
const meta = {
  title: 'Primitives/Overlays/Dropdown Menu',
  component: DropdownMenuContent,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof DropdownMenuContent>

export default meta
type Story = StoryObj<typeof meta>

/** The default shape: a handful of actions with shortcut hints. */
export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger as={Button} variant="outline">
        Actions
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem shortcut="⌘E">
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem shortcut="⌘D">
          <Copy />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Share2 />
          Share
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" shortcut="⌘⌫">
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

/**
 * Grouped actions with a labelled section.
 *
 * Groups exist for reading, not for navigation: they say "these are the operations
 * on the file" and "these are the operations on the selection". A menu with more
 * than about nine items wants a command palette instead.
 */
export const Grouped: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger as={Button} variant="outline">
        File
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-56">
        <DropdownMenuLabel>This file</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy />
            Duplicate
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Selection</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Download />
            Export selection
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive">
            <Trash2 />
            Delete selection
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

/**
 * Checkbox items for a multi-select, radio items for a single one.
 *
 * Both are real menu items with the menu's keyboard contract; they are not a
 * checkbox sitting inside a menu row, which is what a hand-rolled version
 * usually ends up being.
 */
export const SelectionItems: Story = {
  render: () => (
    <div class="flex gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger as={Button} variant="outline">
          Columns
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-48">
          <DropdownMenuCheckboxItem defaultChecked>Status</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem defaultChecked>Duration</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem>Coverage</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem>Owner</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger as={Button} variant="outline">
          Sort by
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-48">
          <DropdownMenuRadioGroup defaultValue="recent">
            <DropdownMenuRadioItem value="recent">Most recent</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="duration">Duration</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
}

/**
 * A submenu, for a small second level that does not deserve its own surface.
 *
 * One level is a menu; two is a hierarchy the user has to hold in their head. If
 * the second level needs a third, the right answer is a dialog with a list in it.
 */
export const WithSubmenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger as={Button} variant="outline">
        Share
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-56">
        <DropdownMenuItem>
          <Copy />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Export as</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Markdown</DropdownMenuItem>
            <DropdownMenuItem>JSON</DropdownMenuItem>
            <DropdownMenuItem>CSV</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Manage access…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

/**
 * A menu triggered by an icon-only button — the shape a row action takes.
 *
 * The trigger carries an `aria-label`, because a glyph has no accessible name and
 * an unnamed menu trigger is unreachable by voice control.
 */
export const IconTrigger: Story = {
  render: () => (
    <div class="flex items-center gap-3 rounded-lg border border-border px-4 py-2">
      <span class="text-sm">packages/ui</span>
      <DropdownMenu>
        <DropdownMenuTrigger as={Button} variant="ghost" size="icon-sm" aria-label="More actions">
          <span aria-hidden="true">···</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-44">
          <DropdownMenuItem>Open in editor</DropdownMenuItem>
          <DropdownMenuItem>Reveal in files</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
}
