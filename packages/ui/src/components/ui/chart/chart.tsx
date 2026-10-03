import { For, Show, createSignal, onCleanup, onMount, splitProps, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { Bar, Bubble, Doughnut, Line, Pie, PolarArea, Radar, Scatter } from 'solid-chartjs'
import {
  Chart as ChartJs,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  LogarithmicScale,
  PointElement,
  RadialLinearScale,
  Tooltip as ChartTooltip,
} from 'chart.js'
import type { ChartOptions, ChartType } from 'chart.js'
import { cn } from '#lib/utils'
import {
  chartOptions,
  chartSeriesColors,
  mergeChartOptions,
  resolveCssVariables,
  type ChartScaleShape,
} from './chart-options'

/**
 * Chart.
 *
 * A thin wrapper over Chart.js, themed through the same CSS custom properties as
 * everything else. The wrapper is thin on purpose: a design system's job here is
 * to make a chart *look like the rest of the application* — the palette, the
 * type scale, the tooltip surface, the grid lines — and not to re-implement
 * scales and axes, which is where a hand-rolled chart goes wrong.
 *
 * ## Registration, and why it is here rather than left to the caller
 *
 * Chart.js is tree-shakeable through explicit registration: nothing is bundled
 * until a controller, a scale or a plugin is registered. That is the whole reason
 * it was chosen over a batteries-included charting library, and it only pays off
 * if the registrations are scoped to what a component actually uses.
 *
 * This module registers the **shared** pieces once — scales, elements, tooltip,
 * legend, filler — and nothing else. The controllers are imported per component
 * so a `LineChart` does not carry the radar controller, and a consumer that
 * imports only `LineChart` gets only that. Measured: see the story for the
 * per-component figures the tree-shaking gate publishes.
 *
 * A caller with a chart type this file does not export registers its own
 * controller with `registerChartPiece`, which is the escape hatch rather than a
 * reason to widen the registration above.
 *
 * ## Theming
 *
 * Colours come from `--chart-1` through `--chart-5`, which every theme
 * defines, and the grid, ticks and labels from `--border` and
 * `--muted-foreground`. That means a chart follows the accent axis and the
 * appearance with no per-chart configuration — and a caller that wants a
 * specific series colour passes it explicitly, as a colour or as `var(--token)`.
 *
 * A canvas cannot read a custom property, so the options and datasets carry
 * `var(--token)` strings and each chart resolves them against its own element
 * when it renders, and again whenever the root's attributes change — the
 * `.dark` class, `data-accent`, an inline override. See `createThemeResolver`.
 */

/**
 * Register a piece with Chart.js. The escape hatch for a caller's own chart type.
 *
 * `solid-chartjs` re-exports the typed components but not the registry, so
 * registration comes from `chart.js` itself — which is also the honest place for
 * it, since the registry is Chart.js's global.
 */
export function registerChartPiece(piece: Parameters<typeof ChartJs.register>[number]): void {
  ChartJs.register(piece)
}

ChartJs.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  ChartTooltip,
  Legend
)

export { chartOptions, chartSeriesColors }

/**
 * One pixel to paint a colour on, shared by every chart.
 *
 * The canvas *paints* `oklch()`, but Chart.js also *parses* colours — to derive a
 * hover shade and to animate between two colours — and its parser reads only
 * rgb, hsl, hex and names. Painting the computed value and reading the pixel
 * back gives the sRGB colour the canvas would have drawn anyway, in a form both
 * understand, whatever syntax a theme uses (`oklch()`, `color-mix()`, …).
 */
let swatch: CanvasRenderingContext2D | null | undefined

