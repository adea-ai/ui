import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button/button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet'

/**
 * Sheet.
 *
 * A dialog anchored to an edge of the window rather than centred. Use it when the
 * content is a *panel beside* the work — a details inspector, a filter rail, a
 * settings flyout — so the user keeps the context it belongs to in view.
 *
 * A centred dialog interrupts; a sheet is inspected. That is the whole distinction,
 * and it is why `side` is the only decision a caller has to make.
 */
const meta = {
  title: 'Primitives/Overlays/Sheet',
  component: SheetContent,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof SheetContent>

export default meta
type Story = StoryObj<typeof meta>

/** From the end edge, which is where a details inspector belongs. */
export const FromTheEnd: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger as={Button} variant="outline">
        Open inspector
      </SheetTrigger>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>Run r-1042</SheetTitle>
          <SheetDescription>soak · 24h 00m · passed</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted-foreground">Budget</dt>
            <dd>honoured</dd>
            <dt class="text-muted-foreground">Stalled streams</dt>
            <dd>0</dd>
            <dt class="text-muted-foreground">Resyncs</dt>
            <dd>0</dd>
          </dl>
        </SheetBody>
        <SheetFooter>
          <Button size="sm" variant="ghost">
            Close
          </Button>
          <Button size="sm">Open report</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
}

/** From the start edge, for a filter rail or a file tree. */
export const FromTheStart: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger as={Button} variant="outline">
        Filters
      </SheetTrigger>
      <SheetContent side="start" class="w-72">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Applies to the current list only.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div class="flex flex-col gap-2 text-sm">
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
        </SheetBody>
      </SheetContent>
    </Sheet>
  ),
}

/** From the bottom, for a compact surface that keeps the width of the window. */
export const FromTheBottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger as={Button} variant="outline">
        Keyboard shortcuts
      </SheetTrigger>
      <SheetContent side="bottom" class="max-h-[60vh]">
        <SheetHeader>
          <SheetTitle>Shortcuts</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <span class="text-muted-foreground">Command palette</span>
            <span class="font-mono text-xs">⌘K</span>
            <span class="text-muted-foreground">Toggle terminal</span>
            <span class="font-mono text-xs">Ctrl+`</span>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  ),
}
