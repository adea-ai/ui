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
  await page.setContent(`<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ActionButton</title>
  </head>
  <body></body>
</html>`)
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
}

test.beforeEach(async ({ page }) => mountFixture(page))

test('comfortable target is opt-in on fine-pointer devices', async ({ page }) => {
  const coarsePointer = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)
  test.skip(coarsePointer, 'the default browser context exposes a coarse pointer')

  const button = page.locator('#touch-target-plain')
  await expect(button).toBeVisible()
  await expect(button).not.toHaveAttribute('touchtarget')
  const bounds = await button.boundingBox()
  expect(bounds?.width).toBe(32)
  expect(bounds?.height).toBe(32)
  expect(await button.locator('svg').evaluate((icon) => icon.getBoundingClientRect().width)).toBe(
    16
  )
})

test('comfortable targets preserve glyphs, keyboard focus and menu return at 320px and 200% text', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 640 },
    hasTouch: true,
    isMobile: true,
  })
  const touchPage = await context.newPage()

  try {
    await mountFixture(touchPage)
    await touchPage.addStyleTag({
      content: 'html { font-size: 200% !important; } body { margin: 0; }',
    })
    await touchPage.evaluate(() => document.documentElement.setAttribute('data-density', 'compact'))
    expect(await touchPage.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(true)

    const targets = [
      '#touch-target-plain',
      '#touch-target-tooltip',
      '#touch-target-polymorphic-tooltip',
      '#touch-target-menu-trigger',
    ]
    for (const selector of targets) {
      const target = touchPage.locator(selector)
      await expect(target).toBeVisible()
      await expect(target).not.toHaveAttribute('touchtarget')
      const bounds = await target.boundingBox()
      expect(bounds?.width, `${selector} width`).toBeGreaterThanOrEqual(96)
      expect(bounds?.height, `${selector} height`).toBeGreaterThanOrEqual(96)
      expect(bounds?.x, `${selector} left edge`).toBeGreaterThanOrEqual(0)
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0), `${selector} right edge`).toBeLessThanOrEqual(
        320
      )
    }

    const plain = touchPage.locator('#touch-target-plain')
    expect(await plain.locator('svg').evaluate((icon) => icon.getBoundingClientRect().width)).toBe(
      32
    )
    await plain.focus()
    await expect(plain).toBeFocused()

    const ordinaryTooltip = touchPage.getByRole('button', { name: 'Tooltip action' })
    await ordinaryTooltip.focus()
    await expect(ordinaryTooltip).toBeFocused()
    await expect(touchPage.getByRole('tooltip')).toHaveText('Open action details')

    const polymorphic = touchPage.getByRole('link', { name: 'Polymorphic tooltip link' })
    await polymorphic.focus()
    await expect(polymorphic).toBeFocused()
    await expect(touchPage.getByRole('tooltip')).toHaveText('Open the linked action details')

    const menuTrigger = touchPage.getByRole('button', { name: 'Open comfortable menu' })
    await menuTrigger.focus()
    await expect(menuTrigger).toBeFocused()
    await touchPage.keyboard.press('Enter')
    const menuItem = touchPage.getByRole('menuitem', { name: 'Open settings' })
    await expect(menuItem).toBeFocused()
    await touchPage.keyboard.press('Escape')
    await expect(menuTrigger).toBeFocused()
    const overflow = await touchPage.evaluate(() =>
      [...document.body.querySelectorAll('*')]
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: typeof element.className === 'string' ? element.className : '',
          right: Math.round(element.getBoundingClientRect().right),
          width: Math.round(element.getBoundingClientRect().width),
          text: element.textContent?.trim().slice(0, 48),
        }))
        .filter((element) => element.right > document.documentElement.clientWidth)
    )
    expect(
      await touchPage.evaluate(() => document.documentElement.scrollWidth),
      JSON.stringify(overflow)
    ).toBeLessThanOrEqual(320)
  } finally {
    await context.close()
  }
})

