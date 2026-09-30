import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { buildEntityIconBrowser } from './entity-icon-assets'

let script: string
let css: string

const fixture = `<!doctype html><html lang="en"><head><title>EntityIcon test</title><base href="https://entity.test/"></head><body></body></html>`
const wideSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"></svg>'

test.beforeAll(async () => {
  ;({ script, css } = await buildEntityIconBrowser())
})

test.beforeEach(async ({ page }) => {
  await page.setContent(fixture)
  await page.addStyleTag({ content: css })
})

test('contains a logo without shifting the entity tile while the image loads', async ({ page }) => {
  let releaseResponse!: () => void
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })
  await page.route('https://entity.test/pending.svg', async (route) => {
    await responseGate
    await route.fulfill({ contentType: 'image/svg+xml', body: wideSvg })
  })

  const requestStarted = page.waitForRequest('https://entity.test/pending.svg')
  await page.addScriptTag({ content: script })
  await requestStarted

  const pending = page.getByRole('img', { name: 'Pending Logo' })
  const image = pending.locator('img')
  await expect(image).toHaveAttribute('alt', '')
  await expect(image).toHaveAttribute('aria-hidden', 'true')
  await expect(pending).toContainText('PL')
  const before = await pending.boundingBox()
  expect(before).not.toBeNull()
  expect(before?.width).toBe(48)
  expect(before?.height).toBe(48)

  const small = page.getByRole('img', { name: 'Small Logo' })
  await expect
    .poll(() => small.locator('img').evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBe(64)
  const smallBounds = await small.boundingBox()
  expect(smallBounds?.width).toBe(20)
  expect(smallBounds?.height).toBe(20)

  releaseResponse()
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBe(240)
  await expect
    .poll(() => image.evaluate((element) => getComputedStyle(element).objectFit))
    .toBe('contain')
  const after = await pending.boundingBox()
  expect(after).toEqual(before)

  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  }
})

test('keeps fallback content on image failure and recovers when src changes', async ({ page }) => {
  await page.route('https://entity.test/broken.svg', (route) => route.fulfill({ status: 404 }))
  await page.route('https://entity.test/recovered.svg', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: wideSvg })
  )
  await page.addScriptTag({ content: script })

  const icon = page.getByRole('img', { name: 'Workspace Logo' })
  const initialSize = await icon.boundingBox()
  await expect(icon.locator('img')).toHaveCount(0)
  await expect(icon).toContainText('WL')

  await page.getByRole('button', { name: 'Use replacement logo' }).click()
  const recoveredImage = icon.locator('img')
  await expect(recoveredImage).toHaveAttribute('src', 'https://entity.test/recovered.svg')
  await expect
    .poll(() => recoveredImage.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBe(240)
  await expect(recoveredImage).toHaveAttribute('alt', '')
  await expect(recoveredImage).toHaveAttribute('aria-hidden', 'true')
  expect(await icon.boundingBox()).toEqual(initialSize)
  await expect(icon).toContainText('WL')

  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  }
})
