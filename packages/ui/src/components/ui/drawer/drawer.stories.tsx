import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button/button'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer'

/**
 * Drawer.
 *
 * A sheet the user can drag away: it opens from an edge, carries a handle, and
 * closes by swipe as well as by button. The drag affordance is the reason to choose
 * it over Sheet — the gesture is for content the user is *finishing* with, not for
 * browsing.
 *
 * On a large window a Drawer is often the wrong control: dragging is a touch idiom,
 * and on a desktop the same content is better as a Sheet or a Dialog. The
 * exceptions are the surfaces a pointer also drags naturally.
 *
 * The whole sheet is the drag target — corvu makes it so, exactly as the platform's
 * own sheets behave. `withHandle` draws an affordance, not a hit area.
 */
const meta = {
  title: 'Primitives/Overlays/Drawer',
  component: DrawerContent,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof DrawerContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger as={Button} variant="outline">
        Open drawer
      </DrawerTrigger>
      <DrawerContent withHandle side="bottom">
        <DrawerHeader>
          <DrawerTitle>Lane summary</DrawerTitle>
          <DrawerDescription>
            The last four runs. Drag the sheet down, or use the button.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <ul class="flex flex-col gap-2 text-sm">
            <li>soak · 24h 00m · passed</li>
            <li>endurance · 6h 12m · passed</li>
            <li>preview-perf · 30m · passed</li>
            <li>soak · 0h 47m · failed</li>
          </ul>
        </DrawerBody>
        <DrawerFooter>
          <Button size="sm">View full report</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
}

/** From the side, which is the shape an inspector takes on a narrow window. */
export const FromTheSide: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger as={Button} variant="outline">
        Open inspector
      </DrawerTrigger>
      <DrawerContent side="right">
        <DrawerHeader>
          <DrawerTitle>Worktree</DrawerTitle>
          <DrawerDescription>feat/m12-397-worktrees</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted-foreground">Base</dt>
            <dd>main</dd>
            <dt class="text-muted-foreground">Materialised</dt>
            <dd>copy-on-write</dd>
            <dt class="text-muted-foreground">Digest</dt>
            <dd class="font-mono text-xs">sha256:9f2c…</dd>
          </dl>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  ),
}
