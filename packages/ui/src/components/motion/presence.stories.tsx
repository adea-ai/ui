import { createSignal, Show } from 'solid-js'
import { Motion } from 'solid-motionone'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../ui/button'
import { Presence } from './presence'

/**
 * Presence.
 *
 * Mount and unmount animation. `Presence` wraps the condition and takes only two
 * booleans; the animation lives on the `Motion.*` element the condition renders.
 * Toggle quickly to see the point of it: a close interrupted by a reopen turns
 * back from where it is instead of finishing and starting over.
 */
const meta = {
  title: 'Primitives/Motion/Presence',
  component: Presence,
  // Every story renders its own condition, so the required `children` arg is empty.
  args: { children: null },
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Presence>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The duration comes from the motion token rather than a number in the story, so
 * a change to `--duration-normal` moves this too. Read at render, because the
 * token is CSS and motionone wants seconds.
 */
function normalDuration(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--duration-normal')
  return (parseFloat(value) || 0) / 1000
}

/**
 * Opens shown, with `initial={false}`: the first render is the resting state, not
 * an entrance — a panel that was already open when the view loaded should not
 * animate in.
 */
export const Toggle: Story = {
  render: () => {
    const [open, setOpen] = createSignal(true)
    const duration = normalDuration()
    return (
      <div class="grid w-80 gap-3">
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open()}
          aria-controls="presence-panel"
          onClick={() => setOpen((value) => !value)}
        >
          {open() ? 'Hide details' : 'Show details'}
        </Button>
        <Presence initial={false}>
          <Show when={open()}>
            <Motion.div
              id="presence-panel"
              class="rounded-lg border border-border bg-card p-4 text-sm text-foreground"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration }}
            >
              The panel stays mounted until its exit finishes.
            </Motion.div>
          </Show>
        </Presence>
      </div>
    )
  },
}

/**
 * `exitBeforeEnter`: a keyed swap where the outgoing step leaves before the next
 * one arrives, so the two never overlap in the same slot.
 */
export const Swap: Story = {
  render: () => {
    const steps = ['Account', 'Workspace', 'Done'] as const
    const [index, setIndex] = createSignal(0)
    const duration = normalDuration()
    return (
      <div class="grid w-80 gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIndex((value) => (value + 1) % steps.length)}
        >
          Next step
        </Button>
        <Presence exitBeforeEnter>
          <Show when={steps[index()]} keyed>
            {(step) => (
              <Motion.div
                class="rounded-lg border border-border bg-card p-4 text-sm text-foreground"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration }}
              >
                {step}
              </Motion.div>
            )}
          </Show>
        </Presence>
      </div>
    )
  },
}
