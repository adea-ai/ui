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
        entry: resolve(
          import.meta.dirname,
          '../../../packages/ui/tests/fixtures/action-button.tsx'
        ),
        formats: ['iife'],
        name: 'ActionButtonFixture',
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

async function mountFixture(page: Page) {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
}

async function focusByKeyboard(page: Page, target: any, maxStops = 40) {
  await page.keyboard.press('Tab')
  for (let stop = 1; stop < maxStops; stop += 1) {
    if (await target.evaluate((element: Element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
}

test('probe handoff end state', async ({ page }) => {
  await mountFixture(page)
  const source = page.getByRole('button', { name: 'Controlled tooltip handoff source' })
  const target = page.getByRole('button', { name: 'Tooltip handoff target' })
  const dismissalListeners = page.getByLabel('Active tooltip dismissal listeners')
  const positioningListeners = page.getByLabel('Active popper positioning listeners')

  await expect(dismissalListeners).toHaveText('0 document / 0 window')
  await focusByKeyboard(page, source)
  await expect(page.getByRole('tooltip', { name: 'Controlled tooltip help' })).toBeVisible()
  await target.hover()
  await expect(page.getByRole('tooltip', { name: 'Handoff target help' })).toBeVisible()
  await page.getByRole('button', { name: 'Accept tooltip close' }).click()

  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (let hop = 0; hop < 8; hop += 1) {
      await page.keyboard.press('Shift+Tab')
      if (
        await page
          .getByRole('link', { name: 'Details' })
          .evaluate((el) => el === document.activeElement)
      )
        break
    }
    for (let hop = 0; hop < 8; hop += 1) {
      await page.keyboard.press('Tab')
      if (await source.evaluate((el) => el === document.activeElement)) break
    }
    await expect(page.getByRole('tooltip', { name: 'Controlled tooltip help' })).toBeVisible()
    await source.press('Escape')
    await expect(page.getByRole('tooltip', { name: 'Controlled tooltip help' })).toBeHidden()
    console.log(
      'LOOP',
      attempt,
      'poppers',
      await positioningListeners.textContent(),
      'positioners',
      await page.evaluate(
        () =>
          document.querySelectorAll(
            '[data-kb-popper-positioner], [kobalte-positioner], .kobalte-positioner'
          ).length
      ),
      'tooltips',
      await page.evaluate(() => document.querySelectorAll('[role="tooltip"]').length)
    )
  }

  await page.mouse.move(1, 1)
  await page.getByRole('button', { name: 'Unmount tooltip handoff fixture' }).click()
  await expect(source).toHaveCount(0)
  await expect(target).toHaveCount(0)
  for (let round = 0; round < 3; round += 1) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
    const state = await page.evaluate(() => ({
      tooltips: [...document.querySelectorAll('[role="tooltip"]')].map((el) => ({
        text: el.textContent?.slice(0, 36),
        expanded: el.hasAttribute('data-expanded'),
      })),
      describedby: (document.activeElement as HTMLElement)?.getAttribute?.('aria-describedby'),
      active: document.activeElement?.textContent?.slice(0, 30),
    }))
    console.log('ROUND', round, JSON.stringify(state))
  }
  await page.waitForTimeout(500)
  const dump = await page.evaluate(() => ({
    tooltips: [...document.querySelectorAll('[role="tooltip"]')].map((el) => ({
      text: el.textContent?.slice(0, 40),
      expanded: el.hasAttribute('data-expanded'),
      closed: el.hasAttribute('data-closed'),
    })),
    active: document.activeElement?.textContent?.slice(0, 40),
  }))
  console.log('DUMP:', JSON.stringify(dump, null, 2))
  console.log('POPPERS:', await positioningListeners.textContent())
  console.log('DISMISSAL:', await dismissalListeners.textContent())
})
