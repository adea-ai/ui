import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { PixelResizeHandle } from '../pixel-resize-handle/pixel-resize-handle'
import { PixelPane } from './pixel-pane'

const meta = {
  title: 'Layout/Pixel pane',
  component: PixelPane,
} satisfies Meta<typeof PixelPane>
export default meta

type Story = StoryObj<typeof meta>

/** Two fixed panes around a flexible one; the host owns both widths. */
export const FixedAndFlexible: Story = {
  render: () => {
    const [source, setSource] = createSignal(240)
    const [context, setContext] = createSignal(300)
    return (
      <div class="relative flex h-64 w-full">
        <PixelPane width={source()} class="bg-muted p-4 text-sm" aria-label="Sources" role="region">
          Sources: {source()} pixels
        </PixelPane>
        <PixelPane class="p-4 text-sm" aria-label="Workspace" role="region">
          Workspace takes the rest
        </PixelPane>
        <PixelPane
          width={context()}
          class="bg-muted p-4 text-sm"
          aria-label="Context"
          role="region"
        >
          Context: {context()} pixels
        </PixelPane>
        <PixelResizeHandle
          side="left"
          label="Resize sources"
          value={source()}
          minimum={160}
          maximum={400}
          onChange={setSource}
        />
        <PixelResizeHandle
          side="right"
          label="Resize context"
          value={context()}
          minimum={200}
          maximum={420}
          onChange={setContext}
        />
      </div>
    )
  },
}
