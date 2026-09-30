import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { buildDownloadBrowser } from './download-assets'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await buildDownloadBrowser())
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Download test</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('downloads the exact Blob payload and filename without moving focus', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Download workspace' })
  await button.focus()
  const downloadPromise = page.waitForEvent('download')
  await button.press('Enter')

  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('workspace.json')
  const path = await download.path()
  expect(path).not.toBeNull()
  expect(await readFile(path!, 'utf8')).toBe('workspace export')
  await expect(button).toBeFocused()
  await expect(page.locator('a[href^="blob:"]')).toHaveCount(0)
})
