import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { ScrollArea } from './scroll-area'

/**
 * ScrollArea.
 *
 * A scroll container with the design system's scrollbar treatment, plus an optional
 * fade at each edge so a long list reads as continuing rather than ending at the
 * fold.
 *
 * This is a styled native scroller, not a reimplementation of scrolling. The
 * platform scroller already handles momentum, rubber-banding, keyboard paging,
 * trackpad gestures, `scrollIntoView`, focus-into-view and find-in-page. A custom
 * scrollbar over a transformed div gives up every one of those to gain nothing but
 * the scrollbar's appearance, which CSS already controls.
 */
const meta = {
  title: 'Layout/Scroll area',
  component: ScrollArea,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof ScrollArea>

export default meta
type Story = StoryObj<typeof meta>

const longList = Array.from({ length: 40 }, (_, index) => `Session ${index + 1}`)

/** A vertical scroller with the edge fade, which is the default. */
export const Vertical: Story = {
  render: () => (
    <ScrollArea class="h-64 w-80 rounded-xl border border-border p-3" fade>
      <ul class="flex flex-col gap-2 text-sm">
        {longList.map((item) => (
          <li>{item}</li>
        ))}
      </ul>
    </ScrollArea>
  ),
}

/** Without the fade, for a short list where the edges are always visible. */
export const WithoutFade: Story = {
  render: () => (
    <ScrollArea class="h-40 w-80 rounded-xl border border-border p-3">
      <ul class="flex flex-col gap-2 text-sm">
        {longList.slice(0, 4).map((item) => (
          <li>{item}</li>
        ))}
      </ul>
    </ScrollArea>
  ),
}

/** The system scrollbar hidden, for a chrome-less list inside a panel. */
export const HiddenScrollbar: Story = {
  render: () => (
    <ScrollArea class="h-64 w-80 rounded-xl border border-border p-3" hideScrollbar>
      <ul class="flex flex-col gap-2 text-sm">
        {longList.map((item) => (
          <li>{item}</li>
        ))}
      </ul>
    </ScrollArea>
  ),
}

/** A horizontal scroller, for a row of tabs or chips that overflows. */
export const Horizontal: Story = {
  render: () => (
    <ScrollArea orientation="horizontal" class="w-80 rounded-xl border border-border p-3">
      <div class="flex gap-2">
        {Array.from({ length: 20 }, (_, index) => (
          <span class="shrink-0 rounded-md border border-border px-2 py-1 text-xs">
            filter-{index + 1}
          </span>
        ))}
      </div>
    </ScrollArea>
  ),
}
