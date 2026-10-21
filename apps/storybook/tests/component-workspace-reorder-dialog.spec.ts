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
          '../../../packages/ui/tests/fixtures/workspace-reorder-dialog.tsx'
        ),
        formats: ['iife'],
        name: 'WorkspaceReorderDialogFixture',
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
    '<!doctype html><html lang="en"><head><title>Workspace reorder</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

const settle = (page: Page, index: number, how: 'resolve' | 'reject') =>
  page.evaluate(
    ([i, action]) => {
      const fixture = (
        window as unknown as {
          reorderFixture: Record<string, (index: number) => void>
        }
      ).reorderFixture
      fixture[action as string]?.(i as number)
    },
    [index, how] as const
  )

// Two animation frames: the dialog restores focus on the frame after a save settles.
const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  )

const open = async (page: Page) => {
  await page.getByRole('button', { name: 'Open reorder' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reorder workspaces' })
  await expect(dialog).toBeVisible()
  return dialog
}

const close = async (page: Page) => {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

const saves = (page: Page) => page.getByLabel('Saves started', { exact: true })
const order = (page: Page) => page.getByLabel('Order', { exact: true })

test('a save started before a close keeps later moves waiting after the dialog reopens', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Move adea down' }).click()
  await expect(saves(page)).toHaveText('1')

  await close(page)
  await open(page)

  const down = page.getByRole('button', { name: 'Move cortana up' })
  await expect(down).toHaveAttribute('aria-disabled', 'true')
  await down.click({ force: true })
  await frames(page)
  await expect(saves(page)).toHaveText('1')
  await expect(order(page)).toHaveText('home,adea,cortana')

  await settle(page, 0, 'resolve')
  await expect(order(page)).toHaveText('home,cortana,adea')
  await expect(page.getByRole('button', { name: 'Move cortana down' })).not.toHaveAttribute(
    'aria-disabled',
    'true'
  )
})

test('a save finishing after a reopen does not write the new session status or move its focus', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Move adea down' }).click()
  await close(page)
  await open(page)

  await settle(page, 0, 'resolve')
  await expect(order(page)).toHaveText('home,cortana,adea')
  await frames(page)

  await expect(page.getByRole('status')).toHaveText('')
  await expect(page.locator('[data-move]:focus')).toHaveCount(0)
})

test('the next save after a stale one runs alone and only its own result is announced', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Move adea down' }).click()
  await close(page)
  await open(page)
  await settle(page, 0, 'resolve')
  await expect(order(page)).toHaveText('home,cortana,adea')

  await page.getByRole('button', { name: 'Move adea up' }).click()
  await expect(saves(page)).toHaveText('2')
  // The first save has long settled; settling it again changes nothing.
  await settle(page, 0, 'resolve')
  await expect(page.getByRole('status')).toHaveText('')
  await expect(page.getByRole('list', { name: 'Workspace order' })).toHaveAttribute(
    'aria-busy',
    'true'
  )

  await settle(page, 1, 'resolve')
  await expect(page.getByRole('status')).toHaveText('Moved adea to position 2 of 3.')
  await expect(order(page)).toHaveText('home,adea,cortana')
  await expect(page.getByRole('list', { name: 'Workspace order' })).toHaveAttribute(
    'aria-busy',
    'false'
  )
})

test('a rejected save shows an error, keeps the order, and can be retried', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Move adea down' }).click()
  await settle(page, 0, 'reject')

  await expect(page.getByRole('alert')).toHaveText('Could not save the order. Try again.')
  await expect(order(page)).toHaveText('home,adea,cortana')

  await page.getByRole('button', { name: 'Move adea down' }).click()
  await expect(saves(page)).toHaveText('2')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await settle(page, 1, 'resolve')

  await expect(page.getByRole('status')).toHaveText('Moved adea to position 3 of 3.')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(order(page)).toHaveText('home,cortana,adea')
})

test('a rejection after the dialog closed is not shown on reopen and frees the next move', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Move adea down' }).click()
  await close(page)
  await settle(page, 0, 'reject')
  await open(page)

  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Move adea down' })).not.toHaveAttribute(
    'aria-disabled',
    'true'
  )
  await page.getByRole('button', { name: 'Move adea down' }).click()
  await expect(saves(page)).toHaveText('2')
})

test('focus stays on the control used while open and is not taken after the dialog closes', async ({
  page,
}) => {
  await open(page)
  const down = page.getByRole('button', { name: 'Move adea down' })
  await down.focus()
  await down.click()
  await settle(page, 0, 'resolve')
  // adea reached the end, so focus lands on its remaining control.
  await expect(page.getByRole('button', { name: 'Move adea up' })).toBeFocused()

  const up = page.getByRole('button', { name: 'Move adea up' })
  await up.click()
  await expect(saves(page)).toHaveText('2')
  await close(page)
  const opener = page.getByRole('button', { name: 'Open reorder' })
  await expect(opener).toBeFocused()

  await settle(page, 1, 'resolve')
  await frames(page)
  await expect(opener).toBeFocused()
})

test('focus is back on the moved control as soon as its save settles, not a frame later', async ({
  page,
}) => {
  await open(page)
  const down = page.getByRole('button', { name: 'Move adea down' })
  await down.focus()
  await down.click()

  // Settle the save and look at focus after the microtasks it queues, before any
  // frame: a key pressed in that gap would otherwise go nowhere.
  const focused = await page.evaluate(async () => {
    const fixture = (window as unknown as { reorderFixture: Record<string, (i: number) => void> })
      .reorderFixture
    fixture['resolve']?.(0)
    for (let tick = 0; tick < 5; tick += 1) await Promise.resolve()
    return document.activeElement?.getAttribute('aria-label') ?? null
  })
  expect(focused).toBe('Move adea up')

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
