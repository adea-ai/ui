import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { fn } from 'storybook/test'
import { SceneControls } from './scene-controls'

const meta = {
  title: 'Composites/SceneControls',
  component: SceneControls,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof SceneControls>

export default meta
type Story = StoryObj<typeof meta>

/** Movement and jump report a held state; zoom actions are one-shot callbacks. */
export const Controls: Story = {
  args: {
    onMovementChange: fn(),
    onJumpChange: fn(),
    onZoomIn: fn(),
    onZoomOut: fn(),
  },
}

/** The 2xl buttons remain 48px when the consumer selects compact density. */
export const CompactTouchTargets: Story = {
  render: () => (
    <div data-density="compact" class="flex flex-col gap-3">
      <p class="max-w-prose text-sm text-muted-foreground">
        Compact density tightens the standard control ladder while scene actions keep a stable 48px
        touch target.
      </p>
      <SceneControls onMovementChange={fn()} onJumpChange={fn()} />
    </div>
  ),
}

/** Accessible action names stay separate from localized hold instructions. */
export const LocalizedHoldInstructions: Story = {
  render: () => (
    <SceneControls
      labels={{ forward: 'Avanzar', forwardTooltip: 'Mantén para avanzar' }}
      onMovementChange={fn()}
      onJumpChange={fn()}
    />
  ),
}

/** The composition wraps its groups when its host provides a narrow region. */
export const NarrowRegion: Story = {
  render: () => (
    <div class="max-w-56 border border-border p-2">
      <SceneControls onMovementChange={fn()} onJumpChange={fn()} onZoomIn={fn()} onZoomOut={fn()} />
    </div>
  ),
}
