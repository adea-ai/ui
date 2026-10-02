import type { ChartOptions } from 'chart.js'

/**
 * The chart's options, as data: no Chart.js runtime and no DOM, so the theme's
 * defaults and the merge rules are testable on their own.
 *
 * Every colour here is written as `var(--token)`. A canvas cannot read a custom
 * property — `fillStyle = 'var(--chart-1)'` is an invalid colour, which the
 * canvas ignores and paints in its default black — so these strings are the
 * *declaration* of which token a colour comes from. The components resolve them
 * against their own element at render time (see `resolveCssVariables` and the
 * resolver in `chart.tsx`).
 */

/** The five series colours, in the order a multi-series chart should use them. */
export const chartSeriesColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

/**
 * The chart furniture, mapped onto existing semantic tokens rather than given
 * tokens of its own. A grid line is a line, so it is `--border`; an axis tick and
 * a legend label are secondary text, so they are `--muted-foreground`, whose
 * contrast on `--card` (the frame's surface) is already measured in
 * `tests/tokens.test.ts`. Dedicated `--chart-grid`/`--chart-axis`/`--chart-label`
 * tokens would be three more values to keep in step with these in every theme
 * for no difference anyone has asked for.
 */
const furniture = {
  grid: 'var(--border)',
  axis: 'var(--muted-foreground)',
  label: 'var(--muted-foreground)',
  surface: 'var(--card)',
} as const

/**
 * Which scales a chart type draws. Chart.js creates a scale for every key under
 * `options.scales` whatever the chart type, so cartesian defaults handed to a
 * doughnut draw an x and a y axis and a grid behind it. The shape keeps each
 * type's defaults to the scales it actually has.
 */
export type ChartScaleShape = 'cartesian' | 'radial' | 'none'

const tickFont = { size: 10 }

function scalesFor(shape: ChartScaleShape): ChartOptions['scales'] {
  if (shape === 'cartesian') {
    return {
      x: {
        border: { color: furniture.grid },
        grid: { color: furniture.grid, drawTicks: false },
        ticks: { color: furniture.axis, font: tickFont },
      },
      y: {
        border: { display: false },
        grid: { color: furniture.grid, drawTicks: false },
        ticks: { color: furniture.axis, font: tickFont },
      },
    }
  }
  if (shape === 'radial') {
    return {
      r: {
        grid: { color: furniture.grid },
        angleLines: { color: furniture.grid },
        pointLabels: { color: furniture.axis, font: tickFont },
        // The default backdrop is a translucent white box, which is a white box
        // on a dark card. The frame's own surface makes it disappear in both.
        ticks: { color: furniture.axis, backdropColor: furniture.surface, font: tickFont },
      },
    }
  }
  return undefined
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    const current = target[key]
    target[key] =
      isPlainObject(value) && isPlainObject(current)
        ? mergeInto({ ...current }, value)
        : isPlainObject(value)
          ? mergeInto({}, value)
          : value
  }
  return target
}

/**
 * Merge Chart.js options, later sources winning, object by object.
 *
 * Deep, because Chart.js options are deep: `{ scales: { x: { stacked: true } } }`
 * means "also stack x", and a spread would replace the whole axis — its grid,
 * its tick colour, its font — with that one flag. Arrays, functions (scriptable
 * options) and class instances (gradients, patterns) are values and replace
 * rather than merge. No source is mutated.
 */
export function mergeChartOptions(...sources: (ChartOptions | undefined)[]): ChartOptions {
  const merged: Record<string, unknown> = {}
  for (const source of sources) {
    if (source) mergeInto(merged, source as Record<string, unknown>)
  }
  return merged as ChartOptions
}

/**
 * The theme's defaults as Chart.js options.
 *
 * Exported so a caller can spread it and change one thing, rather than
 * restating every colour. Everything a chart draws that is not data — grid,
 * ticks, legend, tooltip — is decided here once, which is what makes two charts
 * in one application look like they came from the same place. `overrides` is
 * merged deeply; `shape` selects the scales the chart type has.
 */
export function chartOptions(
  overrides?: ChartOptions,
  shape: ChartScaleShape = 'cartesian'
): ChartOptions {
  return mergeChartOptions(
    {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: furniture.label,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 11 },
          },
        },
        tooltip: {
          backgroundColor: 'var(--popover)',
          titleColor: 'var(--popover-foreground)',
          bodyColor: 'var(--popover-foreground)',
          borderColor: 'var(--border)',
          borderWidth: 1,
          padding: 8,
          cornerRadius: 6,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          titleFont: { size: 11, weight: 600 },
          bodyFont: { size: 11 },
        },
      },
      scales: scalesFor(shape),
    },
    overrides
  )
}

const cssVariable = /^\s*var\(\s*(--[\w-]+)\s*(?:,\s*(.*?))?\s*\)\s*$/

/**
 * Replace every `var(--token)` string in `value` — options, datasets, nested
 * arrays — with what `read` returns for the token. A token `read` cannot
 * resolve falls back to the `var()`'s own fallback, then to the string as
 * written. Functions and class instances pass through untouched, so scriptable
 * options and gradients keep working.
 */
export function resolveCssVariables<T>(value: T, read: (name: string) => string | undefined): T {
  if (typeof value === 'string') {
    const match = cssVariable.exec(value)
    if (!match) return value
    const resolved = read(match[1]!)
    if (resolved) return resolved as T
    return (match[2] ? resolveCssVariables(match[2], read) : value) as T
  }
  if (Array.isArray(value)) {
    return value.map((entry: unknown) => resolveCssVariables(entry, read)) as T
  }
  if (isPlainObject(value)) {
    const resolved: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      resolved[key] = resolveCssVariables(entry, read)
    }
    return resolved as T
  }
  return value
}
