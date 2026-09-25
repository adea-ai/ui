import { createSignal } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button'
import { CalendarSurface, DatePicker } from './calendar'

const meta = {
  title: 'UI/Calendar',
  component: CalendarSurface,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A month grid over `@corvu/calendar`. The primitive owns the roving `tabindex` that makes 42 days one tab stop, the arrow-key navigation, and the `aria-selected`/`aria-disabled` bookkeeping; this owns how those states look. They are styled from `data-*` rather than props because a day is today, selected, in range and at a range end independently — a range start that is also today has to read as both, which boolean props cannot express.',
      },
    },
  },
} satisfies Meta<typeof CalendarSurface>

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {
  render: () => {
    const [day, setDay] = createSignal<Date | null>(new Date(2026, 8, 25))
    return <CalendarSurface mode="single" value={day()} onValueChange={setDay} />
  },
}

export const Range: Story = {
  render: () => {
    const [range, setRange] = createSignal<{ from: Date | null; to: Date | null }>({
      from: new Date(2026, 8, 10),
      to: new Date(2026, 8, 18),
    })
    return <CalendarSurface mode="range" value={range()} onValueChange={setRange} />
  },
}

export const Multiple: Story = {
  render: () => {
    const [days, setDays] = createSignal<Date[]>([new Date(2026, 8, 4), new Date(2026, 8, 11)])
    return <CalendarSurface mode="multiple" value={days()} onValueChange={setDays} />
  },
}

/** Two months, for a range that usually spans one. */
export const TwoMonths: Story = {
  render: () => {
    const [range, setRange] = createSignal<{ from: Date | null; to: Date | null }>({
      from: null,
      to: null,
    })
    return (
      <CalendarSurface
        mode="range"
        numberOfMonths={2}
        value={range()}
        onValueChange={setRange}
        class="flex gap-4"
      />
    )
  },
}

/** Days outside the month are shown but dimmed — a grid with holes is harder to read. */
export const WithOutsideDays: Story = {
  render: () => {
    const [day, setDay] = createSignal<Date | null>(null)
    return (
      <CalendarSurface mode="single" value={day()} onValueChange={setDay} outsideDays="visible" />
    )
  },
}

export const WithFooter: Story = {
  render: () => {
    const [day, setDay] = createSignal<Date | null>(null)
    return (
      <DatePicker
        label="Start date"
        value={day()}
        onValueChange={setDay}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDay(null)}>
              Clear
            </Button>
            <Button size="sm">Confirm</Button>
          </>
        }
      />
    )
  },
}
