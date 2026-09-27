import { expect, test, type Locator } from '@playwright/test'
import { resolve } from 'node:path'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

let script: string
let css: string
const packedRoot = process.env['ADEA_DESTRUCTIVE_PACKED_ROOT']
const packedCondition = process.env['ADEA_DESTRUCTIVE_PACKED_CONDITION']
const uiRoot = packedRoot ?? resolve(import.meta.dirname, '../../../packages/ui')
const entry = packedRoot
  ? resolve(packedRoot, 'destructive.tsx')
  : resolve(uiRoot, 'tests/fixtures/destructive-actions.tsx')

if (packedRoot && packedCondition !== 'compiled' && packedCondition !== 'solid')
  throw new Error('Packed destructive-action fixture requires an explicit browser condition')

test.beforeAll(async () => {
  const result = await build({
    root: uiRoot,
    configFile: false,
    logLevel: 'error',
    plugins: [
      solid(),
      tailwindcss(),
      ...(packedRoot && packedCondition === 'compiled'
        ? [
            {
              name: 'compiled-destructive-condition',
              enforce: 'post' as const,
              configEnvironment(_name: string, config: EnvironmentOptions) {
                config.resolve ??= {}
                config.resolve.conditions = (config.resolve.conditions ?? []).filter(
                  (condition) => condition !== 'solid' && condition !== 'development'
                )
              },
            },
          ]
        : []),
    ],
    resolve: packedRoot
      ? { conditions: packedCondition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] }
      : undefined,
    build: {
      write: false,
      minify: false,
      lib: {
        entry,
        formats: ['iife'],
        name: 'DestructiveActionFixture',
        cssFileName: 'destructive-action-fixture',
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

  if (packedRoot) {
    const modules = assets
      .filter((asset) => asset.type === 'chunk')
      .flatMap((asset) => Object.keys(asset.modules))
      .filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    const expected = packedCondition === 'compiled' ? '/dist/' : '/src/'
    if (!modules.length || modules.some((id) => !id.includes(expected)))
      throw new Error(`Packed destructive-action fixture did not select ${packedCondition}`)
  }
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Destructive action themes</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addStyleTag({
    content: '* { animation: none !important; transition: none !important; }',
  })
  await page.addScriptTag({ content: script })
})

function linearChannel(value: number): number {
  const normalized = value / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

function luminance(rgb: readonly number[]): number {
  return (
    0.2126 * linearChannel(rgb[0]!) +
    0.7152 * linearChannel(rgb[1]!) +
    0.0722 * linearChannel(rgb[2]!)
  )
}

function contrast(foreground: readonly number[], background: readonly number[]): number {
  const light = luminance(foreground)
  const dark = luminance(background)
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05)
}

async function pixels(locator: Locator) {
  return locator.evaluate((button) => {
    const surface = button.parentElement
    const theme = button.closest<HTMLElement>('[data-theme-id]')
    if (!surface || !theme) throw new Error('Destructive action fixture lost its theme surface')
    const buttonStyle = getComputedStyle(button)
    const surfaceColor = getComputedStyle(surface).backgroundColor
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas is unavailable for rendered color measurement')

    const colorPixels = (fill: string, underlay?: string): number[] => {
      context.clearRect(0, 0, 1, 1)
      if (underlay) {
        context.fillStyle = underlay
        context.fillRect(0, 0, 1, 1)
      }
      context.fillStyle = fill
      context.fillRect(0, 0, 1, 1)
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
    }

    const expectedForeground = getComputedStyle(theme).getPropertyValue(
      '--destructive-action-foreground'
    )
    const expectedFill = getComputedStyle(theme).getPropertyValue('--destructive-action')
    return {
      label: button.getAttribute('aria-label') ?? 'unknown action',
      surface: surface.dataset['surface'] ?? 'unknown surface',
      foreground: colorPixels(buttonStyle.color),
      expectedForeground: colorPixels(expectedForeground),
      fill: colorPixels(buttonStyle.backgroundColor, surfaceColor),
      expectedFill: colorPixels(expectedFill, surfaceColor),
    }
  })
}

test('packed destructive actions and semantic notices compose across the catalogue', async ({
  page,
}) => {
  const sections = page.locator('[data-theme-id]')
  const themeCount = await sections.count()
  expect(themeCount).toBeGreaterThanOrEqual(20)
  const buttons = page.locator('[data-destructive-action]')
  await expect(buttons).toHaveCount(themeCount * 3)

  for (let index = 0; index < (await buttons.count()); index += 1) {
    const button = buttons.nth(index)
    const normal = await pixels(button)
    expect(
      normal.fill,
      `${normal.label} did not use the projected action fill on ${normal.surface}`
    ).toEqual(normal.expectedFill)
    expect(
      normal.foreground,
      `${normal.label} did not use the projected action foreground`
    ).toEqual(normal.expectedForeground)
    expect(
      contrast(normal.foreground, normal.fill),
      `${normal.label} normal state is below AA on ${normal.surface}`
    ).toBeGreaterThanOrEqual(4.5)

    await button.hover({ force: true })
    const hovered = await pixels(button)
    expect(
      hovered.foreground,
      `${hovered.label} hover changed the projected action foreground`
    ).toEqual(hovered.expectedForeground)
    expect(
      contrast(hovered.foreground, hovered.fill),
      `${hovered.label} /90 hover is below AA on ${hovered.surface}`
    ).toBeGreaterThanOrEqual(4.5)
  }

  const semantic = await page.locator('[data-theme-id]').evaluateAll((elements) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas is unavailable for semantic color measurement')
    const colorPixels = (value: string): number[] => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
    }

    return elements.map((element) => {
      const theme = element as HTMLElement
      const variables = getComputedStyle(theme)
      const badge = theme.querySelector<HTMLElement>('[data-destructive-badge]')
      const alert = theme.querySelector<HTMLElement>('[data-destructive-alert]')
      const icon = alert?.querySelector<HTMLElement>('[data-slot="alert-icon"]')
      if (!badge || !alert || !icon) throw new Error('Semantic status fixture is incomplete')
      const badgeStyle = getComputedStyle(badge)
      const alertStyle = getComputedStyle(alert)
      return {
        id: theme.dataset['themeId'],
        error: colorPixels(variables.getPropertyValue('--destructive')),
        subtle: colorPixels(variables.getPropertyValue('--destructive-subtle')),
        body: colorPixels(variables.getPropertyValue('--foreground')),
        badgeFill: colorPixels(badgeStyle.backgroundColor),
        badgeText: colorPixels(badgeStyle.color),
        alertFill: colorPixels(alertStyle.backgroundColor),
        alertText: colorPixels(alertStyle.color),
        alertIcon: colorPixels(getComputedStyle(icon).color),
      }
    })
  })

  for (const item of semantic) {
    expect(item.badgeFill, `${item.id} Badge lost its canonical subtle tint`).toEqual(item.subtle)
    expect(item.badgeText, `${item.id} Badge lost body text contrast`).toEqual(item.body)
    expect(item.alertFill, `${item.id} Alert lost its canonical subtle tint`).toEqual(item.subtle)
    expect(item.alertText, `${item.id} Alert lost body text contrast`).toEqual(item.body)
    expect(item.alertIcon, `${item.id} Alert icon lost its canonical error hue`).toEqual(item.error)
  }
})
