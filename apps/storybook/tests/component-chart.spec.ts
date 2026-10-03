import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

let script: string
let css: string

test.beforeAll(async () => {
  const result = await build({
    root: resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/chart.tsx'),
        formats: ['iife'],
        name: 'ChartFixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  script = assets
    .filter((asset) => asset.type === 'chunk')
    .map((asset) => asset.code)
    .join('\n')
  css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\n')
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Chart</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  await expect(page.locator('canvas')).toHaveCount(6)
})

type ChartSnapshot = {
  datasetColors: unknown[]
  scaleIds: string[]
  xGrid?: unknown
  xTicks?: unknown
  xStacked?: unknown
  legendLabels?: unknown
}

/** The slice of Chart.js's registry the spec reads, typed without importing it. */
type ChartRegistry = {
  getChart(canvas: HTMLCanvasElement): {
    data: { datasets: { backgroundColor?: unknown; borderColor?: unknown }[] }
    scales: Record<string, unknown>
    options: {
      scales?: Record<string, unknown>
      plugins?: { legend?: { labels?: { color?: unknown } } }
    }
  }
}

/** Reads each chart's resolved state back through Chart.js's registry. */
function snapshot(page: Page): Promise<ChartSnapshot[]> {
  return page.evaluate(() => {
    const { Chart } = (window as unknown as { chartFixture: { Chart: ChartRegistry } }).chartFixture
    return [...document.querySelectorAll('canvas')].map((canvas) => {
      const chart = Chart.getChart(canvas)!
      const x = chart.options.scales?.['x'] as Record<string, Record<string, unknown>> | undefined
      return {
        datasetColors: chart.data.datasets.flatMap((dataset) => [
          dataset.backgroundColor,
          dataset.borderColor,
        ]),
        scaleIds: Object.keys(chart.scales),
        xGrid: x?.['grid']?.['color'],
        xTicks: x?.['ticks']?.['color'],
        xStacked: x?.['stacked'],
        legendLabels: chart.options.plugins?.legend?.labels?.color,
      }
    })
  })
}

/**
 * A token as a canvas would paint it: the computed custom property, drawn and
 * read back. Independent of the component's own resolver on purpose.
 */
function painted(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    const context = document.createElement('canvas').getContext('2d')!
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a! / 255) * 1000) / 1000})`
  }, token)
}

test('resolves the theme tokens before they reach the canvas', async ({ page }) => {
  const charts = await snapshot(page)
  const colors = charts.flatMap((chart) => [
    ...chart.datasetColors.flat(),
    chart.xGrid,
    chart.xTicks,
    chart.legendLabels,
  ])
  for (const color of colors.filter((value) => value !== undefined)) {
    expect(String(color)).not.toContain('var(')
  }

  const [line, bar] = charts
  expect(line!.datasetColors[1]).toBe(await painted(page, '--chart-1'))
  expect(line!.datasetColors[3]).toBe(await painted(page, '--chart-2'))
  expect(line!.xGrid).toBe(await painted(page, '--border'))
  expect(line!.xTicks).toBe(await painted(page, '--muted-foreground'))
  expect(line!.legendLabels).toBe(await painted(page, '--muted-foreground'))
  // `stacked` is merged into the axis, not substituted for it.
  expect(bar!.xStacked).toBe(true)
  expect(bar!.xGrid).toBe(await painted(page, '--border'))
})

test('draws the series in colour rather than the canvas default black', async ({ page }) => {
  const pixels = await page
    .locator('canvas')
    .first()
    .evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')!
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let opaque = 0
      let black = 0
      let chromatic = 0
      for (let index = 0; index < data.length; index += 4) {
        const [r, g, b, a] = [data[index]!, data[index + 1]!, data[index + 2]!, data[index + 3]!]
        if (a < 200) continue
        opaque += 1
        if (r < 24 && g < 24 && b < 24) black += 1
        if (Math.max(r, g, b) - Math.min(r, g, b) > 40) chromatic += 1
      }
      return { opaque, black, chromatic }
    })
  expect(pixels.opaque).toBeGreaterThan(0)
  expect(pixels.black).toBe(0)
  expect(pixels.chromatic).toBeGreaterThan(100)
})

test('re-resolves when the theme on the root changes', async ({ page }) => {
  const light = await painted(page, '--chart-1')
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  const dark = await painted(page, '--chart-1')
  expect(dark).not.toBe(light)
  await expect.poll(async () => (await snapshot(page))[0]!.datasetColors[1]).toBe(dark)

  await page.evaluate(() => document.documentElement.style.setProperty('--chart-1', 'rgb(1, 2, 3)'))
  await expect
    .poll(async () => (await snapshot(page))[0]!.datasetColors[1])
    .toBe('rgba(1, 2, 3, 1)')
})

test('draws no cartesian axes on a radial chart', async ({ page }) => {
  const [line, , doughnut, pie, polar, radar] = await snapshot(page)
  expect(line!.scaleIds.toSorted()).toEqual(['x', 'y'])
  expect(doughnut!.scaleIds).toEqual([])
  expect(pie!.scaleIds).toEqual([])
  expect(polar!.scaleIds).toEqual(['r'])
  expect(radar!.scaleIds).toEqual(['r'])
})

test('draws the frame description in the muted foreground', async ({ page }) => {
  const description = page.getByText('Rolling six months.')
  const color = await description.evaluate((element) => getComputedStyle(element).color)
  const muted = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.className = 'text-muted-foreground'
    document.body.append(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    return value
  })
  expect(color).toBe(muted)
})

test('releases the theme observer with the chart', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.evaluate(() => {
    ;(window as unknown as { chartFixture: { dispose: () => void } }).chartFixture.dispose()
    document.documentElement.classList.toggle('dark')
  })
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(errors).toEqual([])
})
