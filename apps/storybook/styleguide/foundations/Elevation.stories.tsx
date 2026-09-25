import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Card, elevationTokens, radiusTokens } from '@adea-ai/ui'
import { For } from 'solid-js'
import { TokenTable, TokenRow } from './token-preview'

/**
 * Radius and elevation.
 *
 * Both scales have exactly one job: to say how far a surface is from the
 * canvas. Radius and shadow move together — a dialog is the most rounded and
 * the most elevated, a badge is the least of both — so a component that picks
 * one scale's rung without the other's reads as a mistake even to someone who
 * cannot say why.
 *
 * **Radius has a single knob.** `--radius-lg` is the value; the other four rungs
 * are derived from it. Moving that one number re-rounds the entire system, which
 * is the difference between a themeable design system and a set of constants.
 */
const meta = {
  title: 'Foundations/Radius and elevation',
  component: () => null,
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const radiusUsage: Record<string, string> = {
  'radius-sm': 'Badges, keyboard keys, menu items, small chips.',
  'radius-md': 'Every control: buttons, inputs, selects, toggles.',
  'radius-lg': 'Cards, panels, alert banners, table containers.',
  'radius-xl': 'Dialogs, menus, popovers, sheets. The most rounded surface in the system.',
  'radius-2xl': 'Full-window surfaces and media. Used sparingly.',
}

/**
 * The radius ladder. Each rung has a stated use, and a component that wants a
 * rung outside this list is usually asking the wrong question.
 */
export const Radius: Story = {
  render: () => (
    <div class="flex flex-col gap-5">
      <For each={radiusTokens.filter((token) => radiusUsage[token.name])}>
        {(token) => (
          <div class="flex items-center gap-6 border-b border-border pb-4 last:border-b-0">
            <div class="w-64 shrink-0">
              <code class="text-xs font-medium">{token.name}</code>
              <p class="text-xs text-muted-foreground">{radiusUsage[token.name]}</p>
            </div>
            <div
              class="flex size-16 items-center justify-center border border-input bg-surface-hover text-xs text-muted-foreground"
              style={{ 'border-radius': `var(--${token.name})` }}
            >
              {token.name.replace('radius-', '')}
            </div>
            <div
              class="h-9 border border-border bg-card px-3 text-sm leading-9"
              style={{ 'border-radius': `var(--${token.name})` }}
            >
              Real component
            </div>
          </div>
        )}
      </For>
      <p class="max-w-prose text-sm text-muted-foreground">
        The same corner on a 16px swatch and a 36px-high control reads differently. That is why the
        ladder is keyed to the object's size rather than to a single ratio.
      </p>
    </div>
  ),
}

/**
 * The elevation ladder.
 *
 * Every shadow is two parts: a tinted spread that reads as height, and a
 * hairline that keeps an edge visible when the surface behind is the same
 * colour as the surface itself — which is exactly the light theme, where the
 * card and the canvas are both white.
 */
export const Elevation: Story = {
  render: () => (
    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap gap-8">
        <For each={elevationTokens}>
          {(token) => (
            <div class="flex flex-col items-center gap-3">
              <div
                class="flex size-28 items-center justify-center rounded-xl border border-border bg-card text-xs text-muted-foreground"
                style={{ 'box-shadow': `var(--${token.name})` }}
              >
                {token.name.replace('shadow-', '')}
              </div>
              <code class="text-2xs text-muted-foreground">{token.name}</code>
            </div>
          )}
        </For>
      </div>
      <p class="max-w-prose text-sm text-muted-foreground">
        Switch the theme with the toolbar while watching these. In dark mode the shadows deepen and
        the hairline changes from black to white — a single shadow value tuned for one polarity is
        invisible in the other.
      </p>
    </div>
  ),
}

/** Radius and elevation chosen together, which is the actual rule. */
export const Paired: Story = {
  render: () => (
    <div class="flex flex-wrap items-start gap-6">
      <div class="flex flex-col items-center gap-2">
        <span class="rounded-sm border border-border bg-muted px-2 py-0.5 text-2xs font-medium">
          Badge
        </span>
        <code class="text-2xs text-muted-foreground">sm · no shadow</code>
      </div>
      <div class="flex flex-col items-center gap-2">
        <span class="rounded-md border border-input bg-background px-3 py-1 text-sm">Button</span>
        <code class="text-2xs text-muted-foreground">md · xs</code>
      </div>
      <div class="flex flex-col items-center gap-2">
        <Card class="w-40 gap-1 p-3">
          <div class="text-sm font-medium">Card</div>
          <p class="text-xs text-muted-foreground">A panel on the canvas.</p>
        </Card>
        <code class="text-2xs text-muted-foreground">lg · xs</code>
      </div>
      <div class="flex flex-col items-center gap-2">
        <div class="w-40 rounded-xl border border-border bg-popover p-3 shadow-lg">
          <div class="text-sm font-medium">Dialog</div>
          <p class="text-xs text-muted-foreground">A floating decision.</p>
        </div>
        <code class="text-2xs text-muted-foreground">xl · lg</code>
      </div>
    </div>
  ),
}

/** All six shadows with their resolved values. */
export const ElevationTokens: Story = {
  render: () => (
    <TokenTable>
      <For each={elevationTokens}>{(token) => <TokenRow token={token} />}</For>
    </TokenTable>
  ),
}
