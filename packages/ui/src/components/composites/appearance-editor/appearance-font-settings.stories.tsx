import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { AppearanceFontSettingsFixture } from '../../../../tests/fixtures/appearance-font-settings'

const meta = {
  title: 'Composites/AppearanceEditor/Font Settings',
  component: AppearanceFontSettingsFixture,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AppearanceFontSettingsFixture>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
