import { expect, test, type Page, type Route } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

/**
 * The reorder dialog is a real separate chunk here (not inlined), so these
 * specs can hold it back or fail it the way a slow or broken network would.
 */
const uiRoot = resolve(import.meta.dirname, '../../../packages/ui')
const fixture = resolve(uiRoot, 'tests/fixtures/workspace-switcher-reorder.tsx')
const origin = 'http://ui.test'

type Served = { body: string | Uint8Array; type: string }
const files = new Map<string, Served>()
let entry = ''
let styles = ''
let dialogChunk = ''

test.beforeAll(async () => {
  const result = await build({
    root: uiRoot,
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: { write: false, minify: false, rollupOptions: { input: fixture } },
  })
  const outputs = Array.isArray(result) ? result : [result]
  for (const asset of outputs.flatMap((output) => ('output' in output ? output.output : []))) {
    if (asset.type === 'chunk') {
      files.set(asset.fileName, { body: asset.code, type: 'text/javascript' })
      if (asset.isEntry) entry = asset.fileName
      if (asset.code.includes('Workspace order') && !asset.isEntry) dialogChunk = asset.fileName
    } else if (asset.fileName.endsWith('.css')) {
      files.set(asset.fileName, { body: String(asset.source), type: 'text/css' })
      styles = asset.fileName
    }
  }
  expect(entry).not.toBe('')
  expect(dialogChunk).not.toBe('')
})

type Gate = { release(): void; fail(): void; requests(): number }

/** Serve the build; the dialog chunk waits for `release` or is aborted by `fail`. */
async function open(page: Page): Promise<Gate> {
  let release!: () => void
  let fail!: () => void
  const decision = new Promise<'release' | 'fail'>((done) => {
    release = () => done('release')
    fail = () => done('fail')
  })
  let requests = 0
  await page.route(`${origin}/**`, async (route: Route) => {
    const path = new URL(route.request().url()).pathname.slice(1)
    if (path === '') {
      await route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><title>Switcher</title><link rel="stylesheet" href="/${styles}"></head><body><script type="module" src="/${entry}"></script></body></html>`,
      })
      return
    }
    if (path === dialogChunk) {
      requests += 1
      if ((await decision) === 'fail') await route.abort('failed')
      else await route.fulfill({ contentType: 'text/javascript', body: files.get(path)!.body })
      return
    }
    const served = files.get(path)
    if (served) await route.fulfill({ contentType: served.type, body: served.body })
    else await route.abort()
  })
  await page.goto(`${origin}/`)
  return { release, fail, requests: () => requests }
}

const trigger = (page: Page) => page.getByRole('button', { name: /Switch workspace/ })
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Reorder workspaces' })

async function chooseReorder(page: Page) {
  await trigger(page).click()
  await page.getByRole('menuitem', { name: 'Reorder workspaces…' }).click()
}

test('Escape while the chunk is loading cancels the open', async ({ page }) => {
  const gate = await open(page)
  await chooseReorder(page)
  await expect.poll(gate.requests).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  gate.release()
  await page.waitForTimeout(500)

  await expect(dialog(page)).toHaveCount(0)
  // The switcher still works and the dialog opens when asked for again.
  await chooseReorder(page)
  await expect(dialog(page)).toBeVisible()
})

test('a click elsewhere while the chunk is loading cancels the open', async ({ page }) => {
  const gate = await open(page)
  await chooseReorder(page)
  await expect.poll(gate.requests).toBeGreaterThan(0)
  await page.mouse.click(5, 300)
  gate.release()
  await page.waitForTimeout(500)

  await expect(dialog(page)).toHaveCount(0)
})

test('the dialog opens once a slow chunk arrives when the user waits', async ({ page }) => {
  const gate = await open(page)
  await chooseReorder(page)
  await expect(dialog(page)).toHaveCount(0)
  gate.release()

  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  await expect(trigger(page)).toBeFocused()
})

test('a chunk that fails to load leaves the switcher working and says so', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const gate = await open(page)
  await trigger(page).click()
  await expect.poll(gate.requests).toBeGreaterThan(0)
  gate.fail()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  await trigger(page).click()
  const item = page.getByRole('menuitem', { name: /Couldn.t load reordering/ })
  await expect(item).toBeVisible()
  await expect(item).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')
  // Choosing a workspace still works.
  await trigger(page).click()
  await page.getByRole('menuitemradio', { name: 'cortana' }).click()
  await expect(trigger(page)).toHaveAccessibleName(/cortana/)
  expect(errors).toEqual([])
})

test('a failing chunk chosen while it is loading does not crash the page', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const gate = await open(page)
  await chooseReorder(page)
  await expect.poll(gate.requests).toBeGreaterThan(0)
  gate.fail()
  await page.waitForTimeout(500)

  await expect(dialog(page)).toHaveCount(0)
  await expect(trigger(page)).toBeVisible()
  await trigger(page).click()
  await expect(page.getByRole('menuitem', { name: /Couldn.t load reordering/ })).toBeVisible()
  expect(errors).toEqual([])
})