test('busy state preserves the button name, disables repeat activation and announces progress', async ({
  page,
}) => {
  const button = page.getByRole('button', { name: 'Save workspace' })
  await expect(button).toBeDisabled()
  await expect(button).toHaveAttribute('aria-busy', 'true')
  await expect(
    page.locator('span[role="status"].visually-hidden').filter({ hasText: 'Saving workspace' })
  ).toHaveText('Saving workspace')
  await button.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByLabel('Activations')).toHaveText('0')

  await page.getByRole('button', { name: 'Finish save' }).click()
  await expect(button).toBeEnabled()
  await expect(button).not.toHaveAttribute('aria-busy')
  await expect(
    page.locator('span[role="status"].visually-hidden').filter({ hasText: 'Saving workspace' })
  ).toHaveCount(0)
  await button.click()
  await expect(page.getByLabel('Activations')).toHaveText('1')
})

test('tooltip listens on the polymorphic link and opens from keyboard focus', async ({ page }) => {
  const link = page.getByRole('link', { name: 'Details' })
  await link.focus()
  await expect(link).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Open details')
  await expect(link).toHaveAttribute('aria-describedby', /.+/)
  await link.evaluate((element) => element.blur())
  await expect(page.getByRole('tooltip')).toBeHidden()
  await link.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Open details')
})

test('a controlled tooltip stays closed when its parent rejects open requests', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Rejected tooltip trigger' })
  await expect(page.getByLabel('Active tooltip dismissal listeners')).toHaveText(
    '0 document / 0 window'
  )
  await trigger.focus()
  await expect(trigger).toBeFocused()
  await expect(page.getByLabel('Rejected tooltip requests')).toHaveText('1')
  await expect(trigger).toHaveAttribute('data-closed', '')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(page.getByLabel('Active tooltip dismissal listeners')).toHaveText(
    '0 document / 0 window'
  )

  await trigger.hover()
  await expect(page.getByLabel('Rejected tooltip requests')).toHaveText('2')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(page.getByLabel('Active tooltip dismissal listeners')).toHaveText(
    '0 document / 0 window'
  )
})

test('another tooltip requests one controlled close and leaves acceptance with the parent', async ({
  page,
}) => {
  const source = page.getByRole('button', { name: 'Controlled tooltip handoff source' })
  const sourceTooltip = page.getByRole('tooltip', { name: 'Controlled tooltip help' })
  const target = page.getByRole('button', { name: 'Tooltip handoff target' })
  const targetTooltip = page.getByRole('tooltip', { name: 'Handoff target help' })
  const dismissalListeners = page.getByLabel('Active tooltip dismissal listeners')
  const positioningListeners = page.getByLabel('Active popper positioning listeners')

  await expect(dismissalListeners).toHaveText('0 document / 0 window')
  await expect(positioningListeners).toHaveText('0')
  await source.evaluate((element: HTMLButtonElement) => element.focus({ preventScroll: true }))
  await expect(sourceTooltip).toBeVisible()
  await expect(dismissalListeners).toHaveText(/^[1-9]\d* document \/ [1-9]\d* window$/)
  const sourcePositioningListeners = Number(await positioningListeners.textContent())
  expect(sourcePositioningListeners).toBeGreaterThan(0)

  await target.hover()
  await expect(targetTooltip).toBeVisible()
  const maxPositioningListeners = Number(await positioningListeners.textContent())
  expect(maxPositioningListeners).toBeGreaterThanOrEqual(sourcePositioningListeners)
  // The handoff reaches the controlled parent once. It refuses this close, so
  // the source stays open until the parent changes its controlled value.
  await expect(page.getByLabel('Controlled tooltip close requests')).toHaveText('1')
  await expect(sourceTooltip).toBeVisible()
  await expect(source).toBeFocused()

  await page.getByRole('button', { name: 'Accept tooltip close' }).click()
  await expect(sourceTooltip).toBeHidden()
  await expect(targetTooltip).toBeHidden()
  await expect(dismissalListeners).toHaveText('0 document / 0 window')
  expect(Number(await positioningListeners.textContent())).toBeLessThanOrEqual(
    maxPositioningListeners
  )

  // Repeated opens do not add another positioning listener, and Escape still
  // closes through the parent's controlled state.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await source.evaluate((element: HTMLButtonElement) => element.blur())
    await source.evaluate((element: HTMLButtonElement) => element.focus({ preventScroll: true }))
    await expect(sourceTooltip).toBeVisible()
    expect(Number(await positioningListeners.textContent())).toBeLessThanOrEqual(
      maxPositioningListeners
    )
    await source.press('Escape')
    await expect(sourceTooltip).toBeHidden()
    await expect(dismissalListeners).toHaveText('0 document / 0 window')
    expect(Number(await positioningListeners.textContent())).toBeLessThanOrEqual(
      maxPositioningListeners
    )
  }

  await page.mouse.move(1, 1)
  await page
    .getByRole('button', { name: 'Unmount tooltip handoff fixture' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(source).toHaveCount(0)
  await expect(target).toHaveCount(0)
  await expect(positioningListeners).toHaveText('0')
  await expect(dismissalListeners).toHaveText('0 document / 0 window')
})

test('tooltip dismisses on pointer activation and stays closed over the opened popover', async ({
  page,
}) => {
  const button = page.getByRole('button', { name: 'Open system status' })
  // Click from a fresh pointer position: moving onto the trigger and activating
  // it in one gesture must not leave its delayed tooltip over the new surface.
  await button.click()
  await expect(page.getByRole('dialog', { name: 'System status' })).toBeVisible()
  await expect(page.getByRole('tooltip')).toBeHidden()
  await page.waitForTimeout(1200)
  await expect(page.getByRole('tooltip')).toBeHidden()
})

test('tooltip dismisses on keyboard activation and stays closed while focus remains', async ({
  page,
}) => {
  const button = page.getByRole('button', { name: 'Open system status' })
  await button.focus()
  await expect(page.getByRole('tooltip')).toHaveText('View the current system status')

  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'System status' })).toBeVisible()
  await expect(page.getByRole('tooltip')).toBeHidden()
  await page.waitForTimeout(1200)
  await expect(page.getByRole('tooltip')).toBeHidden()
})

