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
  // Dragging a card is a direct act on it: it ends focused in its new lane,
  // even though the drag began on a button inside it.
  await expect(
    page.getByRole('region', { name: 'Done', exact: true }).getByRole('article')
  ).toBeFocused()
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

test('empty lanes fold to a narrow, still-droppable strip and unfold once they hold a card', async ({
  page,
}) => {
  const done = page.getByRole('region', { name: 'Done', exact: true })
  const todo = page.getByRole('region', { name: 'To do', exact: true })
  await expect(done).toHaveAttribute('data-collapsed', '')
  await expect(todo).not.toHaveAttribute('data-collapsed', '')
  const folded = await done.boundingBox()
  const open = await todo.boundingBox()
  expect(folded!.width).toBeLessThan(open!.width / 4)
  // The folded lane keeps its name visible, set on its side.
  await expect(done.getByRole('heading', { name: 'Done' })).toBeVisible()
  await page.getByRole('article').dragTo(done)
  await expect(page.getByLabel('Move count')).toHaveText('1')
  await expect(done).not.toHaveAttribute('data-collapsed', '')
  await expect(todo).toHaveAttribute('data-collapsed', '')
  await expect(done.getByRole('article')).toBeVisible()
})

test('a confirmed move that hands back fresh column objects keeps the moved card focused', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Echo moves' }).click()
  const card = page.getByRole('article')
  await card.focus()
  await page.keyboard.press('Control+ArrowRight')
  const done = page.getByRole('region', { name: 'Done', exact: true })
  await expect(done.getByRole('article')).toBeFocused()
  // Outlast the echo: re-derived columns must not remount the lane.
  await page.waitForTimeout(400)
  await expect(done.getByRole('article')).toBeFocused()
})
