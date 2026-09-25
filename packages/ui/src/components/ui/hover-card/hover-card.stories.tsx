import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Avatar, AvatarFallback } from '../avatar/avatar'
import { Button } from '../button/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card'

/**
 * HoverCard.
 *
 * A rich preview shown on hover: a user's profile, a file's summary, a link's
 * destination. The difference from Tooltip is that this may be hovered *into* — the
 * pointer can leave the trigger, cross the gap, and read the card.
 *
 * Because it opens only on hover, its content must also be reachable another way,
 * usually by clicking the trigger. A hover card that holds the only route to
 * something is unreachable by keyboard and by touch.
 */
const meta = {
  title: 'Primitives/Overlays/Hover Card',
  component: HoverCardContent,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof HoverCardContent>

export default meta
type Story = StoryObj<typeof meta>

/** A profile preview, which is the canonical use. */
export const UserProfile: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger as={Button} variant="link">
        @ada
      </HoverCardTrigger>
      <HoverCardContent>
        <div class="flex items-start gap-3">
          <Avatar size="lg">
            <AvatarFallback name="Ada Lovelace" />
          </Avatar>
          <div class="flex flex-col gap-1">
            <div class="text-sm font-medium">Ada Lovelace</div>
            <div class="text-xs text-muted-foreground">@ada · joined 2026</div>
            <p class="mt-1 text-sm text-muted-foreground">
              Maintains the design system. Holds the strongest opinions about line-height.
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
}

/** A file summary, pointing at something the user can then open. */
export const FilePreview: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger as={Button} variant="link">
        side-rail.tsx
      </HoverCardTrigger>
      <HoverCardContent class="w-80">
        <div class="flex flex-col gap-2">
          <div class="text-sm font-medium">side-rail.tsx</div>
          <p class="text-xs text-muted-foreground">
            The rail's two forms, and the tooltip wiring that keeps a collapsed label in the
            accessibility tree.
          </p>
          <code class="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs">
            packages/ui/src/components/layout/side-rail/
          </code>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
}
