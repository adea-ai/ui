import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { motionTokens, zIndexTokens } from '@adea-ai/ui'
import { For, createSignal } from 'solid-js'
import { TokenTable, TokenRow } from './token-preview'

/**
 * Motion.
 *
 * Two durations and two curves. That is the whole system, and it is small on
 * purpose: motion in an application is feedback, not decoration. A user should
 * never be waiting for an animation, and should never see two things move at
 * different speeds for no reason.
 *
 * The entrance curve — `cubic-bezier(0.16, 1, 0.3, 1)` — starts fast and settles
 * slowly. That reads as decisive rather than floaty, which is what a desktop
 * application wants: floaty motion in a tool feels like latency.
 *
 * **Every animation stops under `prefers-reduced-motion`.** The only exception is
 * a loading spinner, because a frozen spinner reads as a hang, which is worse
 * than motion for exactly the people who asked for less of it.
 */
const meta = {
  title: 'Foundations/Motion',
  component: () => null,
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The two durations, side by side, on the same movement. */
export const Durations: Story = {
  render: () => {
    const [on, setOn] = createSignal(false)

    return (
      <div class="flex max-w-prose flex-col gap-5">
        <p class="text-sm text-muted-foreground">
          `fast` is for a state change the user is already watching — a hover, a press, a toggle. It
          should be felt rather than seen. <code>normal</code> is for an arrival, where a slightly
          longer settle makes the movement legible instead of a flicker.
        </p>
        <button
          type="button"
          class="h-control-md w-fit rounded-md border border-input px-3 text-sm"
          onClick={() => setOn((v) => !v)}
        >
          {on() ? 'Reset' : 'Animate both'}
        </button>
        <For
          each={[
            { token: 'duration-fast', usage: '120ms — a hover, a press, a toggle.' },
            { token: 'duration-normal', usage: '200ms — an entrance, a disclosure.' },
            { token: 'duration-slow', usage: '320ms — a layout settle, a large panel.' },
          ]}
        >
          {(row) => (
            <div class="flex items-center gap-6">
              <div class="w-64 shrink-0">
                <code class="text-xs font-medium">{row.token}</code>
                <p class="text-xs text-muted-foreground">{row.usage}</p>
              </div>
              <div class="h-8 flex-1 rounded-md bg-surface-hover">
                <div
                  class="size-8 rounded-md bg-primary"
                  style={{
                    transform: on() ? 'translateX(100%)' : 'translateX(0)',
                    transition: `transform var(--${row.token}) var(--ease-out)`,
                  }}
                />
              </div>
            </div>
          )}
        </For>
      </div>
    )
  },
}

/**
 * The two curves.
 *
 * `ease-out` is the system's default and the one to reach for. `ease-in-out` is
 * only correct for a loop with no start or end, such as a shimmer — applied to an
 * entrance it makes the movement feel like it is resisting.
 */
export const Easings: Story = {
  render: () => {
    const [on, setOn] = createSignal(false)

    return (
      <div class="flex max-w-prose flex-col gap-5">
        <button
          type="button"
          class="h-control-md w-fit rounded-md border border-input px-3 text-sm"
          onClick={() => setOn((v) => !v)}
        >
          {on() ? 'Reset' : 'Animate both'}
        </button>
        <For
          each={[
            { token: 'ease-out', usage: 'Fast start, long settle. Decisive. The default.' },
            { token: 'ease-in-out', usage: 'Symmetric. For a loop, never for an entrance.' },
          ]}
        >
          {(row) => (
            <div class="flex items-center gap-6">
              <div class="w-64 shrink-0">
                <code class="text-xs font-medium">{row.token}</code>
                <p class="text-xs text-muted-foreground">{row.usage}</p>
              </div>
              <div class="h-8 flex-1 rounded-md bg-surface-hover">
                <div
                  class="size-8 rounded-md bg-primary"
                  style={{
                    transform: on() ? 'translateX(100%)' : 'translateX(0)',
                    transition: `transform 400ms var(--${row.token})`,
                  }}
                />
              </div>
            </div>
          )}
        </For>
      </div>
    )
  },
}

/**
 * What is allowed to move.
 *
 * State changes use a `transition`, so they are interruptible: clicking a
 * disclosure twice in a row should not queue two animations. Keyframes are
 * reserved for entrances, which have a definite start and end.
 *
 * Hover and focus transitions never animate anything but colour. A hover that
 * moves or resizes an element makes a list twitch under the pointer, and the
 * target the user was aiming at has already moved by the time they click.
 */
export const Principles: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4 text-sm">
      <h3 class="text-base font-semibold tracking-tight">What may move</h3>
      <ul class="flex list-inside list-disc flex-col gap-2 text-muted-foreground">
        <li>
          <span class="text-foreground">Colour and opacity</span> on hover, focus, active and
          selection. Always a transition, never a keyframe.
        </li>
        <li>
          <span class="text-foreground">Transform</span> on an entrance: a menu sliding from its
          trigger, a sheet from its edge, a toast from the corner. The direction comes from where
          the surface is anchored.
        </li>
        <li>
          <span class="text-foreground">Height</span> on a disclosure, measured from the content
          rather than guessed, so a panel with more inside it opens further.
        </li>
      </ul>
      <h3 class="text-base font-semibold tracking-tight">What may not</h3>
      <ul class="flex list-inside list-disc flex-col gap-2 text-muted-foreground">
        <li>
          Anything on hover that changes an element's <em>size or position</em>. The pointer is in
          the middle of a click.
        </li>
        <li>
          A loading state that should be instant. An animation on a local, synchronous change is
          latency the user did not have before.
        </li>
        <li>
          Any motion at all under <code>prefers-reduced-motion</code>, except the spinner.
        </li>
      </ul>
    </div>
  ),
}

/** All motion tokens with their resolved values. */
export const MotionTokens: Story = {
  render: () => (
    <TokenTable>
      <For each={motionTokens}>{(token) => <TokenRow token={token} />}</For>
    </TokenTable>
  ),
}

/**
 * The overlay stacking scale.
 *
 * Every overlay names a rung. There are no one-off z-index values anywhere in
 * the system, because two overlays fighting over an arbitrary `z-50` is a bug
 * that only reproduces when both happen to be open.
 *
 * The order encodes containment: a menu is above a dialog because a dialog can
 * contain a menu; a tooltip is above a menu because a menu item can carry one;
 * a toast is above everything, so a notification is never hidden by a dialog the
 * user just opened.
 */
export const StackingOrder: Story = {
  render: () => (
    <TokenTable>
      <For each={zIndexTokens}>{(token) => <TokenRow token={token} />}</For>
    </TokenTable>
  ),
}
