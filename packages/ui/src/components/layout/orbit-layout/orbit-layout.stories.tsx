import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal, For } from 'solid-js'
import { OrbitItem, OrbitLayout } from './orbit-layout'
import { Button } from '../../ui/button'

/*
 * In OrbitItem's order: index 0 sits at three o'clock and the sequence runs
 * clockwise, so East leads. Listed North-first, every label landed a quarter turn
 * early — "North" at three o'clock, "West" at twelve.
 */
const points = ['East', 'South', 'West', 'North']

const meta = {
  title: 'Layout/Orbit layout',
  component: OrbitLayout,
  tags: ['autodocs'],
  args: {
    radius: 'calc(50% - 4rem)',
  },
} satisfies Meta<typeof OrbitLayout>

export default meta
type Story = StoryObj<typeof meta>

export const FourPoints: Story = {
  render: (args) => {
    const [mode, setMode] = createSignal<'radial' | 'flow'>('radial')
    return (
      <div class="flex flex-col gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode((current) => (current === 'radial' ? 'flow' : 'radial'))}
        >
          Switch layout mode
        </Button>
        <OrbitLayout
          {...args}
          mode={mode()}
          role="list"
          aria-label="Four points around a circle"
          class="size-80 rounded-lg border border-border"
        >
          <For each={points}>
            {(point, index) => (
              <OrbitItem index={index()} count={points.length} role="listitem">
                <Button size="icon-lg" variant="outline" aria-label={point}>
                  {point.slice(0, 1)}
                </Button>
              </OrbitItem>
            )}
          </For>
        </OrbitLayout>
      </div>
    )
  },
}

export const ResponsiveFlow: Story = {
  args: {
    mode: 'flow',
  },
  render: (args) => (
    <OrbitLayout
      {...args}
      role="list"
      aria-label="Responsive point grid"
      class="grid-cols-1 sm:grid-cols-2"
    >
      <For each={points}>
        {(point, index) => (
          <OrbitItem index={index()} count={points.length} role="listitem">
            <Button variant="outline" class="w-full" aria-label={point}>
              {point}
            </Button>
          </OrbitItem>
        )}
      </For>
    </OrbitLayout>
  ),
}
