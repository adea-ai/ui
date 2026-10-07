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

test('selected rows reveal inside the rail at a wide 200 percent layout', async ({ page }) => {
  // 200 percent of a 1600px window is still 800 CSS pixels: the rail, not the strip.
  await page.setViewportSize({ width: 1600, height: 500 })
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })

  const list = page.getByRole('tablist', { name: 'Settings sections', exact: true })
  await expect(list).toHaveAttribute('aria-orientation', 'vertical')
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
  expect(await list.evaluate((tablist) => getComputedStyle(tablist).overflowX)).toBe('hidden')
})

test('below 48rem the rail becomes a scrollable strip of tabs above the panels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const root = page.locator('#settings-navigation-fixture')
  const list = page.getByRole('tablist', { name: 'Settings sections', exact: true })
  const tabs = list.getByRole('tab')
  const account = list.getByRole('tab', { name: 'Account', exact: true })
  const appearance = list.getByRole('tab', { name: 'Appearance', exact: true })
  const privacy = list.getByRole('tab', { name: 'Privacy', exact: true })
  const diagnostics = list.getByRole('tab', { name: 'Diagnostics and recovery', exact: true })

  await expect(root).toHaveAttribute('data-navigation-layout', 'strip')
  await expect(list).toHaveAttribute('aria-orientation', 'horizontal')
  expect(await list.evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto')

  // Stacked: the strip spans the layout above the panels, not beside them.
  const listBox = (await list.boundingBox())!
  const panelBox = (await page.locator('#settings-panel-account').boundingBox())!
  const rootBox = (await root.boundingBox())!
  expect(listBox.y + listBox.height).toBeLessThanOrEqual(panelBox.y + 1)
  expect(Math.abs(listBox.width - rootBox.width)).toBeLessThanOrEqual(1)

  // One row, groups in source order, every label whole rather than truncated.
  expect(await tabs.allTextContents()).toEqual([
    'Account',
    'Appearance',
    'Workspace defaults',
    'Privacy',
    'Notifications',
    'Diagnostics and recovery',
  ])
  const boxes = await tabs.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      const label = element.querySelector('span:last-child')!
      return { top: box.top, left: box.left, clipped: label.scrollWidth > label.clientWidth }
    })
  )
  expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1)
  expect(boxes.map((box) => box.left)).toEqual(
    boxes.map((box) => box.left).toSorted((a, b) => a - b)
  )
  expect(boxes.some((box) => box.clipped)).toBe(false)
  // Visible group headings drop out; each tab still names its group.
  await expect(
    list.locator('[data-slot="settings-navigation-group"] > [aria-hidden="true"]')
  ).toHaveCount(0)
  await expect(page.locator(`#${await privacy.getAttribute('aria-describedby')}`)).toHaveText(
    'Access and privacy'
  )

  // Horizontal keys follow the visible axis.
  await account.focus()
  await page.keyboard.press('ArrowRight')
  await expect(appearance).toBeFocused()
  await expect(appearance).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(account).toBeFocused()
  await page.keyboard.press('End')
  await expect(diagnostics).toBeFocused()
  await expect(diagnostics).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Selected section', { exact: true })).toHaveText('diagnostics')
  await page.keyboard.press('Home')
  await expect(account).toHaveAttribute('aria-selected', 'true')

  // A host-driven selection scrolls the strip to reveal it, and only the strip.
  await page.getByRole('button', { name: 'Select diagnostics', exact: true }).click()
  await expect(diagnostics).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => list.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  await expect
    .poll(() =>
      diagnostics.evaluate((element) => {
        const target = element.getBoundingClientRect()
        const strip = element.closest('[role="tablist"]')!.getBoundingClientRect()
        return target.left >= strip.left - 1 && target.right <= strip.right + 1
      })
    )
    .toBe(true)

  const overflow = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }))
  expect(overflow.documentScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.documentClientWidth
  )
  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(
    accessibility.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    )
  ).toEqual([])
})

test('crossing the breakpoint switches between rail and strip in place', async ({ page }) => {
  const list = page.getByRole('tablist', { name: 'Settings sections', exact: true })
  const privacy = list.getByRole('tab', { name: 'Privacy', exact: true })
  await privacy.click()
  await expect(list).toHaveAttribute('aria-orientation', 'vertical')

  await page.setViewportSize({ width: 700, height: 800 })
  await expect(list).toHaveAttribute('aria-orientation', 'horizontal')
  // Selection and panel survive the change of axis.
  await expect(privacy).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#settings-panel-privacy')).toBeVisible()

  await page.setViewportSize({ width: 1024, height: 800 })
  await expect(list).toHaveAttribute('aria-orientation', 'vertical')
  await expect(privacy).toHaveAttribute('aria-selected', 'true')
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

test('the vertical settings rail draws no underline rule beneath its last row', async ({
  page,
}) => {
  const rail = page.getByRole('tablist', { name: 'Settings sections', exact: true })
  await expect(rail).toHaveAttribute('data-orientation', 'vertical')
  expect(await rail.evaluate((element) => getComputedStyle(element).borderBottomWidth)).toBe('0px')
  // A horizontal underline list keeps the baseline its triggers sit on.
  const horizontal = page.locator('[role="tablist"][aria-label="Independent tab root"]')
  expect(await horizontal.evaluate((element) => getComputedStyle(element).borderBottomWidth)).toBe(
    '1px'
  )
})

test('a vertical underline list marks its selected trigger with an inline-start bar', async ({
  page,
}) => {
  const edges = (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        orientation: element.getAttribute('data-orientation'),
        bottom: style.borderBottomWidth,
        start: style.borderInlineStartWidth,
        startColor: style.borderInlineStartColor,
        justify: style.justifyContent,
      }
    })
  const primary = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--primary)'
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })

  // The selected vertical trigger carries no bottom underline: the mark is a
  // leading bar in the primary colour, and the label aligns to that edge.
  const vertical = await edges(
    '[role="tablist"][aria-label="Vertical tab root"] [role="tab"][aria-selected="true"]'
  )
  expect(vertical).toEqual({
    orientation: 'vertical',
    bottom: '0px',
    start: '2px',
    startColor: primary,
    justify: 'flex-start',
  })
  // An unselected vertical trigger reserves the bar's width without drawing it.
  const idle = await page
    .locator('[role="tablist"][aria-label="Vertical tab root"] [role="tab"][aria-selected="false"]')
    .evaluate((element) => getComputedStyle(element).borderInlineStartColor)
  expect(idle).toBe('rgba(0, 0, 0, 0)')

  // A horizontal underline trigger keeps its bottom bar on the list's baseline.
  const horizontal = await edges(
    '[role="tablist"][aria-label="Independent tab root"] [role="tab"][aria-selected="true"]'
  )
  expect(horizontal).toMatchObject({ orientation: 'horizontal', bottom: '2px', start: '0px' })

  // SettingsNavigation's filled row replaces the mark entirely: neither bar.
  const rail = await edges(
    '[role="tablist"][aria-label="Settings sections"] [role="tab"][aria-selected="true"]'
  )
  expect(rail).toMatchObject({ orientation: 'vertical', bottom: '0px', start: '0px' })
})
