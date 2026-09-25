import { For, Show, splitProps, type ComponentProps, type JSX } from 'solid-js'
import Calendar, {
  type RootProps as CorvuCalendarProps,
  type RootSingleProps,
} from '@corvu/calendar'

/** The three modes corvu's calendar is a union over. */
export type CalendarMode = 'single' | 'multiple' | 'range'
import { ChevronLeft, ChevronRight } from 'lucide-solid'
import { cn } from '#lib/utils'
import { Button } from '../button'

/**
 * Calendar.
 *
 * A month grid, over `@corvu/calendar`. The primitive owns the hard part — the
 * roving `tabindex` that makes a grid of days one tab stop rather than 42, the
 * arrow-key navigation, the `aria-selected`/`aria-disabled` bookkeeping, and the
 * `data-*` attributes that carry the states.
 *
 * What this component owns is the *presentation* of those states, and it is worth
 * saying why they are styled from `data-*` rather than from props: a day is today,
 * selected, in range, at a range end, and disabled independently, and a range
 * start that is also today has to read as both. Boolean props cannot express that
 * without a combinatorial explosion; the data attributes can.
 *
 * `mode` is the primitive's discriminated union — `single`, `multiple`, `range` —
 * so `value` and `onValueChange` change type with it. That is why this forwards
 * the props rather than normalising them: a normalised `Date[]` would lose what a
 * range needs to know which end moved.
 *
 * Three things the primitive leaves open, and this closes:
 *
 * 1. **The month caption is a heading**, wired to the grid's `aria-labelledby`, so
 *    the grid has a name and a screen reader user can hear which month they are in.
 * 2. **The nav buttons have accessible names.** A bare chevron is not a name.
 * 3. **Today is a ring, not a fill.** A fill would be indistinguishable from
 *    selected, and today is often also selected.
 *
 * The sub-components come off the default export as statics (`Calendar.Cell`,
 * `Calendar.CellTrigger`, …) — corvu's shape, and the reason this file does not
 * import seven names.
 */

/**
 * The props this wrapper adds on top of the primitive's own. They are separate so
 * `splitProps` has a fixed list to pull out, and so the mode-specific props stay
 * the primitive's to define.
 */
type CalendarExtras = {
  /** Weekday header labels, Sunday first. Defaults to the locale's short names. */
  weekdayLabels?: readonly string[]
  /** Accessible names for the month navigation. Override for a non-English app. */
  previousLabel?: string
  nextLabel?: string
  /** Format a month for the caption. Defaults to `Intl.DateTimeFormat`. */
  formatMonth?: (month: Date) => string
  class?: string
}

/**
 * `Omit` distributes over a union, which would collapse the three modes into one
 * shape and lose the discriminant. This keeps them apart. `children` is dropped
 * because the surface supplies the grid itself — the caller's job is the value,
 * not the layout.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** The props of any of the three modes. `mode` decides the shape of `value`. */
export type CalendarProps = DistributiveOmit<CorvuCalendarProps, 'children'> & CalendarExtras

const EXTRAS = ['weekdayLabels', 'previousLabel', 'nextLabel', 'formatMonth', 'class'] as const

const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }

function monthLabel(month: Date, format?: (month: Date) => string): string {
  return format ? format(month) : new Intl.DateTimeFormat(undefined, MONTH_FORMAT).format(month)
}

/**
 * A day's accessible name: the full date, because the visible number is only
 * meaningful next to its column heading.
 */
function dayLabel(day: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(day)
}

/** The locale's short weekday names, Sunday first — which is the order corvu's `weeks` use. */
function defaultWeekdays(): string[] {
  const format = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
  // 2024-01-07 is a Sunday, so index 0 is Sunday without arithmetic.
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(2024, 0, 7 + index)))
}

/**
 * The grid, inside the root's context. A separate component because
 * `Calendar.useContext` is only available to a descendant, and reading `months()`
 * in the same component that provides it renders one month behind.
 */
