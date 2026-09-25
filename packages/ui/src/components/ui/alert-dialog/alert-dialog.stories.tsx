import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog'

/**
 * AlertDialog.
 *
 * A dialog that cannot be dismissed by accident: Escape and a click on the scrim
 * do nothing, and the user must choose one of the actions. That is the whole
 * difference from Dialog, and it is why this exists as its own component rather
 * than a prop — a caller has to reach for it deliberately.
 *
 * The consequence is a rule of use: this is for confirming a destructive or
 * irreversible step. Wrapping an ordinary form in an AlertDialog traps someone who
 * wants to back out.
 *
 * There is deliberately no close button in the corner. An X has no label, and the
 * point of this surface is that every exit is a named choice.
 */
const meta = {
  title: 'Primitives/Overlays/Alert Dialog',
  component: AlertDialogContent,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof AlertDialogContent>

export default meta
type Story = StoryObj<typeof meta>

/** An irreversible deletion: the canonical use. */
export const Destructive: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger as={Button} variant="destructive">
        Delete workspace
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            Every project, session and worktree is removed for everyone. This cannot be undone, and
            there is no export.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel as={Button} variant="ghost">
            Keep it
          </AlertDialogCancel>
          <AlertDialogAction as={Button} variant="destructive">
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}

/** A warning with a real consequence rather than a deletion. */
export const Consequential: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger as={Button} variant="outline">
        Discard changes
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard 14 unsaved files?</AlertDialogTitle>
          <AlertDialogDescription>
            The worktrees are read-only, so these edits exist only in the editor's buffer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel as={Button} variant="ghost">
            Keep editing
          </AlertDialogCancel>
          <AlertDialogAction as={Button} variant="destructive">
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}
