import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Skeleton } from './skeleton'

/**
 * Skeleton.
 *
 * A placeholder that stands in for content whose shape is already known. It carries
 * `aria-hidden` and no text, because the loading state is announced by the region
 * that owns it — a skeleton that said "loading" would announce it once per bar.
 *
 * A skeleton is only honest when the shape is known. Where it is not, use Spinner:
 * a skeleton that does not match the content it replaces makes the page jump twice,
 * which is worse than a spinner.
 */
const meta = {
  title: 'Primitives/Feedback/Skeleton',
  component: Skeleton,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Skeleton class="h-4 w-48" />,
}

/** A list of rows, where the skeleton matches the row height it replaces. */
export const ListRows: Story = {
  render: () => (
    <div class="flex w-80 flex-col gap-2 rounded-xl border border-border p-3">
      {Array.from({ length: 6 }, () => (
        <div class="flex items-center gap-2.5">
          <Skeleton class="size-8 rounded-full" />
          <div class="flex flex-1 flex-col gap-1.5">
            <Skeleton class="h-3 w-32" />
            <Skeleton class="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  ),
}

/** A card, where the skeleton matches the card's own geometry. */
export const CardSkeleton: Story = {
  render: () => (
    <div class="flex w-96 flex-col gap-3 rounded-xl border border-border p-4">
      <Skeleton class="h-4 w-40" />
      <Skeleton class="h-3 w-64" />
      <Skeleton class="h-3 w-52" />
      <div class="mt-2 flex gap-2">
        <Skeleton class="h-8 w-20 rounded-md" />
        <Skeleton class="h-8 w-20 rounded-md" />
      </div>
    </div>
  ),
}

/**
 * A table's loading state, with a header that is real rather than a skeleton.
 *
 * The column headers are already known, so they are drawn: a skeleton over a header
 * the app already has makes the table jump when the data lands.
 */
export const TableSkeleton: Story = {
  render: () => (
    <table class="w-[32rem] text-sm">
      <thead>
        <tr class="border-b border-border text-xs text-muted-foreground">
          <th class="px-3 py-2 text-start font-medium">Run</th>
          <th class="px-3 py-2 text-start font-medium">Lane</th>
          <th class="px-3 py-2 text-end font-medium">Duration</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 5 }, () => (
          <tr class="border-b border-border">
            <td class="px-3 py-2">
              <Skeleton class="h-3 w-16" />
            </td>
            <td class="px-3 py-2">
              <Skeleton class="h-3 w-20" />
            </td>
            <td class="px-3 py-2">
              <Skeleton class="ml-auto h-3 w-12" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}
