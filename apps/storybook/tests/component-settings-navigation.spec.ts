import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { buildSettingsNavigationBrowser } from './settings-navigation-assets'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await buildSettingsNavigationBrowser())
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Settings navigation</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('named groups keep controlled tabs related to their panels and support vertical keys', async ({
  page,
}) => {
  const list = page.getByRole('tablist', { name: 'Settings sections', exact: true })
  const account = list.getByRole('tab', { name: 'Account', exact: true })
  const appearance = list.getByRole('tab', { name: 'Appearance', exact: true })
  const diagnostics = list.getByRole('tab', { name: 'Diagnostics and recovery', exact: true })

  await expect(page.locator(`#${await account.getAttribute('aria-describedby')}`)).toHaveText(
    'Workspace preferences'
  )
  await expect(page.locator(`#${await diagnostics.getAttribute('aria-describedby')}`)).toHaveText(
    'Access and privacy'
  )
  await expect(account).toHaveAttribute('aria-selected', 'true')
  const accountId = await account.getAttribute('id')
  const accountPanelId = await account.getAttribute('aria-controls')
  expect(accountId).toBeTruthy()
  expect(accountPanelId).toBe('settings-panel-account')
  await expect(page.locator(`#${accountPanelId}`)).toHaveAttribute('aria-labelledby', accountId!)

  const accountTriggerIds = await page
    .locator('[role="tab"][data-key="account"]')
    .evaluateAll((triggers) => triggers.map((trigger) => trigger.id))
  expect(accountTriggerIds).toHaveLength(2)
  expect(new Set(accountTriggerIds).size).toBe(2)
  await expect(page.locator('#independent-account-panel')).toHaveAttribute(
    'aria-labelledby',
    accountTriggerIds[1]!
  )
  await expect(page.locator('#custom-tabs-trigger')).toHaveAttribute('id', 'custom-tabs-trigger')
  await expect(page.locator('#custom-tabs-panel')).toHaveAttribute(
    'aria-labelledby',
    'custom-panel-label'
  )
  await expect(page.locator('#custom-mapped-panel')).toHaveAttribute(
    'aria-labelledby',
    'custom-mapped-trigger'
  )

  await account.focus()
  await page.keyboard.press('ArrowDown')
  await expect(appearance).toBeFocused()
  await expect(appearance).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Selected section', { exact: true })).toHaveText('appearance')
  await expect(page.locator('#settings-panel-appearance')).toHaveAttribute(
    'aria-labelledby',
    (await appearance.getAttribute('id'))!
  )

  await page.keyboard.press('End')
  await expect(diagnostics).toBeFocused()
  await expect(diagnostics).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Home')
  await expect(account).toBeFocused()
  await expect(account).toHaveAttribute('aria-selected', 'true')

  await account.click()
  await expect(page.getByLabel('Reselected section', { exact: true })).toHaveText('account')
  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(
    accessibility.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    )
  ).toEqual([])
})

test('selected rows reveal inside the list at narrow and 200 percent layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })

  const list = page.getByRole('tablist', { name: 'Settings sections', exact: true })
  const diagnostics = list.getByRole('tab', { name: 'Diagnostics and recovery', exact: true })
  await page.getByRole('button', { name: 'Select diagnostics', exact: true }).click()
  await expect(diagnostics).toHaveAttribute('aria-selected', 'true')
  await expect
    .poll(() =>
      diagnostics.evaluate((element) => {
        const tablist = element.closest('[role="tablist"]')
        if (!tablist) return false
        const target = element.getBoundingClientRect()
        const viewport = tablist.getBoundingClientRect()
        return target.top >= viewport.top && target.bottom <= viewport.bottom
      })
    )
    .toBe(true)

  const overflow = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    listClientWidth: document.querySelector('[aria-label="Settings sections"]')?.clientWidth ?? 0,
  }))
  const navigationOverflowX = await list.evaluate((tablist) => getComputedStyle(tablist).overflowX)
  expect(overflow.documentScrollWidth, JSON.stringify({ overflow })).toBeLessThanOrEqual(
    overflow.documentClientWidth
  )
  expect(overflow.listClientWidth).toBeGreaterThan(0)
  expect(navigationOverflowX).toBe('hidden')

  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(
    accessibility.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    )
  ).toEqual([])
})

test('a row-forced navigation keeps earlier rows reachable after a reveal pan', async ({
  page,
}) => {
  // A fresh page: this scenario mounts the fixture a second time in a
  // different shape, and the delegated Solid event wiring of the beforeEach
  // mount must not be reused across the re-mount.
  const view = await page.context().newPage()
  try {
    // Mirrors the reported consumer shape (#182): a clipped pane wrapping a
    // scroller, with the grouped list forced into a row at a phone width.
    await view.setViewportSize({ width: 400, height: 700 })
    await view.setContent(
      '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Settings navigation</title></head><body></body></html>'
    )
    await view.evaluate(() => {
      ;(window as { settingsNavFixture?: string }).settingsNavFixture = 'forced-row'
    })
    await view.addStyleTag({ content: css })
    await view.addScriptTag({ content: script })

    const pane = view.locator('#forced-row-pane')
    const scroller = view.locator('#forced-row-scroller')
    const list = view.getByRole('tablist', { name: 'Settings sections', exact: true })
    const diagnostics = list.getByRole('tab', { name: 'Diagnostics and recovery', exact: true })
    const account = list.getByRole('tab', { name: 'Account', exact: true })

    await view.getByRole('button', { name: 'Select diagnostics', exact: true }).click()
    await expect(diagnostics).toHaveAttribute('aria-selected', 'true')
    // The reveal pans the affordance scroller and never the clipped pane: a
    // hidden-overflow ancestor offers no way back, and panning one is what left
    // earlier rows permanently outside the viewport.
    await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
    expect(await pane.evaluate((element) => element.scrollLeft)).toBe(0)

    // Walk back with the keyboard, the path a real user has when the pointer
    // cannot reach a clipped row; every step re-reveals within the scroller.
    await diagnostics.focus()
    for (let step = 0; step < 6; step++) await view.keyboard.press('ArrowUp')
    await expect(account).toHaveAttribute('aria-selected', 'true')
    // Reachable, not necessarily flush: Kobalte's own activation scroll and
    // the reveal both settle nearest, so require the row's start to be inside
    // the scroller's viewport rather than a flush edge alignment.
    await expect
      .poll(async () => {
        const rowBox = await account.boundingBox()
        const scrollBox = await scroller.boundingBox()
        if (!rowBox || !scrollBox) return false
        return (
          rowBox.x >= scrollBox.x - 1 &&
          rowBox.x < scrollBox.x + scrollBox.width &&
          rowBox.x + rowBox.width > scrollBox.x
        )
      })
      .toBe(true)
    expect(await pane.evaluate((element) => element.scrollLeft)).toBe(0)

    // The revealed row is genuinely pointer-reachable without auto-scroll help.
    await account.click()
    await expect(account).toHaveAttribute('aria-selected', 'true')
    expect(await pane.evaluate((element) => element.scrollLeft)).toBe(0)
    const overflow = await view.evaluate(() => ({
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    }))
    expect(overflow.documentScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
      overflow.documentClientWidth
    )
  } finally {
    await view.close()
  }
})
