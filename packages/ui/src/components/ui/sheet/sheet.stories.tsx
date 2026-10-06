import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Button } from '../button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../dropdown-menu/dropdown-menu'
import { FormField } from '../field/field'
import { Input } from '../input/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select/select'
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
 * and it is why `side` is the main decision a caller has to make; `variant` (inset or
 * edge) follows from it unless the caller says otherwise.
 */
const meta = {
  title: 'Primitives/Overlays/Sheet',
  component: SheetContent,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof SheetContent>

export default meta
type Story = StoryObj<typeof meta>

const priorities = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

/**
 * Inset, the default at the end edge: docked below the top bar with an equal
 * gap on three sides, no scrim, a heading with a rule beneath, and a full-width
 * footer band. Menus and selects inside it open on the first click.
 */
export const InsetForm: Story = {
  render: () => {
    const [priority, setPriority] = createSignal(priorities[2]!)
    const [kind, setKind] = createSignal('Feature')
    return (
      <Sheet>
        <SheetTrigger as={Button} variant="outline">
          Edit task
        </SheetTrigger>
        <SheetContent side="end" closeLabel="Close task">
          <SheetHeader>
            <SheetTitle>Edit task</SheetTitle>
            <SheetDescription>Changes apply when you save.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div class="grid gap-4">
              <FormField label="Title">
                <Input value="Polish the board" />
              </FormField>
              <FormField label="Priority">
                <Select
                  options={priorities}
                  value={priority()}
                  onChange={(next) => next && setPriority(next)}
                  optionValue={(option) => option.value}
                  optionTextValue={(option) => option.label}
                  itemComponent={(props) => (
                    <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
                  )}
                >
                  <SelectTrigger class="w-full" aria-label="Priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              </FormField>
              <DropdownMenu>
                <DropdownMenuTrigger as={Button} variant="outline">
                  Type: {kind()}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => setKind('Feature')}>Feature</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setKind('Bug')}>Bug</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setKind('Chore')}>Chore</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button size="sm" variant="ghost" class="me-auto">
              Archive
            </Button>
            <Button size="sm" variant="outline">
              Cancel
            </Button>
            <Button size="sm">Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  },
}

/**
 * The banded anatomy: header and footer on the elevation ladder's subtle-fill
 * rung (`--muted`), scrolling body on the panel surface. This is the two-toned
 * "panel beside the work" treatment — the same rung cards and sidebars sit on —
 * not a new colour. The flat panel remains the default; a host opts a whole
 * sheet family in by passing `band` where it composes the parts.
 */
export const BandedInset: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger as={Button} variant="outline">
        Edit appearance
      </SheetTrigger>
      <SheetContent side="end" closeLabel="Close appearance">
        <SheetHeader band>
          <SheetTitle>Appearance</SheetTitle>
          <SheetDescription>Changes preview immediately.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <p class="text-sm text-muted-foreground">
            The body keeps the panel surface; only the title and decision bands step onto the muted
            rung.
          </p>
        </SheetBody>
        <SheetFooter band>
          <Button size="sm" variant="outline">
            Cancel
          </Button>
          <Button size="sm">Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
}

/** From the end edge, edge to edge over a scrim, for a details inspector. */
export const FromTheEnd: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger as={Button} variant="outline">
        Open inspector
      </SheetTrigger>
      <SheetContent side="end" variant="edge">
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

/** A controlled sheet can return focus to a stable opener outside its trigger. */
export const ControlledExternalOpener: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    let opener: HTMLButtonElement | undefined

    return (
      <Sheet open={open()} onOpenChange={setOpen}>
        <Button ref={(element) => (opener = element)} onClick={() => setOpen(true)}>
          Open from workspace command
        </Button>
        <SheetContent side="start" restoreFocusRef={() => opener}>
          <SheetTitle>Workspace navigation</SheetTitle>
          <Button onClick={() => setOpen(false)}>Close navigation</Button>
        </SheetContent>
      </Sheet>
    )
  },
}
