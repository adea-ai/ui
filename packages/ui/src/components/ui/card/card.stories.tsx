import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'
import { Badge } from '../badge/badge'
import { Button } from '../button/button'

/**
 * Card.
 *
 * A surface that sits on the canvas. Every card carries its own edge — a border
 * — because in the light theme `--card` and `--background` are both white, and
 * a borderless card there is invisible. Making the border structural rather than
 * optional is what stops one app's cards from reading as floating panels and
 * another's as nothing at all.
 *
 * The parts are separate components rather than a fixed template because a
 * card's header, content and footer have different padding on purpose: the
 * header and footer are tight, the content breathes.
 */
const meta = {
  title: 'Primitives/Data display/Card',
  component: Card,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

/** The four parts, in the order they stack. */
export const Default: Story = {
  render: () => (
    <Card class="w-96">
      <CardHeader>
        <CardTitle>Nightly soak</CardTitle>
        <CardDescription>
          Runs the endurance lane at 02:00 and reports a budget verdict.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">
          The last run completed in 24h 00m with no stalled stream and no resync.
        </p>
      </CardContent>
      <CardFooter class="gap-2">
        <Button size="sm">View report</Button>
        <Button size="sm" variant="ghost">
          Dismiss
        </Button>
      </CardFooter>
    </Card>
  ),
}

/** A card with a trailing action in the header, for a row-level control. */
export const WithAction: Story = {
  render: () => (
    <Card class="w-96">
      <CardHeader>
        <CardTitle>Release 0.55.0</CardTitle>
        <CardDescription>Cut from main on 24 September.</CardDescription>
        <CardAction>
          <Badge variant="success">Published</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">
          Twelve commits. The version PR was squashed into main and the tag was pushed by the
          release workflow.
        </p>
      </CardContent>
    </Card>
  ),
}

/**
 * Cards in a grid share one gap and one width rule, which is why the grid lives
 * here rather than in each view.
 */
export const InAGrid: Story = {
  render: () => (
    <div class="grid w-192 grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardDescription>Coverage</CardDescription>
          <CardTitle class="text-xl tabular-nums">83.4%</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-xs text-muted-foreground">Lines, across the package.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Stories</CardDescription>
          <CardTitle class="text-xl tabular-nums">128</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-xs text-muted-foreground">Every one with an accessibility check.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Primitives</CardDescription>
          <CardTitle class="text-xl tabular-nums">44</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-xs text-muted-foreground">Built on Kobalte and corvu.</p>
        </CardContent>
      </Card>
    </div>
  ),
}

/**
 * A description-only card, for a link or a summary where a title would be
 * redundant with the context around it.
 */
export const Minimal: Story = {
  render: () => (
    <Card class="w-96 gap-0 py-3">
      <CardContent>
        <p class="text-sm">
          A card with no header. The border is what makes it a distinct surface; nothing else is
          required.
        </p>
      </CardContent>
    </Card>
  ),
}
