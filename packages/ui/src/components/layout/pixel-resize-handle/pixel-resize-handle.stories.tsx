import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { PixelResizeHandle } from './pixel-resize-handle'

const meta = {
  title: 'Layout/Pixel resize handle',
  component: PixelResizeHandle,
  args: { side: 'right', value: 272, minimum: 208, maximum: 448, onChange: () => {} },
} satisfies Meta<typeof PixelResizeHandle>
export default meta

type Story = StoryObj<typeof meta>

/** No `grip` prop: pins the published default — the quieter rung. */
export const RightPane: Story = {
  render: () => {
    const [width, setWidth] = createSignal(272)
    return (
      <div class="flex h-64 justify-end">
        <div class="relative h-full bg-muted p-4" style={{ width: `${width()}px` }}>
          <PixelResizeHandle
            side="right"
            value={width()}
            minimum={208}
            maximum={448}
            onChange={setWidth}
            label="Resize utility pane"
          />
          <p class="text-sm">Utility pane: {width()} pixels</p>
        </div>
      </div>
    )
  },
}

/** Hosts that want the heavier bordered chip opt back in explicitly. */
export const ChipGrip: Story = {
  render: () => {
    const [width, setWidth] = createSignal(272)
    return (
      <div class="flex h-64 justify-end">
        <div class="relative h-full bg-muted p-4" style={{ width: `${width()}px` }}>
          <PixelResizeHandle
            side="right"
            value={width()}
            minimum={208}
            maximum={448}
            grip="chip"
            onChange={setWidth}
            label="Resize utility pane"
          />
          <p class="text-sm">Utility pane: {width()} pixels</p>
        </div>
      </div>
    )
  },
}
