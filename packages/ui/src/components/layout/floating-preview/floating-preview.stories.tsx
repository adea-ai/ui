import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../../ui/button'
import { FloatingPreview } from './floating-preview'

const meta = {
  title: 'Layout/Floating Preview',
  component: FloatingPreview,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof FloatingPreview>
export default meta
type Story = StoryObj<typeof meta>

export const Placeholder: Story = {
  args: {
    label: 'Preview window',
    source: { width: 1600, height: 1000 },
    children: (
      <div class="grid h-full place-items-center text-sm text-muted-foreground">
        Preview content is supplied by the host.
      </div>
    ),
  },
  render: () => (
    <div class="relative h-screen overflow-hidden bg-background p-4">
      <FloatingPreview
        label="Preview window"
        source={{ width: 1600, height: 1000 }}
        actions={
          <Button size="xs" variant="outline">
            Actions
          </Button>
        }
      >
        <div class="grid h-full place-items-center text-sm text-muted-foreground">
          Preview content is supplied by the host.
        </div>
      </FloatingPreview>
    </div>
  ),
}
