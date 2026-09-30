import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { For } from 'solid-js'
import { VirtualWindow } from './virtual-window'

const meta = {
  title: 'Layout/Virtual window',
  component: VirtualWindow,
  tags: ['autodocs'],
  args: {
    totalSize: 960,
    offset: 240,
  },
} satisfies Meta<typeof VirtualWindow>

export default meta
type Story = StoryObj<typeof meta>

export const MountedRows: Story = {
  render: (args) => (
    <div
      class="h-64 w-80 overflow-auto rounded-md border border-border"
      role="list"
      tabIndex={0}
      aria-label="Documents"
    >
      <VirtualWindow {...args}>
        <For each={['Document 7', 'Document 8', 'Document 9', 'Document 10']}>
          {(name) => (
            <div class="flex h-10 items-center border-b border-border px-3 text-sm" role="listitem">
              {name}
            </div>
          )}
        </For>
      </VirtualWindow>
    </div>
  ),
}
