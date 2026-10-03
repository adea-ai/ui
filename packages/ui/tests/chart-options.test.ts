import { describe, expect, test } from 'bun:test'
import type { ChartOptions } from 'chart.js'
import {
  chartOptions,
  chartSeriesColors,
  mergeChartOptions,
  resolveCssVariables,
} from '../src/components/ui/chart/chart-options'
import { colorTokens, typographyTokens } from '../src/lib/tokens'

/** A scriptable option: a value Chart.js calls rather than reads. */
const scriptableColor = () => 'red'

const read = (name: string) => ({ '--chart-1': 'rgba(1, 2, 3, 1)' })[name]

/** Every `var(--name)` a value refers to, at any depth. */
function referencedTokens(value: unknown): string[] {
  const found = new Set<string>()
  resolveCssVariables(value, (name) => {
    found.add(name.slice(2))
    return undefined
  })
  return [...found]
}

describe('chartOptions', () => {
  test('refers only to tokens the theme defines', () => {
    const declared = new Set([...colorTokens, ...typographyTokens].map((token) => token.name))
    const referenced = [
      ...referencedTokens(chartOptions()),
      ...referencedTokens(chartOptions(undefined, 'radial')),
      ...referencedTokens(chartSeriesColors),
    ]
    expect(referenced.length).toBeGreaterThan(0)
    expect(referenced.filter((name) => !declared.has(name))).toEqual([])
  })

  test('maps the chart furniture onto the line and secondary-text tokens', () => {
    const options = chartOptions()
    expect(options.scales?.['x']?.grid?.color).toBe('var(--border)')
    expect(options.scales?.['x']?.ticks?.color).toBe('var(--muted-foreground)')
    expect(options.plugins?.legend?.labels?.color).toBe('var(--muted-foreground)')
  })

  test('merges an axis override into the axis rather than replacing it', () => {
    const options = chartOptions({ scales: { x: { stacked: true } } })
    expect(options.scales?.['x']).toMatchObject({
      stacked: true,
      grid: { color: 'var(--border)', drawTicks: false },
      ticks: {
        color: 'var(--muted-foreground)',
        font: { family: 'var(--font-sans)', size: 'var(--text-2xs)' },
      },
    })
    expect(options.scales?.['y']?.grid?.color).toBe('var(--border)')
  })

  test('merges a nested plugin override without losing its siblings', () => {
    const options = chartOptions({ plugins: { legend: { labels: { boxWidth: 12 } } } })
    expect(options.plugins?.legend?.labels).toMatchObject({
      boxWidth: 12,
      color: 'var(--muted-foreground)',
      usePointStyle: true,
    })
    expect(options.plugins?.tooltip?.backgroundColor).toBe('var(--popover)')
  })

  test('sets every text in the UI face at a type-scale rung', () => {
    const radial = chartOptions(undefined, 'radial') as ChartOptions<'polarArea'>
    const fonts = [
      chartOptions().scales?.['x']?.ticks?.font,
      chartOptions().scales?.['y']?.ticks?.font,
      radial.scales?.r?.ticks?.font,
      radial.scales?.r?.pointLabels?.font,
      chartOptions().plugins?.legend?.labels?.font,
      chartOptions().plugins?.tooltip?.titleFont,
      chartOptions().plugins?.tooltip?.bodyFont,
      chartOptions().plugins?.tooltip?.footerFont,
    ]
    for (const font of fonts) {
      expect(font).toMatchObject({ family: 'var(--font-sans)', size: 'var(--text-2xs)' })
    }
  })

  test('gives a radial or scale-less chart no cartesian axes', () => {
    expect(Object.keys(chartOptions(undefined, 'radial').scales ?? {})).toEqual(['r'])
    expect(chartOptions(undefined, 'none').scales).toBeUndefined()
    expect(Object.keys(chartOptions().scales ?? {}).toSorted()).toEqual(['x', 'y'])
  })
})

describe('mergeChartOptions', () => {
  test('replaces arrays and functions, skips undefined, and mutates no source', () => {
    const base = {
      scales: { x: { ticks: { color: 'blue', font: { size: 10 } } } },
      layout: { padding: 4 },
      plugins: { legend: { labels: { color: 'blue' } } },
    }
    const merged = mergeChartOptions(
      base,
      undefined,
      { scales: { x: { ticks: { color: scriptableColor } } } },
      { layout: { padding: undefined } },
      { plugins: { title: { text: ['one', 'two'] } } },
      { plugins: { title: { text: ['three'] } } }
    )
    expect(merged.scales?.['x']?.ticks?.color).toBe(scriptableColor)
    expect(merged.scales?.['x']?.ticks?.font).toEqual({ size: 10 })
    expect(merged.layout?.padding).toBe(4)
    expect(merged.plugins?.title?.text).toEqual(['three'])
    expect(base.scales.x.ticks.color).toBe('blue')
  })
})

describe('resolveCssVariables', () => {
  test('resolves var() strings at any depth and leaves other values alone', () => {
    // Any non-plain object stands in for a CanvasGradient or a pattern.
    const gradient = new Map()
    const input = {
      color: 'var(--chart-1)',
      list: ['var( --chart-1 )', 'red', 3],
      nested: { gradient, scriptable: read },
    }
    const output = resolveCssVariables(input, read)
    expect(output.color).toBe('rgba(1, 2, 3, 1)')
    expect(output.list).toEqual(['rgba(1, 2, 3, 1)', 'red', 3])
    expect(output.nested.gradient).toBe(gradient)
    expect(output.nested.scriptable).toBe(read)
    expect(input.color).toBe('var(--chart-1)')
  })

  test('passes a numeric resolution through as a number', () => {
    const font: Record<string, unknown> = { family: 'var(--font-sans)', size: 'var(--text-2xs)' }
    const output = resolveCssVariables(font, (name) =>
      name === '--text-2xs' ? 11 : name === '--font-sans' ? 'Geist, sans-serif' : undefined
    )
    expect(output).toEqual({ family: 'Geist, sans-serif', size: 11 })
  })

  test('falls back to the var() fallback, then to the string as written', () => {
    expect(resolveCssVariables('var(--missing, var(--chart-1))', read)).toBe('rgba(1, 2, 3, 1)')
    expect(resolveCssVariables('var(--missing, #fff)', read)).toBe('#fff')
    expect(resolveCssVariables('var(--missing)', read)).toBe('var(--missing)')
  })
})