test('busy polymorphic links are inert and keep their caller handler from running', async ({
  page,
}) => {
  const link = page.getByRole('link', { name: 'Export report' })
  await expect(link).toHaveAttribute('aria-disabled', 'true')
  await expect(link).toHaveAttribute('tabindex', '0')
  await expect(link).not.toHaveAttribute('href')
  await expect(page.getByRole('status').filter({ hasText: 'Exporting report' })).toBeVisible()
  await link.focus()
  await expect(link).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Wait for the current export to finish')
  await link.evaluate((element) => element.blur())
  await expect(page.getByRole('tooltip')).toBeHidden()
  await link.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Wait for the current export to finish')
  await link.evaluate((element) =>
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  )
  await expect(page.getByLabel('Activations')).toHaveText('0')
  await expect(page).not.toHaveURL(/busy-link-navigation/)
})

test('disabled actions expose tooltip explanations without becoming activatable', async ({
  page,
}) => {
  const button = page.getByRole('button', { name: 'Delete workspace' })
  await expect(button).toHaveAttribute('aria-disabled', 'true')
  await expect(button).not.toHaveAttribute('disabled')
  await button.focus()
  await expect(button).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText(
    'Ask a workspace owner to restore access before deleting'
  )
  await button.evaluate((element) => element.blur())
  await expect(page.getByRole('tooltip')).toBeHidden()
  await button.hover()
  await expect(page.getByRole('tooltip')).toHaveText(
    'Ask a workspace owner to restore access before deleting'
  )
  await button.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByLabel('Activations')).toHaveText('0')

  const captureButton = page.getByRole('button', { name: 'Archive workspace' })
  await expect(captureButton).toHaveAttribute('aria-disabled', 'true')
  await captureButton.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByLabel('Activations')).toHaveText('0')
})

test('tooltip actions stay in sequential keyboard order and open disabled explanations', async ({
  page,
}) => {
  const start = page.getByRole('textbox', { name: 'Start tooltip button focus order' })
  const available = page.getByRole('button', { name: 'Available action', exact: true })
  const unavailable = page.getByRole('button', { name: 'Unavailable action', exact: true })
  const programmaticOnly = page.getByRole('button', {
    name: 'Programmatic-only action',
    exact: true,
  })

  await expect(available).toHaveAttribute('tabindex', '0')
  await expect(unavailable).toHaveAttribute('tabindex', '0')
  await expect(programmaticOnly).toHaveAttribute('tabindex', '-1')
  await start.focus()
  await page.keyboard.press('Tab')
  await expect(available).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(unavailable).toBeFocused()
  await expect(
    page.getByRole('tooltip', { name: 'Unavailable action help', exact: true })
  ).toHaveText('Unavailable action help')
  await expect(unavailable).toHaveAttribute('aria-describedby', /.+/)
})
