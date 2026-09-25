import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { AspectRatio } from './aspect-ratio'

/**
 * AspectRatio.
 *
 * Holds a box to a ratio so its content cannot change the layout as it loads. The
 * problem is specific: an image or an embed whose intrinsic size is unknown until it
 * arrives pushes everything below it down when it does, and a grid of previews is
 * where that is most visible.
 *
 * CSS `aspect-ratio` rather than the padding-top trick a decade of libraries used —
 * no wrapper element, and it does not break when the child is positioned.
 */
const meta = {
  title: 'Primitives/Data display/Aspect Ratio',
  component: AspectRatio,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof AspectRatio>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div class="w-96">
      <AspectRatio
        ratio={16 / 9}
        class="bg-surface-sunken overflow-hidden rounded-lg border border-border"
      >
        <div class="flex items-center justify-center text-sm text-muted-foreground">
          A 16:9 box, held whether or not anything has loaded
        </div>
      </AspectRatio>
    </div>
  ),
}

/** A grid of square previews, which is where the property earns its place. */
export const Grid: Story = {
  render: () => (
    <div class="grid w-[32rem] grid-cols-3 gap-3">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <AspectRatio ratio={1} class="bg-surface-sunken rounded-lg border border-border">
          <div class="flex items-center justify-center text-xs text-muted-foreground">{n}</div>
        </AspectRatio>
      ))}
    </div>
  ),
}
