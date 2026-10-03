import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { For } from 'solid-js'
import { Heading, Text } from './typography'

/**
 * Heading and Text.
 *
 * The type ladder as roles. A call site names what the text *is* — a page title,
 * a section heading, a caption — and the size, weight, leading and tracking follow
 * from that. Nothing here takes a size class from outside.
 *
 * The stories below are the specification: every heading size at its default
 * element, the one case where the element departs from the size, both tones, and
 * every text variant.
 */
const meta = {
  title: 'Primitives/Data display/Typography',
  component: Heading,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Heading>

export default meta
type Story = StoryObj<typeof meta>

const headingSizes = [
  { size: 'display', sample: 'Nothing here yet', note: 'text-3xl · 600 · h1' },
  { size: 'title', sample: '1,284 runs this week', note: 'text-2xl · 600 · h1' },
  { size: 'page', sample: 'Workspace settings', note: 'text-xl · 600 · h1' },
  { size: 'section', sample: 'Members', note: 'text-lg · 600 · h2' },
  { size: 'card', sample: 'Delete this thread?', note: 'text-base · 600 · h3' },
  { size: 'subsection', sample: 'Recent activity', note: 'text-sm · 600 · h4' },
] as const

/**
 * Every heading size, each on its default element. The sizes span the ladder from
 * `text-3xl` down to `text-sm`; every one is 600 because weights stop there.
 */
export const HeadingSizes: Story = {
  render: () => (
    <div class="flex flex-col gap-5">
      <For each={headingSizes}>
        {(entry) => (
          <div class="flex flex-col gap-1">
            <Heading size={entry.size}>{entry.sample}</Heading>
            <Text variant="caption" tone="muted">
              {entry.note}
            </Text>
          </div>
        )}
      </For>
    </div>
  ),
}

/**
 * Size and element are separate decisions. A settings section's title is
 * card-sized but it is the first heading under the page title, so it is an `h2`;
 * a dialog-sized title can sit inside an `h1` page. `as` changes the element and
 * leaves the appearance alone.
 */
export const ElementIsNotSize: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      <Heading size="page">Settings</Heading>
      <Heading as="h2" size="card">
        Notifications
      </Heading>
      <Text tone="muted">Choose which events reach you outside the app.</Text>
    </div>
  ),
}

/**
 * `leading="none"` trims the line box to the glyphs, for a title whose
 * container's gap already sets the rhythm. The outlines show the difference.
 */
export const Leading: Story = {
  render: () => (
    <div class="flex items-start gap-6">
      <Heading size="card" class="border border-dashed border-border">
        Rung leading
      </Heading>
      <Heading size="card" leading="none" class="border border-dashed border-border">
        No leading
      </Heading>
    </div>
  ),
}

/** A headline figure: tabular digits keep two numbers in a row comparable. */
export const NumericFigures: Story = {
  render: () => (
    <div class="flex gap-8">
      <div class="flex flex-col gap-1">
        <Text variant="caption" tone="muted">
          Runs
        </Text>
        <Heading as="span" size="title" numeric>
          1,111
        </Heading>
      </div>
      <div class="flex flex-col gap-1">
        <Text variant="caption" tone="muted">
          Failures
        </Text>
        <Heading as="span" size="title" numeric>
          8,808
        </Heading>
      </div>
    </div>
  ),
}

/**
 * Every text variant. `text-sm` carries three weights by role; `caption` and
 * `micro` are the two steps below it; `code` is the mono face.
 */
export const TextVariants: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-3">
      <Text>
        Body copy at 14px and 400. This is the interface default, and descriptions, help text and
        empty-state copy all use it.
      </Text>
      <Text variant="label">Workspace name</Text>
      <Text variant="strong">Billing is paused until the card is updated.</Text>
      <Text variant="caption" tone="muted">
        Updated 3 minutes ago
      </Text>
      <Text variant="micro" tone="muted">
        Ln 42, Col 7
      </Text>
      <Text variant="code">a1b2c3d</Text>
    </div>
  ),
}

/**
 * Tone is a colour axis independent of size. The default inherits, which is what
 * a label on a filled surface needs; `muted` is secondary text.
 */
export const Tones: Story = {
  render: () => (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <Heading size="card" tone="foreground">
          Foreground heading
        </Heading>
        <Heading size="card" tone="muted">
          Muted heading
        </Heading>
      </div>
      <div class="flex flex-col gap-1">
        <Text tone="foreground">Foreground body</Text>
        <Text tone="muted">Muted body</Text>
      </div>
      <div class="rounded-md bg-primary p-3 text-primary-foreground">
        <Text variant="label">Inherits the primary surface's foreground</Text>
      </div>
    </div>
  ),
}
