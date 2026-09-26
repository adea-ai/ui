import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { builtinThemes, Badge, Button, Input, ThemePreview, themeFamilies } from '@adea-ai/ui'
import { For, Show } from 'solid-js'

/**
 * Themes.
 *
 * The catalogue, and the reasoning behind how it is sourced.
 *
 * **A theme here is more than a colour scheme.** It carries the surface and text
 * roles, the terminal's sixteen ANSI colours, the editor's syntax roles, and the
 * chart series. A palette that sets only a background and a foreground leaves the
 * terminal and the code view to invent their own, which is how a diff ends up
 * unreadable inside an otherwise carefully themed application.
 *
 * **The professional sets are other people's palettes, used as published.** That is
 * the point: a hand-authored palette is a palette nobody maintains, while
 * Catppuccin, Nord, Gruvbox and the rest are maintained by people who care about
 * them and are permissively licensed. Each records its provenance, and
 * `validateThemeRegistry` is the gate — a palette either clears the contrast floors
 * or it is rejected with the pairing and the number.
 *
 * **The floors are WCAG AA** — 4.5:1 for text, 3:1 for the focus ring. Not the 7:1
 * the default theme is held to in `tests/tokens.test.ts`: AAA is this system's own
 * bar, not a bar to hold other people's work to. Solarized settles it — one of the
 * most carefully designed palettes in existence, built around a ~5:1 body contrast
 * on purpose, which a 7:1 gate would reject for being what it is.
 */
const meta = {
  title: 'Foundations/Themes',
  component: () => null,
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/**
 * Every theme, previewed.
 *
 * Each miniature is painted from the variant object rather than by applying the
 * theme, so a grid of twenty costs one object read each instead of twenty theme
 * swaps — and so a picker can show a theme that is not currently applied, which is
 * the whole point of a picker.
 *
 * Switch the **Theme** control in the toolbar to apply any of them for real.
 */
export const Catalogue: Story = {
  render: () => (
    <div class="flex flex-col gap-8">
      <For each={themeFamilies()}>
        {(family) => (
          <section class="flex flex-col gap-3">
            <header class="flex items-baseline gap-3">
              <h2 class="text-base font-semibold tracking-tight">{family.label}</h2>
              <span class="text-xs text-muted-foreground">
                {family.themes[0]?.provenance.source} · {family.themes[0]?.provenance.license}
              </span>
            </header>
            <div class="flex flex-wrap gap-4">
              <For each={family.themes}>
                {(theme) => (
                  <div class="flex flex-col gap-2">
                    <ThemePreview theme={theme} />
                    <div class="flex flex-col">
                      <span class="text-xs font-medium">{theme.label}</span>
                      <span class="max-w-44 text-2xs text-muted-foreground text-pretty">
                        {theme.description}
                      </span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </section>
        )}
      </For>
    </div>
  ),
}

/**
 * What a theme actually has to cover.
 *
 * The roles a palette sets are the contract. A theme that misses one leaves that
 * role on the previous theme's value, which shows up as a single component keeping
 * the old palette — so the catalogue is checked for completeness, not just for
 * contrast.
 */
export const RoleCoverage: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4 text-sm">
      <p class="text-muted-foreground">
        Each variant declares <strong>25 surface and text roles</strong>, a{' '}
        <strong>20-colour terminal palette</strong>, <strong>16 editor syntax roles</strong>, and{' '}
        <strong>six chart series</strong>.
      </p>
      <ul class="flex list-inside list-disc flex-col gap-1.5 text-muted-foreground">
        <li>
          <span class="text-foreground">Surface and text</span> — the canvas, cards, popovers, the
          sidebar, the muted rungs, the status family, borders and the focus ring.
        </li>
        <li>
          <span class="text-foreground">Terminal</span> — the sixteen ANSI colours plus background,
          foreground, cursor and selection. Without these, an xterm session in a themed app renders
          in the terminal's own default colours, which is the most common way a theme looks
          half-applied.
        </li>
        <li>
          <span class="text-foreground">Editor</span> — keyword, string, comment, function, type and
          the diff roles, so a diff and a code view read as part of the same application.
        </li>
        <li>
          <span class="text-foreground">Chart</span> — six categorical hues, closed at six: a
          seventh series folds into "other" rather than inventing a colour the theme did not choose.
        </li>
      </ul>
      <p class="text-muted-foreground">
        A label on a filled button is <strong>measured, never chosen</strong>: black or white,
        whichever wins on contrast against the fill. The first revision of the catalogue hand-picked
        them, and the validator found nine that were wrong — which is the argument for deriving
        them.
      </p>
    </div>
  ),
}

/** The two defaults, on real components rather than as swatches. */
export const Defaults: Story = {
  render: () => (
    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap items-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">Destructive</Button>
        <Badge variant="success">Passed</Badge>
        <Badge variant="warning">Skipped</Badge>
        <Input class="w-48" placeholder="Focus me" aria-label="Default theme input" />
      </div>
      <p class="max-w-prose text-sm text-muted-foreground">
        <code>adea-light</code> and <code>adea-dark</code> are the defaults, and they are a{' '}
        <em>pair</em>: <code>#0f141f</code> and <code>#e3e9f4</code>, three degrees apart in hue and
        both tinted rather than neutral, carrying the same sixteen hues so that switching appearance
        changes how bright the interface is and nothing else. Neither is a flat black or a pure
        white, which is the rule rather than a preference — a dark interface whose canvas is
        colourless <em>and</em> almost black is the most common way one is made unpleasant — and{' '}
        <code>tests/themes.test.ts</code> asserts both halves of it.
      </p>
    </div>
  ),
}

/** What the catalogue does not contain, and why. */
export const WhatIsMissing: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-3 text-sm">
      <p class="text-muted-foreground">
        The catalogue is {builtinThemes.length} themes across {themeFamilies().length} families, and
        it is deliberately not larger.
      </p>
      <ul class="flex list-inside list-disc flex-col gap-1.5 text-muted-foreground">
        <li>
          <span class="text-foreground">Solarized</span> is present and is the reason the gate is AA
          rather than AAA. Its body contrast is about 5:1 by design.
        </li>
        <li>
          <span class="text-foreground">GitHub Dark</span> is absent on purpose, though its
          <em>hues</em> are not: both defaults borrow them. Shipping the theme as well would put a
          near-duplicate of the default's sixteen colours in the picker, differing only in a canvas
          that is a flat, colourless black.
        </li>
        <li>
          <span class="text-foreground">A theme picker for the accent</span> is a separate axis, not
          a theme. Six accents compose with every theme, which is 100+ combinations from 17 palettes
          and 6 presets rather than 100 hand-authored variants.
        </li>
      </ul>
    </div>
  ),
}

/** The provenance of every imported palette, which is the sourcing contract. */
export const Provenance: Story = {
  render: () => (
    <table>
      <thead>
        <tr>
          <th>Family</th>
          <th>Source</th>
          <th>Licence</th>
          <th>Variants</th>
        </tr>
      </thead>
      <tbody>
        <For each={themeFamilies()}>
          {(family) => (
            <tr>
              <td>{family.label}</td>
              <td>
                <a href={family.themes[0]?.provenance.url} target="_blank" rel="noreferrer">
                  {family.themes[0]?.provenance.source}
                </a>
              </td>
              <td>
                <code>{family.themes[0]?.provenance.license}</code>
              </td>
              <td>
                <Show when={family.themes.length > 1} fallback={family.themes[0]?.label}>
                  {family.themes.map((theme) => theme.label).join(', ')}
                </Show>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  ),
}
