import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { TriangleAlert } from 'lucide-solid'
import { createSignal } from 'solid-js'
import { Button } from '../button/button'
import { Input } from '../input/input'
import { Label } from '../label/label'
import { ModalDialog } from './modal-dialog'

/**
 * ModalDialog.
 *
 * A dialog that owns three things `Dialog` leaves to its caller, each of which is a
 * real defect when missed:
 *
 *   1. **It unmounts while closed.** An always-mounted dialog that closes as a side
 *      effect of an async action can leave Kobalte's `aria-hidden` bookkeeping behind,
 *      hiding the rest of the application from assistive technology.
 *   2. **It marks the background `inert`**, restoring only the elements that were not
 *      already inert — so a nested dialog does not un-inert its parent.
 *   3. **It labels itself explicitly**, rather than relying on the title's id
 *      registration winning a race.
 *
 * Use `Dialog` when you need its composition; use this when you want one that is
 * correct by default.
 */
const meta = {
  title: 'Primitives/Overlays/Modal Dialog',
  component: ModalDialog,
  parameters: { layout: 'centered' },
  args: { open: false, onClose: () => undefined, title: 'Modal dialog' },
  tags: ['autodocs'],
} satisfies Meta<typeof ModalDialog>

export default meta
type Story = StoryObj<typeof meta>

/** A short form, which is the ordinary case. */
export const Default: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Rename workspace</Button>
        <ModalDialog
          open={open()}
          onClose={() => setOpen(false)}
          title="Rename workspace"
          description="The new name is visible to everyone who has access. Existing links keep working."
        >
          <div class="flex flex-col gap-1.5">
            <Label for="modal-name">Name</Label>
            <Input id="modal-name" value="Adea" />
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Save</Button>
          </div>
        </ModalDialog>
      </>
    )
  },
}

/** With a leading mark, for a dialog that is a warning rather than a form. */
export const WithLeading: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Discard changes
        </Button>
        <ModalDialog
          open={open()}
          onClose={() => setOpen(false)}
          title="Discard 14 unsaved files?"
          description="The worktrees are read-only, so these edits exist only in the editor's buffer."
          headerLeading={<TriangleAlert class="size-4 text-warning" aria-hidden="true" />}
        >
          <div class="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={() => setOpen(false)}>
              Discard
            </Button>
          </div>
        </ModalDialog>
      </>
    )
  },
}

/** While closed nothing is mounted, which is the property worth having a story for. */
export const ClosedMountsNothing: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-3 text-sm">
      <ModalDialog open={false} onClose={() => undefined} title="Never rendered" />
      <p class="text-muted-foreground">
        A closed dialog renders nothing at all — no portal, no hidden panel, and no bookkeeping to
        restore. That is what makes it safe to close one as a side effect of an async action, which
        is the case an always-mounted dialog gets wrong.
      </p>
    </div>
  ),
}
