import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Context } from './context'

const meta = {
  title: 'Composites/Context',
  component: Context,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Context-window usage as a compact trigger ("62% of context used") that opens the figures. Every figure is optional: a missing one is omitted, never shown as 0, and with nothing known the trigger is not rendered. Fullness changes a glyph and a word, not only a colour.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="flex min-h-72 items-end justify-center p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Context>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    used: 124_000,
    total: 200_000,
    breakdown: {
      input: 88_400,
      output: 21_300,
      cacheRead: 9_800,
      cacheWrite: 2_100,
      reasoning: 2_400,
    },
    cost: { amount: 0.42, currency: 'USD' },
  },
}

/** Past 75% the ring gives way to a triangle and the popover says "Getting full". */
export const GettingFull: Story = {
  args: { used: 156_000, total: 200_000 },
}

/** From 90% an octagon and "Nearly full". */
export const NearlyFull: Story = {
  args: { used: 186_000, total: 200_000 },
}

/** An overrun is reported as it is; only the ring saturates. */
export const Overrun: Story = {
  args: { used: 224_000, total: 200_000 },
}

/** A fresh conversation: 0 is a known figure and is shown. */
export const Empty: Story = {
  args: { used: 0, total: 200_000 },
}

/** No window size: no percentage is invented, the used count stands alone. */
export const UsedOnly: Story = {
  args: { used: 48_200 },
}

/** No usage yet: the window size alone is still a fact. */
export const TotalOnly: Story = {
  args: { total: 1_000_000 },
}

/** Only a breakdown, no totals: the rows that exist, and none that do not. */
export const BreakdownOnly: Story = {
  args: { breakdown: { input: 12_400, output: 3_100 } },
}

export const CostOnly: Story = {
  args: { cost: { amount: 3.2 } },
}

/** A currency code Intl does not know is shown as written, not swapped for another. */
export const UnknownCurrency: Story = {
  args: { used: 10_000, total: 200_000, cost: { amount: 12.5, currency: 'credits' } },
}

/** Nothing known: the trigger is not rendered at all. The text below is the whole story. */
export const NoFigures: Story = {
  args: {},
  render: (args) => (
    <p class="m-0 text-sm text-muted-foreground">
      No figures supplied; nothing is drawn here <Context {...args} />
    </p>
  ),
}

/** NaN, negatives and infinities are unknowns, not zeros. */
export const InvalidFigures: Story = {
  args: {
    used: Number.NaN,
    total: -1,
    breakdown: { input: Number.POSITIVE_INFINITY },
    cost: { amount: Number.NaN },
  },
  render: (args) => (
    <p class="m-0 text-sm text-muted-foreground">
      Every figure was invalid; nothing is drawn here <Context {...args} />
    </p>
  ),
}

/** Large numbers stay compact in the trigger and exact in the popover. */
export const VeryLarge: Story = {
  args: { used: 1_820_000, total: 2_000_000, breakdown: { input: 1_700_000, output: 120_000 } },
}
