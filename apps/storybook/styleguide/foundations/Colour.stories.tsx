import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { colorTokens, designTokens } from '@adea-ai/ui'
import { For } from 'solid-js'
import { ColorSwatch, TokenTable, TokenRow } from './token-preview'

/**
 * Colour.
 *
 * Every colour is a semantic token, and the name says what the colour is *for*
 * rather than what it looks like — `destructive`, not `red`. That is what lets
 * the palette change without the components changing, and it is why a raw
 * palette class such as `bg-red-500` is a lint error rather than a style
 * preference.
 *
 * Colour format is OKLCH. A lightness step reads as the same step in every hue,
 * so the surface ladder and the status colours stay coherent when the theme is
 * re-hued, and a future accent does not need its ramp re-derived by eye.
 *
 * **The theme toolbar is the real mechanism.** It toggles `.dark` on `<html>`,
 * exactly as both applications do, so what you see here is what ships.
 */
const meta = {
  title: 'Foundations/Colour',
  component: () => null,
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const surfaceLadder = [
  'surface-sunken',
  'background',
  'surface-hover',
  'surface-active',
  'card',
  'popover',
  'sidebar',
  'chrome',
]

/** The surfaces, in the order they stack. This is the page's spine. */
export const Surfaces: Story = {
  render: () => (
    <div class="flex flex-col gap-4">
      <p class="max-w-prose text-sm text-muted-foreground">
        Eight rungs, in painting order. A well sinks, the canvas is flat, a card rises, an overlay
        floats, and hover and active are fills rather than surfaces — they are painted <em>onto</em>{' '}
        something, which is why they are translucent in the status family and solid here.
      </p>
      <div class="flex flex-col gap-3">
        <For each={surfaceLadder}>{(name) => <ColorSwatch name={name} />}</For>
      </div>
    </div>
  ),
}

/**
 * The full token set, with the resolved value read from the live document.
 *
 * Reading `getComputedStyle` rather than printing the source is deliberate: a
 * value that is misspelled or overridden still looks correct in a table of
 * strings.
 */
export const AllTokens: Story = {
  render: () => (
    <TokenTable>
      <For each={colorTokens}>{(token) => <TokenRow token={token} />}</For>
    </TokenTable>
  ),
}

/**
 * The pairings the system guarantees.
 *
 * Each of these is asserted by a measured contrast test in
 * `packages/ui/tests/tokens.test.ts`, on every build. These are not
 * aspirations — a change that breaks one fails CI.
 */
export const ContrastGuarantees: Story = {
  render: () => (
    <div class="flex flex-col gap-6">
      <p class="max-w-prose text-sm text-muted-foreground">
        Body text measures at least 7:1 on the surface it sits on and secondary text at least 4.5:1,
        in both themes. The floors are enforced by measurement rather than by review, and the
        numbers below are what the tokens currently resolve to.
      </p>
      <div class="flex flex-col gap-2">
        <For
          each={[
            { fg: 'foreground', bg: 'background', floor: '7:1' },
            { fg: 'foreground', bg: 'card', floor: '7:1' },
            { fg: 'muted-foreground', bg: 'background', floor: '4.5:1' },
            { fg: 'muted-foreground', bg: 'card', floor: '4.5:1' },
            { fg: 'muted-foreground', bg: 'sidebar', floor: '4.5:1' },
            { fg: 'primary-foreground', bg: 'primary', floor: '4.5:1' },
            { fg: 'destructive-foreground', bg: 'destructive', floor: '4.5:1' },
          ]}
        >
          {(pair) => (
            <div
              class="flex items-center gap-4 rounded-md border border-border px-4 py-3"
              style={{ 'background-color': `var(--${pair.bg})` }}
            >
              <span class="text-sm font-medium" style={{ color: `var(--${pair.fg})` }}>
                Text on {pair.bg}
              </span>
              <code class="ms-auto text-xs text-muted-foreground">
                {pair.fg} · floor {pair.floor}
              </code>
            </div>
          )}
        </For>
      </div>
    </div>
  ),
}

/** The brand accent, and why its label flips polarity between themes. */
export const Accent: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4 text-sm">
      <p class="text-muted-foreground">
        The Adea emerald is <code>--primary</code>, not <code>--accent</code>. shadcn uses{' '}
        <code>--accent</code> for a subtle hover surface, and that convention is kept:{' '}
        <code>--accent</code> here is the hover fill on a menu row, not the brand colour.
      </p>
      <p class="text-muted-foreground">
        The accent is bright in dark mode and deep in light mode, so
        <code>--primary-foreground</code> is black in one theme and white in the other. That flip is
        the reason a component must never hard-code a label colour on a primary button.
      </p>
      <div class="flex gap-3">
        <For each={['primary', 'primary-hover', 'primary-subtle']}>
          {(name) => <ColorSwatch name={name} />}
        </For>
      </div>
    </div>
  ),
}

/** The status family: solid for a fill, subtle for a tint on a surface. */
export const Status: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        Four meanings, each with a solid fill, a label colour and a translucent tint. The tint is
        derived from the solid with <code>color-mix()</code>, so re-hueing a status re-hues its
        banner automatically — there is no second value to remember.
      </p>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <For each={['success', 'warning', 'destructive', 'info']}>
          {(tone) => (
            <div class="flex flex-col gap-3">
              <ColorSwatch name={tone} />
              <div
                class="rounded-lg border px-3 py-2 text-sm"
                style={{
                  'background-color': `var(--${tone}-subtle)`,
                  color: `var(--${tone})`,
                  'border-color': `color-mix(in oklch, var(--${tone}) 30%, transparent)`,
                }}
              >
                {tone} banner
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  ),
}

/** Diff and chart roles, shared with the editor and the terminal. */
export const DataRoles: Story = {
  render: () => (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium">Diff</h3>
        <div class="overflow-hidden rounded-lg border border-border font-mono text-sm">
          <div
            class="px-3 py-1"
            style={{ 'background-color': 'var(--diff-hunk)', color: 'var(--diff-hunk-foreground)' }}
          >
            @@ -1,5 +1,6 @@
          </div>
          <div
            class="px-3 py-1"
            style={{ 'background-color': 'var(--diff-add)', color: 'var(--diff-add-foreground)' }}
          >
            + const added = true
          </div>
          <div
            class="px-3 py-1"
            style={{
              'background-color': 'var(--diff-delete)',
              color: 'var(--diff-delete-foreground)',
            }}
          >
            - const removed = true
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium">Chart series</h3>
        <div class="flex h-10 overflow-hidden rounded-md">
          <For each={designTokens.color.filter((token) => token.name.startsWith('chart-'))}>
            {(token) => (
              <div
                class="flex-1"
                style={{ 'background-color': `var(--${token.name})` }}
                title={token.name}
              />
            )}
          </For>
        </div>
        <p class="text-xs text-muted-foreground">
          Six categorical hues, ordered for adjacent separation. The set is closed: a seventh series
          folds into an "other" bucket rather than inventing a colour that will not survive a theme
          change.
        </p>
      </div>
    </div>
  ),
}
