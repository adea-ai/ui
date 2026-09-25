import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Copy, Download, Pencil, Trash2 } from 'lucide-solid'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './context-menu'

/**
 * ContextMenu.
 *
 * The same actions as DropdownMenu, opened by right-click. The trigger is the
 * region the menu belongs to, and the menu opens at the pointer.
 *
 * The accessibility rule for this component is not about its own markup: a context
 * menu must never hold the *only* route to an action, because a right-click is
 * unavailable on touch and undiscoverable on a trackpad. Every item here should also
 * appear somewhere reachable — usually a DropdownMenu on the same row.
 */
const meta = {
  title: 'Primitives/Overlays/Context Menu',
  component: ContextMenuContent,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof ContextMenuContent>

export default meta
type Story = StoryObj<typeof meta>

/** The canonical use: actions on a file row. */
export const Default: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      <p class="text-sm text-muted-foreground">Right-click the row below.</p>
      <ContextMenu>
        <ContextMenuTrigger class="flex w-80 items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm">
          <span class="font-mono text-xs">side-rail.tsx</span>
        </ContextMenuTrigger>
        <ContextMenuContent class="w-52">
          <ContextMenuLabel>side-rail.tsx</ContextMenuLabel>
          <ContextMenuItem>
            <Pencil />
            Rename
          </ContextMenuItem>
          <ContextMenuItem>
            <Copy />
            Copy path
          </ContextMenuItem>
          <ContextMenuItem>
            <Download />
            Download
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">
            <Trash2 />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  ),
}

/** A larger region, where the menu targets whatever was clicked inside it. */
export const OnARegion: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger class="flex h-48 w-96 flex-col items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Right-click anywhere in this pane
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>New file</ContextMenuItem>
        <ContextMenuItem>New folder</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>Reveal in Finder</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
}
