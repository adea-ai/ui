import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button/button'
import { Input } from '../input/input'
import { Label } from '../label/label'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from './popover'

/**
 * Popover.
 *
 * A floating surface with arbitrary content, anchored to a control. Use it for
 * something interactive that would not fit in a menu: a small form, a colour picker,
 * a filter panel. For a list of *actions* use DropdownMenu, which carries the menu
 * keyboard contract; for a sentence of explanation use Tooltip, which is not
 * focusable and cannot hold a control.
 *
 * Kobalte handles anchoring, collision flipping, dismissal on outside click and
 * Escape, and — for a modal popover — the focus trap.
 */
const meta = {
  title: 'Primitives/Overlays/Popover',
  component: PopoverContent,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof PopoverContent>

export default meta
type Story = StoryObj<typeof meta>

/** A small form, which is the reason to reach for a Popover over a menu. */
export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger as={Button} variant="outline">
        Rename
      </PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>Rename session</PopoverTitle>
        <PopoverDescription>
          The title is shown in the sidebar and in search results.
        </PopoverDescription>
        <div class="flex flex-col gap-1.5 px-2 pt-1 pb-2">
          <Label for="popover-title">Title</Label>
          <Input id="popover-title" value="Worktree evidence" />
        </div>
        <div class="flex justify-end gap-2 px-2 pb-2">
          <Button size="sm" variant="ghost">
            Cancel
          </Button>
          <Button size="sm">Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  ),
}

/** Anchored to a wider trigger, which the popper follows. */
export const OnAToolbarControl: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger as={Button} variant="outline" size="sm">
        Filters
      </PopoverTrigger>
      <PopoverContent class="w-64">
        <PopoverTitle>Filter runs</PopoverTitle>
        <div class="flex flex-col gap-2 px-2 pb-2 text-sm">
          <label class="flex items-center gap-2">
            <input type="checkbox" checked /> Passed
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" /> Skipped
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" checked /> Failed
          </label>
        </div>
      </PopoverContent>
    </Popover>
  ),
}

/** A click-outside dismissal, shown so the behaviour is visible in the docs. */
export const Dismissal: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col items-center gap-4">
      <Popover>
        <PopoverTrigger as={Button} variant="outline">
          Open me
        </PopoverTrigger>
        <PopoverContent>
          <div class="p-2 text-sm">
            Click outside, or press Escape, to close. Focus returns to the trigger.
          </div>
        </PopoverContent>
      </Popover>
      <p class="text-sm text-muted-foreground">
        Both dismissal paths are part of the platform contract — a popover that only closes on one
        of them is a small trap.
      </p>
    </div>
  ),
}
