import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Pagination } from './pagination'

/**
 * Pagination.
 *
 * Page navigation for a list the server pages, not for a list the client already
 * holds — slicing an array you already have is a filter, and it should not spend a
 * round trip.
 *
 * Kobalte computes the visible page window and the ellipsis positions and emits
 * `aria-current="page"`, so the control announces which page is active instead of
 * leaving it to colour alone.
 */
const meta = {
  title: 'Primitives/Navigation/Pagination',
  component: Pagination,
  parameters: { layout: 'centered' },
  args: { count: 12, defaultPage: 1 },
  tags: ['autodocs'],
} satisfies Meta<typeof Pagination>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Pagination count={12} defaultPage={1} />,
}

/** A long run, where the window shows ellipses on both sides. */
export const ManyPages: Story = {
  render: () => (
    <div class="w-144">
      <Pagination count={84} defaultPage={40} />
    </div>
  ),
}

/** The last page, where `Next` is disabled rather than absent. */
export const AtTheEnd: Story = {
  render: () => (
    <div class="w-144">
      <Pagination count={12} defaultPage={12} />
    </div>
  ),
}

/** A short run, where every page fits and no ellipsis appears. */
export const FewPages: Story = {
  render: () => (
    <div class="w-144">
      <Pagination count={4} defaultPage={2} />
    </div>
  ),
}