function toCanvasColor(value: string): string {
  if (typeof CSS === 'undefined' || !CSS.supports('color', value)) return value
  if (swatch === undefined) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    swatch = canvas.getContext('2d', { willReadFrequently: true })
  }
  if (!swatch) return value
  swatch.globalCompositeOperation = 'copy'
  swatch.fillStyle = value
  swatch.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = swatch.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${Math.round(((a ?? 255) / 255) * 1000) / 1000})`
}

/**
 * Resolves `var(--token)` strings against a chart's element, and re-resolves
 * them when the theme changes.
 *
 * The element rather than the root, so a chart inside a subtree with its own
 * inline tokens takes those. The observer watches every attribute on `<html>`,
 * because that is where both applications switch appearance, accent and theme
 * (`.dark`, `data-accent`, `data-theme`, inline variables); a theme axis added
 * later is covered without touching this. It is released with the chart.
 */
function createThemeResolver() {
  let element: HTMLElement | undefined
  const [revision, invalidate] = createSignal(undefined, { equals: false })

  onMount(() => {
    const observer = new MutationObserver(() => invalidate())
    observer.observe(document.documentElement, { attributes: true })
    onCleanup(() => observer.disconnect())
  })

  return {
    ref: (el: HTMLElement) => {
      element = el
    },
    resolve<T>(value: T): T {
      revision()
      if (!element || typeof getComputedStyle === 'undefined') return value
      const style = getComputedStyle(element)
      const resolved = new Map<string, string | undefined>()
      return resolveCssVariables(value, (name) => {
        if (!resolved.has(name)) {
          const raw = style.getPropertyValue(name).trim()
          resolved.set(name, raw ? toCanvasColor(raw) : undefined)
        }
        return resolved.get(name)
      })
    },
  }
}

/** A chart's frame: a bordered surface with a title and an optional description. */
export type ChartFrameProps = {
  /** The chart's title. Required — a chart with no name is not readable. */
  title: string
  /** What the chart shows. Announced to assistive technology, and drawn. */
  description?: string
  /** Trailing controls. */
  actions?: JSX.Element
  children: JSX.Element
  class?: string
}

export function ChartFrame(props: ChartFrameProps) {
  const [local] = splitProps(props, ['title', 'description', 'actions', 'children', 'class'])

  return (
    <figure class={cn('grid gap-3 rounded-lg border border-border bg-card p-4', local.class)}>
      <figcaption class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-foreground">{local.title}</h3>
          <Show when={local.description}>
            <p class="text-xs text-muted-foreground">{local.description}</p>
          </Show>
        </div>
        {local.actions}
      </figcaption>
      {local.children}
    </figure>
  )
}

type SeriesChartProps = {
  /** The category labels along the axis. */
  labels: readonly string[]
  /** One entry per series. `data` is aligned to `labels`. */
  series: readonly { label: string; data: readonly number[]; color?: string }[]
  /** Chart.js options, merged deeply over the theme's defaults. */
  options?: ChartOptions
  /** Stack the series. */
  stacked?: boolean
  class?: string
}

/**
 * The data as Chart.js datasets, with the theme's colours applied in order and
 * the series' own colour winning when it has one.
 *
 * `fill: false` and a 2px border are deliberate: a filled line chart is a
 * different chart, and a 1px line at a 12px label size reads as a grid line.
 */
function datasetsFor(series: SeriesChartProps['series'], filled: boolean) {
  return series.map((entry, index) => ({
    label: entry.label,
    data: [...entry.data],
    borderColor: entry.color ?? chartSeriesColors[index % chartSeriesColors.length],
    backgroundColor: entry.color ?? chartSeriesColors[index % chartSeriesColors.length],
    pointBackgroundColor: entry.color ?? chartSeriesColors[index % chartSeriesColors.length],
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.3,
    fill: filled,
  }))
}

function seriesOptions(
  props: SeriesChartProps,
  extra?: ChartOptions,
  shape: ChartScaleShape = 'cartesian'
): ChartOptions {
  // Stacking is a cartesian idea; a radar has no x or y to stack, and naming
  // them would make Chart.js draw them.
  const stacked =
    props.stacked && shape === 'cartesian'
      ? { scales: { x: { stacked: true }, y: { stacked: true } } }
      : undefined
  return chartOptions(mergeChartOptions(extra, stacked, props.options), shape)
}

/** A line chart. The default for a series over time. */
export function LineChart(props: SeriesChartProps & { area?: boolean }) {
  const theme = createThemeResolver()
  return (
    <div ref={theme.ref} class={cn('h-64', props.class)}>
      <Line
        data={theme.resolve({
          labels: [...props.labels],
          datasets: datasetsFor(props.series, props.area ?? false),
        })}
        options={theme.resolve(seriesOptions(props))}
      />
    </div>
  )
}

/** A bar chart. `stacked` for parts of a whole over categories. */
export function BarChart(props: SeriesChartProps & { horizontal?: boolean }) {
  const theme = createThemeResolver()
  return (
    <div ref={theme.ref} class={cn('h-64', props.class)}>
      <Bar
        data={theme.resolve({
          labels: [...props.labels],
          datasets: datasetsFor(props.series, true).map((dataset) => ({
            ...dataset,
            borderWidth: 0,
            borderRadius: 3,
          })),
        })}
        options={theme.resolve(seriesOptions(props, { indexAxis: props.horizontal ? 'y' : 'x' }))}
      />
    </div>
  )
}

/** A scatter plot, for a correlation rather than a series. */
export function ScatterChart(props: {
  series: readonly { label: string; data: readonly { x: number; y: number }[]; color?: string }[]
  options?: ChartOptions
  class?: string
}) {
  const theme = createThemeResolver()
  return (
    <div ref={theme.ref} class={cn('h-64', props.class)}>
      <Scatter
        data={theme.resolve({
          datasets: props.series.map((entry, index) => ({
            label: entry.label,
            data: entry.data.map((point) => ({ ...point })),
            backgroundColor: entry.color ?? chartSeriesColors[index % chartSeriesColors.length],
            pointRadius: 3,
            pointHoverRadius: 5,
          })),
        })}
        options={theme.resolve(chartOptions(props.options))}
      />
    </div>
  )
}

/** A bubble chart: scatter with a third dimension carried by the radius. */
export function BubbleChart(props: {
  series: readonly {
    label: string
    data: readonly { x: number; y: number; r: number }[]
    color?: string
  }[]
  options?: ChartOptions
  class?: string
}) {
  const theme = createThemeResolver()
  return (
    <div ref={theme.ref} class={cn('h-64', props.class)}>
      <Bubble
        data={theme.resolve({
          datasets: props.series.map((entry, index) => ({
            label: entry.label,
            data: entry.data.map((point) => ({ ...point })),
            backgroundColor: entry.color ?? chartSeriesColors[index % chartSeriesColors.length],
          })),
        })}
        options={theme.resolve(chartOptions(props.options))}
      />
    </div>
  )
}

/** A radar chart, for a profile across fixed axes. */
export function RadarChart(props: SeriesChartProps) {
  const theme = createThemeResolver()
  return (
    <div ref={theme.ref} class={cn('h-64', props.class)}>
      <Radar
        data={theme.resolve({
          labels: [...props.labels],
          datasets: datasetsFor(props.series, true),
        })}
        options={theme.resolve(seriesOptions(props, undefined, 'radial'))}
      />
    </div>
  )
}

/**
 * A polar area chart: radial bars, for a composition.
 *
 * Its scale is left to Chart.js's polar-area defaults (`'none'` rather than
 * `'radial'`): `solid-chartjs` deletes `options.scales.r` for every chart type
 * but radar when it first creates the chart, so radial styling here would apply
 * only after the first theme change — a chart that restyles itself on a toggle.
 */
export function PolarAreaChart(props: {
  labels: readonly string[]
  data: readonly number[]
  options?: ChartOptions
  class?: string
}) {
  const theme = createThemeResolver()
  return (
    <div ref={theme.ref} class={cn('h-64', props.class)}>
      <PolarArea
        data={theme.resolve({
          labels: [...props.labels],
          datasets: [
            {
              data: [...props.data],
              backgroundColor: [...chartSeriesColors],
              borderColor: 'var(--card)',
              borderWidth: 2,
            },
          ],
        })}
        options={theme.resolve(chartOptions(props.options, 'none'))}
      />
    </div>
  )
}

/**
 * A doughnut or a pie, for a composition with few enough slices to name.
 *
 * Both are one component because the only difference is the hole, and a caller
 * choosing between them is choosing a ratio rather than a chart. `cutout` is the
 * hole's share of the radius: 0 is a pie, 60% is the doughnut most dashboards
 * mean. A composition with more than about six slices should be a bar chart —
 * past that, the smallest slices become unreadable and their labels collide.
 */
export function DonutChart(props: {
  labels: readonly string[]
  data: readonly number[]
  /** The hole, as a percentage of the radius. 0 for a pie. */
  cutout?: number
  options?: ChartOptions
  class?: string
}) {
  const theme = createThemeResolver()
  // `Dynamic` rather than a local component accessor: Solid's JSX types require
  // a component reference, and an accessor returning one is a call in disguise.
  const component = () => (props.cutout === 0 ? Pie : Doughnut)
  return (
    <div ref={theme.ref} class={cn('h-64', props.class)}>
      <Dynamic
        component={component()}
        data={theme.resolve({
          labels: [...props.labels],
          datasets: [
            {
              data: [...props.data],
              backgroundColor: props.labels.map(
                (_, index) => chartSeriesColors[index % chartSeriesColors.length]
              ),
              borderColor: 'var(--card)',
              borderWidth: 2,
            },
          ],
        })}
        options={theme.resolve(
          chartOptions(
            mergeChartOptions(
              props.cutout === 0
                ? undefined
                : ({
                    cutout: `${props.cutout ?? 60}%`,
                  } satisfies ChartOptions<'doughnut'> as ChartOptions),
              props.options
            ),
            'none'
          )
        )}
      />
    </div>
  )
}

/** A legend built from the same five colours, for a chart whose legend is elsewhere. */
export function ChartLegend(props: {
  series: readonly { label: string; color?: string }[]
  class?: string
}) {
  return (
    <ul class={cn('flex flex-wrap items-center gap-x-3 gap-y-1', props.class)}>
      <For each={props.series}>
        {(entry, index) => (
          <li class="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span
              class="size-2 shrink-0 rounded-full"
              style={{
                background: entry.color ?? chartSeriesColors[index() % chartSeriesColors.length],
              }}
              aria-hidden="true"
            />
            {entry.label}
          </li>
        )}
      </For>
    </ul>
  )
}

export type { ChartType, ChartOptions }