function CalendarGrid(props: {
  weekdayLabels?: readonly string[]
  previousLabel: string
  nextLabel: string
  formatMonth?: (month: Date) => string
}) {
  const context = Calendar.useContext()
  const weekdays = () => props.weekdayLabels ?? defaultWeekdays()

  return (
    <For each={context.months()}>
      {(month, index) => (
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <Calendar.Nav
              action="prev-month"
              as={Button}
              variant="ghost"
              size="icon-sm"
              aria-label={props.previousLabel}
            >
              <ChevronLeft aria-hidden="true" />
            </Calendar.Nav>
            <Calendar.Label index={index()} class="text-sm font-semibold text-foreground">
              {monthLabel(month.month, props.formatMonth)}
            </Calendar.Label>
            <Calendar.Nav
              action="next-month"
              as={Button}
              variant="ghost"
              size="icon-sm"
              aria-label={props.nextLabel}
            >
              <ChevronRight aria-hidden="true" />
            </Calendar.Nav>
          </div>
          <Calendar.Table class="w-full border-collapse">
            <thead>
              <tr>
                <For each={weekdays()}>
                  {(label) => (
                    <Calendar.HeadCell
                      as="th"
                      scope="col"
                      class="pb-1 text-2xs font-medium text-muted-foreground"
                    >
                      {label}
                    </Calendar.HeadCell>
                  )}
                </For>
              </tr>
            </thead>
            <tbody>
              <For each={month.weeks}>
                {(week) => (
                  <tr>
                    <For each={week}>
                      {(day) => (
                        <Calendar.Cell as="td" class="p-0.5 text-center">
                          <Calendar.CellTrigger
                            as="button"
                            day={day}
                            month={month.month}
                            class={cn(
                              'w-full rounded-md text-xs text-foreground transition-colors',
                              'min-h-control-xs',
                              'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                              // Styled from data states, so a day can be a range
                              // end and today at once without a prop per pair.
                              'data-selected:bg-primary data-selected:text-primary-foreground',
                              'data-in-range:bg-primary-subtle',
                              'data-range-start:rounded-r-none data-range-end:rounded-l-none',
                              'data-today:ring-1 data-today:ring-ring',
                              'data-disabled:text-muted-foreground data-disabled:line-through',
                              'data-disabled:hover:bg-transparent'
                            )}
                          >
                            {/*
                              The trigger renders no children of its own, so the
                              day number is the caller's — without it every cell
                              is an unnamed button (`button-name`).

                              The number is what a sighted reader needs and the
                              full date is what a screen reader user needs: "25"
                              alone is meaningless out of context. So the number
                              is hidden from the accessibility tree and the date
                              supplies the name.
                            */}
                            <span aria-hidden="true">{day.getDate()}</span>
                            <span class="visually-hidden">{dayLabel(day)}</span>
                          </Calendar.CellTrigger>
                        </Calendar.Cell>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </Calendar.Table>
        </div>
      )}
    </For>
  )
}

/**
 * Generic over the mode on purpose. `splitProps` cannot carry a discriminant
 * through destructuring — the rest object widens to `mode: 'single' | 'multiple' |
 * 'range'`, which is assignable to no single member of the primitive's union. A
 * type parameter keeps `mode` a literal, so `Extract` resolves the right member
 * and the forwarding stays checked rather than cast.
 */
export function CalendarSurface<M extends CalendarMode>(props: CalendarProps & { mode: M }) {
  const [local, rest] = splitProps(props as CalendarProps, [...EXTRAS])

  return (
    <div class={cn('w-fit rounded-lg border border-border bg-card p-3', local.class)}>
      <Calendar {...(rest as Extract<CorvuCalendarProps, { mode: M }>)}>
        <CalendarGrid
          weekdayLabels={local.weekdayLabels}
          previousLabel={local.previousLabel ?? 'Previous month'}
          nextLabel={local.nextLabel ?? 'Next month'}
          formatMonth={local.formatMonth}
        />
      </Calendar>
    </div>
  )
}

/**
 * Built from the primitive's *single* props rather than from `CalendarProps` with
 * `mode` omitted. Omitting a discriminant leaves the other members of the union
 * behind — `value` stays `Date | Date[] | {from,to}` — and the picker would then
 * have to cast to prove what its own name already says.
 */
export type DatePickerProps = Omit<RootSingleProps, 'mode' | 'children'> &
  CalendarExtras & {
    /** A labelled heading above the grid. */
    label?: string
    /** A footer slot: the confirm and cancel row a picker usually has. */
    footer?: JSX.Element
  }

/**
 * A single-day picker: the calendar with a name and a footer. Split from
 * `CalendarSurface` because a bare calendar is a control inside a form the caller
 * already owns, while a picker is a thing the caller drops in — and the two want
 * different surroundings.
 */
export function DatePicker(props: DatePickerProps) {
  const [local, rest] = splitProps(props, ['value', 'onValueChange', 'label', 'footer', 'class'])

  return (
    <div class={cn('grid w-fit gap-2', local.class)}>
      <Show when={local.label}>
        <p class="text-xs font-semibold text-foreground">{local.label}</p>
      </Show>
      <CalendarSurface
        {...rest}
        mode="single"
        value={local.value}
        onValueChange={local.onValueChange}
      />
      <Show when={local.footer}>
        <div class="flex justify-end gap-2">{local.footer}</div>
      </Show>
    </div>
  )
}

/** Re-exported so a caller can type a value it holds. */
export type { CalendarProps as CorvuCalendarProps }
export { Calendar as CalendarRoot }
export type CalendarElementProps = ComponentProps<'div'>
