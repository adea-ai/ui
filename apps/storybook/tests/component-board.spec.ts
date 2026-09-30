import { expect, test } from '@playwright/test'
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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/board.tsx'),
        formats: ['iife'],
        name: 'BoardFixture',
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
    '<!doctype html><html lang="en"><head><title>Board fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('pointer drops accept legal destinations and refuse disabled columns', async ({ page }) => {
  const card = page.getByRole('article')
  await card.dragTo(page.getByRole('region', { name: 'Blocked', exact: true }))
  await expect(page.getByLabel('Move count')).toHaveText('0')
  await expect(
    page.getByRole('region', { name: 'To do', exact: true }).getByRole('article')
  ).toBeVisible()
  await card.dragTo(page.getByRole('region', { name: 'Done', exact: true }))
  await expect(page.getByLabel('Move count')).toHaveText('1')
  await expect(
    page.getByRole('region', { name: 'Done', exact: true }).getByRole('article')
  ).toBeVisible()
})

test('keyboard moves never wrap at boundaries and skip disabled columns', async ({ page }) => {
  const card = page.getByRole('article')
  await card.focus()
  await card.press('Control+ArrowLeft')
  await expect(page.getByLabel('Move count')).toHaveText('0')
  await card.press('Control+ArrowRight')
  await expect(page.getByLabel('Move count')).toHaveText('1')
  await expect(
    page.getByRole('region', { name: 'Done', exact: true }).getByRole('article')
  ).toBeVisible()
  await expect(card).toBeFocused()
  await card.press('Control+ArrowRight')
  await expect(page.getByLabel('Move count')).toHaveText('1')
  await card.press('Control+ArrowLeft')
  await expect(page.getByLabel('Move count')).toHaveText('2')
  await expect(
    page.getByRole('region', { name: 'To do', exact: true }).getByRole('article')
  ).toBeVisible()
})

test('a delayed controlled move restores card focus until another action takes focus', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Defer moves' }).click()
  const card = page.getByRole('article')
  await card.getByRole('button', { name: 'Synthetic card' }).focus()
  await page.keyboard.press('Control+ArrowRight')
  await expect(
    page.getByRole('region', { name: 'Done', exact: true }).getByRole('article')
  ).toBeVisible()
  await expect(card).toBeFocused()
  await card.press('Control+ArrowLeft')
  const action = page.getByRole('button', { name: 'Another action' })
  await action.focus()
  await expect(
    page.getByRole('region', { name: 'To do', exact: true }).getByRole('article')
  ).toBeVisible()
  await expect(action).toBeFocused()
})
