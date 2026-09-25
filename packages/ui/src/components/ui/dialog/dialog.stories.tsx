import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Button } from '../button/button'
import { Input } from '../input/input'
import { Label } from '../label/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'

/**
 * Dialog.
 *
 * A modal surface for a decision or a short task. The portal keeps the panel out
 * of the app's stacking and overflow contexts, the overlay dims what is behind
 * it, and Kobalte handles the focus trap, the escape key, scroll locking and
 * returning focus to the trigger on close.
 *
 * The close button is part of the content rather than optional, because every
 * modal needs a way out that is not the keyboard. A dialog whose only exit is
 * Escape is a trap for anyone using a pointer.
 */
const meta = {
  title: 'Primitives/Overlays/Dialog',
  component: DialogContent,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof DialogContent>

export default meta
type Story = StoryObj<typeof meta>

/** The canonical shape: a title, a sentence, and two actions. */
export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger as={Button}>Rename workspace</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename workspace</DialogTitle>
          <DialogDescription>
            The new name is visible to everyone who has access. Existing links keep working.
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-1.5">
          <Label for="dialog-workspace-name">Name</Label>
          <Input id="dialog-workspace-name" value="Adea" />
        </div>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

/**
 * A destructive confirmation is the one case where the primary action is red.
 *
 * Note that this is a Dialog rather than an AlertDialog: the action is
 * recoverable from the trash, so trapping the user in a modal is the wrong
 * trade. Where the action cannot be undone, use AlertDialog.
 */
export const Destructive: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger as={Button} variant="destructive">
        Remove member
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Ada from the workspace?</DialogTitle>
          <DialogDescription>
            They lose access immediately. Their work stays, and they can be invited again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Remove</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

/**
 * A dialog that holds another overlay.
 *
 * The menu renders above the dialog because the stacking scale puts menus above
 * dialogs — a dialog can contain a menu, but a menu cannot contain a dialog.
 * That ordering is a token, not an arbitrary z-index, which is why it holds.
 */
export const WithNestedOverlay: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger as={Button} variant="outline">
        Export report
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export report</DialogTitle>
          <DialogDescription>
            Choose a format. The file is written to your downloads folder.
          </DialogDescription>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">
          A nested menu would render above this panel — see the Dropdown Menu page for the stacking
          contract.
        </p>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

/**
 * A dialog that refuses to be dismissed, for work that must finish.
 *
 * Escape and the scrim still work — see `AlertDialog` for the surface that blocks
 * them — but the close button is suppressed because there is nothing useful the
 * user could do by closing it mid-write.
 */
export const NoCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger as={Button} variant="outline">
        Apply migration
      </DialogTrigger>
      <DialogContent closeButton={false}>
        <DialogHeader>
          <DialogTitle>Applying migration…</DialogTitle>
          <DialogDescription>
            This takes about thirty seconds. Do not close the window.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
}

/** A controlled dialog, for a flow where the app decides when it opens. */
export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false)

    return (
      <div class="flex flex-col items-center gap-3">
        <Button onClick={() => setOpen(true)}>Open programmatically</Button>
        <p class="text-sm text-muted-foreground">Open: {String(open())}</p>
        <Dialog open={open()} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opened by the app</DialogTitle>
              <DialogDescription>
                The trigger is elsewhere, so the open state has to be owned by the caller.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  },
}
