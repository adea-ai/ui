import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { ThemeModeToggle } from './theme-mode-toggle'

const meta = {
  title: 'Composites/Theme mode toggle',
  component: ThemeModeToggle,
  args: { mode: 'system', onModeChange: () => {} },
} satisfies Meta<typeof ThemeModeToggle>
export default meta
type Story = StoryObj<typeof meta>

// Host state stays controlled; keyboard and tooltip behavior come from the shared controls.
export const Controlled: Story = {
  render: () => {
    const [mode, setMode] = createSignal<'light' | 'dark' | 'system'>('system')
    return <ThemeModeToggle mode={mode()} onModeChange={setMode} />
  },
}
export const WithLabels: Story = {
  args: { withLabels: true },
}
export const Disabled: Story = {
  args: { disabled: true },
}
