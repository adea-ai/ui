import { render } from 'solid-js/web'
import { createSignal } from 'solid-js'
import { CalendarSurface } from '../../src/components/ui/calendar/calendar'
import '../../src/styles/globals.css'

// The month is pinned so the selected days are on screen whatever day the suite runs.
const SEPTEMBER = new Date(2026, 8, 1)

function Fixture() {
  const [day, setDay] = createSignal<Date | null>(new Date(2026, 8, 25))
  const [range, setRange] = createSignal<{ from: Date | null; to: Date | null }>({
    from: new Date(2026, 8, 10),
    to: new Date(2026, 8, 18),
  })

  return (
    <main class="grid gap-4 p-4">
      <section data-testid="calendar-single">
        <CalendarSurface
          mode="single"
          initialMonth={SEPTEMBER}
          value={day()}
          onValueChange={setDay}
        />
      </section>
      <section data-testid="calendar-range">
        <CalendarSurface
          mode="range"
          initialMonth={SEPTEMBER}
          value={range()}
          onValueChange={setRange}
        />
      </section>
    </main>
  )
}

render(() => <Fixture />, document.body)
