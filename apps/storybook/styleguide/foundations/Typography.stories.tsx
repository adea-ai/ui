import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { typographyTokens } from '@adea-ai/ui'
import { For } from 'solid-js'
import { TokenTable, TokenRow } from './token-preview'

/**
 * Typography.
 *
 * Two families. Space Grotesk for the interface and JetBrains Mono for anything
 * a user compares character by character — code, terminals, ids, file paths. A
 * third face is a design decision with a reason, not a default.
 *
 * The scale is eight rungs, and each rung carries its own line-height because
 * the ratio is not constant: small text needs more leading to stay readable,
 * display text needs less to stay coherent. That is why `text-sm` is
 * 14px/1.55 and `text-2xl` is 24px/1.25.
 *
 * **14px is the interface default**, not 16px. This is a desktop application
 * used for hours at a time, and the extra density is the point — but it is worth
 * stating plainly, because 16px is the web default and a component that quietly
 * sets it will look wrong next to one that does not.
 */
const meta = {
  title: 'Foundations/Typography',
  component: () => null,
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const sample = 'The quick brown fox jumps over the lazy dog'

/** The eight-rung scale, at the size and weight the system actually uses. */
export const Scale: Story = {
  render: () => (
    <div class="flex flex-col gap-5">
      <For
        each={[
          { token: 'text-3xl', usage: 'An empty-state headline. Appears at most once in an app.' },
          { token: 'text-2xl', usage: 'A display figure — a stat, a count.' },
          { token: 'text-xl', usage: 'A page title.' },
          { token: 'text-lg', usage: 'A section heading inside a page.' },
          { token: 'text-base', usage: 'Card titles and dialog titles.' },
          { token: 'text-sm', usage: 'Body copy, labels, control text. The default.' },
          { token: 'text-xs', usage: 'Metadata, badges, secondary rows.' },
          { token: 'text-2xs', usage: 'The floor. Keyboard keys, the status bar.' },
        ]}
      >
        {(row) => (
          <div class="flex items-baseline gap-6 border-b border-border pb-4 last:border-b-0">
            <div class="w-64 shrink-0">
              <code class="text-xs font-medium">{row.token}</code>
              <p class="text-xs text-muted-foreground">{row.usage}</p>
            </div>
            <span class={row.token} style={{ 'font-size': `var(--${row.token})` }}>
              {sample}
            </span>
          </div>
        )}
      </For>
    </div>
  ),
}

/** Weights and emphasis, limited to what a dense interface can carry. */
export const Weights: Story = {
  render: () => (
    <div class="flex flex-col gap-4">
      <For
        each={[
          { weight: '400', class: 'font-normal', usage: 'Body copy. The default.' },
          {
            weight: '500',
            class: 'font-medium',
            usage: 'Labels, buttons, table headers, nav rows.',
          },
          {
            weight: '600',
            class: 'font-semibold',
            usage: 'Titles. The heaviest weight the interface uses.',
          },
        ]}
      >
        {(row) => (
          <div class="flex items-baseline gap-6">
            <div class="w-64 shrink-0">
              <code class="text-xs font-medium">{row.weight}</code>
              <p class="text-xs text-muted-foreground">{row.usage}</p>
            </div>
            <span class={`text-xl ${row.class}`}>{sample}</span>
          </div>
        )}
      </For>
      <p class="max-w-prose text-sm text-muted-foreground">
        Nothing in the system uses 700. On a dark surface a bold word blooms, and with a variable
        face the step from 500 to 600 is already a clear one — a heavier weight buys attention by
        making the text harder to read.
      </p>
    </div>
  ),
}

/** How a hierarchy is expressed without reaching for a size or a colour. */
export const Hierarchy: Story = {
  render: () => (
    <div class="flex max-w-md flex-col gap-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Page title</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          One supporting sentence. Present tense, no restating the title.
        </p>
      </div>
      <div>
        <h2 class="text-base font-semibold tracking-tight">Section heading</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          A section is separated by space, not by a rule. A page of boxed sections reads as a
          dashboard, and most pages are not one.
        </p>
      </div>
      <div class="rounded-xl border border-border p-4">
        <div class="text-sm font-medium">Row label</div>
        <p class="text-sm text-muted-foreground">
          The description sits directly under its label, in muted text at the same size. Same size,
          different colour — a smaller size for the description makes it look like a footnote rather
          than a sentence.
        </p>
      </div>
      <p class="text-xs text-muted-foreground">
        Metadata: 11px is the floor. Below it, letterforms stop resolving on a non-retina display,
        and a desktop app is used on both.
      </p>
    </div>
  ),
}

/** Monospace, and the one place proportional digits are a defect. */
export const Monospace: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        Anything a user might compare character by character uses the mono face with ligatures off,
        so <code>!=</code> and <code>==</code> cannot be mistaken for each other.
      </p>
      <div class="rounded-lg border border-border p-3 font-mono text-sm">
        <div>const hash = 'a3f9c2'</div>
        <div>if (a != b &amp;&amp; a !== null) return</div>
        <div class="text-muted-foreground">~/Developer/Adea/packages/ui</div>
      </div>
      <p class="text-sm text-muted-foreground">
        Figures that sit in a column — a stat, a table cell, a progress readout — use{' '}
        <code>tabular-nums</code> even in the proportional face, so the digits line up and a
        changing number does not shuffle its neighbours.
      </p>
      <div class="flex gap-8">
        <div>
          <div class="text-xs text-muted-foreground">proportional</div>
          <div class="text-lg">1,111.11</div>
          <div class="text-lg">8,888.88</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">tabular-nums</div>
          <div class="text-lg tabular-nums">1,111.11</div>
          <div class="text-lg tabular-nums">8,888.88</div>
        </div>
      </div>
    </div>
  ),
}

/** The families, and what they fall back to before the fonts load. */
export const Families: Story = {
  render: () => (
    <TokenTable>
      <For each={typographyTokens.filter((token) => token.kind === 'font-family')}>
        {(token) => (
          <TokenRow
            token={token}
            preview={
              <span style={{ 'font-family': `var(--${token.name})` }}>
                Space Grotesk 0123456789
              </span>
            }
          />
        )}
      </For>
    </TokenTable>
  ),
}
