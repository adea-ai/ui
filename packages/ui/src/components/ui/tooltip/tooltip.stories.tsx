import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button/button'
import { Kbd } from '../kbd/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

/**
 * Tooltip.
 *
 * A short, non-interactive explanation on hover or focus. The rules that make a
 * tooltip helpful rather than hostile are structural here: its content cannot
 * receive the pointer, so it can never hold a control, and it is announced via
 * `aria-describedby` rather than replacing a label.
 *
 * **A tooltip is never the only label.** If a control has no accessible name
 * without its tooltip, the tooltip is a label doing the wrong job — a screen
 * reader may never focus the trigger, and a touch user never hovers.
 *
 * Timing lives in the provider, because a tooltip that opens in 200ms in a
 * toolbar and 700ms in a sidebar reads as a bug. The workshop mounts one at the
 * root, exactly as an application does.
 */
const meta = {
  title: 'Primitives/Overlays/Tooltip',
  component: TooltipContent,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof TooltipContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger as={Button} variant="outline">
        Hover me
      </TooltipTrigger>
      <TooltipContent>Runs the soak lane with a 24-hour budget.</TooltipContent>
    </Tooltip>
  ),
}

/**
 * An icon-only control, which is the tooltip's main use.
 *
 * The trigger still carries its own `aria-label`: the tooltip explains, it does
 * not name. Both are present, and they say the same thing.
 */
export const OnAnIconButton: Story = {
  render: () => (
    <div class="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger as={Button} variant="ghost" size="icon-sm" aria-label="Format bold">
          <span aria-hidden="true" class="font-semibold">
            B
          </span>
        </TooltipTrigger>
        <TooltipContent>Bold</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as={Button} variant="ghost" size="icon-sm" aria-label="Format italic">
          <span aria-hidden="true" class="italic">
            I
          </span>
        </TooltipTrigger>
        <TooltipContent>Italic</TooltipContent>
      </Tooltip>
    </div>
  ),
}

/**
 * A tooltip carrying a keyboard shortcut.
 *
 * `Kbd` re-colours itself inside a tooltip, because the tooltip's own surface is
 * the theme-invariant scrim — a key cap drawn for the canvas reads as a hole
 * there.
 */
export const WithShortcut: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger as={Button} variant="outline">
        Command palette
      </TooltipTrigger>
      <TooltipContent class="flex items-center gap-2">
        Open the command palette
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </TooltipContent>
    </Tooltip>
  ),
}

/**
 * Placement, which the popper flips automatically when there is no room.
 *
 * A tooltip in the top-right corner of a window will render below and to the
 * left of its trigger, without the caller asking — collision handling is the
 * reason this is a popper and not a positioned `div`.
 */
export const Placements: Story = {
  render: () => (
    <div class="grid grid-cols-3 gap-4">
      {(['top', 'bottom', 'left', 'right'] as const).map((placement) => (
        <Tooltip placement={placement}>
          <TooltipTrigger as={Button} variant="outline" size="sm">
            {placement}
          </TooltipTrigger>
          <TooltipContent>Placed on the {placement}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
}

/**
 * A row of triggers, which is what the `skipDelayDuration` exists for.
 *
 * After one tooltip has been seen, moving along the row opens the next one
 * immediately for half a second. Without it, crossing a toolbar is four separate
 * waits, and the user stops reading them.
 */
export const ConsecutiveTriggers: Story = {
  render: () => (
    <div class="flex items-center gap-2">
      {['Cut', 'Copy', 'Paste'].map((label) => (
        <Tooltip>
          <TooltipTrigger as={Button} variant="ghost" size="sm">
            {label}
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
}

/** Longer content wraps at a readable measure rather than running as one line. */
export const LongContent: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger as={Button} variant="outline">
        What is a soak lane?
      </TooltipTrigger>
      <TooltipContent>
        A long-running endurance run that asserts a stated budget. It fails on a stalled stream
        rather than on a slow machine.
      </TooltipContent>
    </Tooltip>
  ),
}
