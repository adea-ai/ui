import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Avatar, AvatarFallback, AvatarImage, initialsFrom } from './avatar'

/**
 * Avatar.
 *
 * The fallback is painted *under* the image and the image removes itself on error,
 * which is the arrangement that avoids every flicker case: a cached image covers
 * the fallback on the first paint, a slow image shows initials until it arrives,
 * and a broken image leaves the initials rather than a browser glyph.
 *
 * Initials are derived here rather than by callers, so the rule lives in one place:
 * two words give two letters, one word gives one, and a name with no letters gives
 * nothing rather than a stray dot.
 */
const meta = {
  title: 'Primitives/Data display/Avatar',
  component: Avatar,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

/** Initials only, which is the state most avatars are in most of the time. */
export const Initials: Story = {
  render: () => (
    <div class="flex items-center gap-3">
      <Avatar size="xs">
        <AvatarFallback name="Ada Lovelace" />
      </Avatar>
      <Avatar size="sm">
        <AvatarFallback name="Ada Lovelace" />
      </Avatar>
      <Avatar>
        <AvatarFallback name="Ada Lovelace" />
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback name="Ada Lovelace" />
      </Avatar>
      <Avatar size="xl">
        <AvatarFallback name="Ada Lovelace" />
      </Avatar>
    </div>
  ),
}

/** A single-word name, which yields one initial rather than a padding character. */
export const NameShapes: Story = {
  render: () => (
    <div class="flex items-center gap-4">
      <div class="flex flex-col items-center gap-2">
        <Avatar size="lg">
          <AvatarFallback name="Cortana" />
        </Avatar>
        <code class="text-2xs text-muted-foreground">Cortana → C</code>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Avatar size="lg">
          <AvatarFallback name="Ada Lovelace" />
        </Avatar>
        <code class="text-2xs text-muted-foreground">Ada Lovelace → AL</code>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Avatar size="lg">
          <AvatarFallback name="jean-luc picard" />
        </Avatar>
        <code class="text-2xs text-muted-foreground">two words → JP</code>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Avatar size="lg">
          <AvatarFallback content="🤖" name="Pi" />
        </Avatar>
        <code class="text-2xs text-muted-foreground">content override</code>
      </div>
    </div>
  ),
}

/**
 * A broken image leaves the initials in place.
 *
 * Nothing here is special-cased for the demo: this is what happens whenever
 * `src` fails to load, which is the ordinary case of an avatar pointing at an
 * expired URL.
 */
export const BrokenImage: Story = {
  render: () => (
    <Avatar size="lg">
      <AvatarImage src="https://example.invalid/missing.png" alt="Ada Lovelace" />
      <AvatarFallback name="Ada Lovelace" delay={0} />
    </Avatar>
  ),
}

/** The name is announced, not only drawn, so a screen reader hears who it is. */
export const AccessibleName: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-3">
      <div class="flex items-center gap-3">
        <Avatar>
          <AvatarFallback name="Ada Lovelace" />
        </Avatar>
        <span class="text-sm">
          The initials are <code>aria-hidden</code>; the name is a visually hidden span, so the
          control announces "Ada Lovelace" rather than "AL".
        </span>
      </div>
    </div>
  ),
}

/** The helper is exported, so a caller can reuse the rule outside the component. */
export const InitialsHelper: Story = {
  render: () => (
    <code class="text-sm">initialsFrom('Ada Lovelace') → {initialsFrom('Ada Lovelace')}</code>
  ),
}
