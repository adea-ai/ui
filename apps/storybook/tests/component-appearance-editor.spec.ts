import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { buildAppearanceBrowser, renderAppearanceServer } from './appearance-assets'

let script: string
let css: string

for (const fontSize of ['100%', '200%']) {
  test(`appearance labels and swatches reflow inside the popup with ${fontSize} text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 844 })
    await page.evaluate((value) => {
      document.documentElement.style.fontSize = value
    }, fontSize)
    const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true })
    const section = dialog
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Accent', exact: true }) })
    const description = section.getByText("Theme default · Uses the palette's intended color.", {
      exact: true,
    })
    const metrics = await description.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
    }))
    expect(metrics.width).toBeGreaterThanOrEqual(10 * metrics.rem)
    const choices = section.getByRole('radiogroup', { name: 'Accent', exact: true })
    for (const option of await choices.locator('label').all()) {
      const box = await option.boundingBox()
      const panel = await dialog.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(panel!.x)
      expect(box!.x + box!.width).toBeLessThanOrEqual(panel!.x + panel!.width + 1)
    }
    await choices.getByText('Custom', { exact: true }).click()
    await expect(dialog.getByRole('textbox', { name: 'Custom accent' })).toBeVisible()
  })
}

test('the composed editor server-renders without a browser or application globals', async () => {
  const html = await renderAppearanceServer()
  expect(html).toContain('data-appearance-editor')
  expect(html).toContain('Appearance mode')
  expect(html).toContain('Light theme')
  expect(html).toContain('Dark theme')
  expect(html).toContain("Uses the palette's intended color.")
})

test.beforeAll(async () => {
  ;({ script, css } = await buildAppearanceBrowser())
})

test.beforeEach(async ({ page }, testInfo) => {
  const inlineEditor = testInfo.title.includes('inline AppearanceEditor')
  await page.setContent(
    `<!doctype html><html lang="en"${inlineEditor ? ' data-appearance-fixture="inline"' : ''}><head><title>Appearance fixture</title></head><body></body></html>`
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  if (!inlineEditor) await page.getByRole('button', { name: 'Appearance settings' }).click()
})

test('the popup and nested controls retain their shared CSS contract', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Appearance' })
  const background = await dialog.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(background).not.toBe('rgba(0, 0, 0, 0)')
  expect(background).not.toBe('transparent')
  const save = page.getByRole('button', { name: 'Save', exact: true })
  const height = await save.evaluate((element) => {
    const probe = document.createElement('div')
    probe.style.height = 'var(--control-height-sm)'
    element.append(probe)
    const expected = probe.getBoundingClientRect().height
    probe.remove()
    return { actual: element.getBoundingClientRect().height, expected }
  })
  expect(height.expected).toBeGreaterThan(20)
  expect(height.actual).toBeCloseTo(height.expected, 1)
  const toggle = page.getByRole('switch', { name: 'Reduce transparency' })
  // The visible control and thumb come from the shared Switch source, not host CSS.
  expect(
    await toggle.evaluate(
      (element) => element.nextElementSibling?.getBoundingClientRect().height ?? 0
    )
  ).toBeGreaterThan(16)
  await page.getByRole('button', { name: /^Dark theme/ }).click()
  const menu = page.getByRole('menu')
  await expect(dialog.getByRole('menu')).toBeVisible()
  const menuStyle = await menu.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      background: style.backgroundColor,
      overflowX: style.overflowX,
      minWidth: Number.parseFloat(style.minWidth),
      rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    }
  })
  expect(menuStyle.background).not.toBe('rgba(0, 0, 0, 0)')
  expect(menuStyle.overflowX).toBe('hidden')
  expect(menuStyle.minWidth).toBeCloseTo(menuStyle.rem * 8, 1)
  await page.keyboard.press('Escape')
  await page.getByText('Custom', { exact: true }).click()
  const input = await page.getByRole('textbox', { name: 'Custom accent' }).evaluate((element) => {
    const style = getComputedStyle(element)
    const probe = document.createElement('div')
    probe.style.height = 'var(--control-height-md)'
    element.parentElement?.append(probe)
    const expected = probe.getBoundingClientRect().height
    probe.remove()
    return {
      height: element.getBoundingClientRect().height,
      expected,
      border: style.borderTopWidth,
    }
  })
  expect(input.expected).toBeGreaterThan(20)
  expect(input.height).toBeCloseTo(input.expected, 1)
  expect(Number.parseFloat(input.border)).toBeGreaterThan(0)
})

test('the narrow popup keeps its final actions inside the viewport after scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const dialog = page.getByRole('dialog', { name: 'Appearance' })
  const save = page.getByRole('button', { name: 'Save', exact: true })
  // Resizing an open animated popup updates Kobalte geometry on the next frame.
  // Assert the real final viewport boundary, without measuring the old layout.
  let previousBottom: number | undefined
  await expect
    .poll(async () => {
      await dialog.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      const box = await save.boundingBox()
      const bottom = box ? box.y + box.height : Number.POSITIVE_INFINITY
      const stable = previousBottom !== undefined && Math.abs(bottom - previousBottom) < 0.1
      previousBottom = bottom
      return stable ? bottom : Number.POSITIVE_INFINITY
    })
    .toBeLessThanOrEqual(800)
  const box = (await save.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(800)
  await save.click()
  await expect(dialog).toHaveCount(0)
})

test('mode previews and both theme rows remain available through keyboard changes', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: /^Light theme/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toBeVisible()
  await expect(page.locator('[data-mode="system"] [data-theme-miniature]')).toHaveCount(2)
  await expect(
    page.getByRole('radiogroup', { name: 'Appearance mode' }).getByRole('radio')
  ).toHaveCount(3)
  const system = page.getByRole('radio', { name: 'System', exact: true })
  await system.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toBeVisible()
  await expect(page.getByText('Typeface', { exact: true })).toHaveCount(0)
})

test('donor helper copy distinguishes palette defaults and explicit overrides', async ({
  page,
}) => {
  await expect(
    page.getByText("Theme default · Uses the palette's intended color.", { exact: true })
  ).toBeVisible()
  await page.getByRole('radio', { name: 'Blue', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByText('Blue · Controls, glyphs, selections, code, and activity.', { exact: true })
  ).toBeVisible()
  await page.getByText('Opaque', { exact: true }).click()
  await expect(page.getByText('Solid surfaces for every theme.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Light theme/ }).click()
  await expect(
    page.getByRole('menuitemradio', { name: 'Catppuccin Latte', exact: true })
  ).toBeVisible()
})

test('unsaved theme selection updates live miniatures and Cancel restores the snapshot', async ({
  page,
}) => {
  const preview = page.locator('[data-live-preview]')
  const initial = await preview.evaluate((element) => getComputedStyle(element).color)
  await page.getByRole('button', { name: /^Dark theme/ }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  const menuAccessibility = await new AxeBuilder({ page }).analyze()
  expect(
    menuAccessibility.violations.filter((finding) =>
      ['serious', 'critical'].includes(finding.impact ?? '')
    )
  ).toEqual([])
  await page.getByRole('menuitemradio', { name: 'Dracula', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toContainText('Dracula')
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toBeFocused()
  await expect
    .poll(() => preview.evaluate((element) => getComputedStyle(element).color))
    .not.toBe(initial)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect
    .poll(() => preview.evaluate((element) => getComputedStyle(element).color))
    .toBe(initial)
  await expect(page.getByRole('button', { name: 'Appearance settings' })).toBeFocused()
  await page.getByRole('button', { name: 'Appearance settings' }).click()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toContainText('Adea Dark')
})

test('nested theme-menu Escape closes only the menu; a second Escape rolls back', async ({
  page,
}) => {
  await page.getByText('Light', { exact: true }).click()
  const trigger = page.getByRole('button', { name: /^Dark theme/ })
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[role="menu"]')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.getByRole('dialog', { name: 'Appearance' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Appearance' })).toHaveCount(0)
  await expect(page.getByLabel('Draft preference')).toContainText('"mode":"system"')
})

test('custom accent validates before Save and native capabilities remain truthful', async ({
  page,
}) => {
  await page.getByText('Custom', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Custom accent' }).fill('invalid')
  await expect(page.getByRole('textbox', { name: 'Custom accent' })).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect(page.getByRole('radio', { name: 'Frosted', exact: true })).toBeDisabled()
  await expect(
    page.getByText('Transparency is unavailable on this host.', { exact: true })
  ).toBeVisible()
  await page.getByRole('textbox', { name: 'Custom accent' }).fill('#2563eb')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByLabel('Committed preference')).toContainText('#2563eb')
})

test('outside dismissal restores the snapshot and Reset stays reversible', async ({ page }) => {
  await page.getByText('Dark', { exact: true }).click()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked()
  await page.getByText('Dark', { exact: true }).click()
  await page.mouse.click(5, 5)
  await expect(page.getByRole('dialog', { name: 'Appearance' })).toHaveCount(0)
  await expect(page.getByLabel('Draft preference')).toContainText('"mode":"system"')
})

test('a pending save disables changes and duplicate commits', async ({ page }) => {
  await page.evaluate(() => {
    document.body.dataset['pendingSave'] = 'true'
  })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toHaveAttribute(
    'aria-busy',
    'true'
  )
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toBeDisabled()
  await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeDisabled()
  await expect(page.getByRole('switch', { name: 'Reduce transparency' })).toBeDisabled()
})

test('a pending save disables theme choices when the menu is already open', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /^Dark theme/ })
  await trigger.click()
  const menu = page.getByRole('menu')
  const themes = menu.getByRole('menuitemradio')
  await expect(themes).toHaveCount(2)

  await page.evaluate(() => {
    document.body.dataset['pendingSave'] = 'true'
  })
  await page.getByRole('button', { name: 'Save', exact: true }).evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('Save should be a native button')
    button.click()
  })
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  await expect(trigger).toBeDisabled()
  await expect(themes.nth(0)).toBeDisabled()
  await expect(themes.nth(1)).toBeDisabled()
})

test('theme menu radios retain Home/End, arrow, typeahead, and selection behavior', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: /^Dark theme/ })
  await trigger.click()
  const menu = page.getByRole('menu')
  const themes = menu.getByRole('menuitemradio')
  await expect(themes).toHaveCount(2)
  await expect(menu).toBeFocused()
  await expect(menu.getByRole('menuitemradio', { checked: true })).toBeVisible()
  await page.keyboard.press('Home')
  await expect(themes.nth(0)).toBeFocused()
  await page.keyboard.press('End')
  await expect(themes.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(themes.nth(0)).toBeFocused()
  await page.keyboard.press('d')
  await expect(menu.getByRole('menuitemradio', { name: 'Dracula', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(trigger).toContainText('Dracula')
  await expect(trigger).toBeFocused()
  await expect(page.getByLabel('Draft preference')).toContainText('"darkThemeId":"dracula"')
})

test('selecting the current theme closes the menu and restores trigger focus', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /^Dark theme/ })
  await trigger.click()
  const menu = page.getByRole('menu')
  const current = menu.getByRole('menuitemradio', { name: 'Adea Dark', exact: true })
  await expect(current).toHaveAttribute('aria-checked', 'true')
  await current.click()
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(trigger).toContainText('Adea Dark')
})

test('theme menu dismisses when focus moves to another control inside its dialog', async ({
  page,
}) => {
  const dialog = page.getByRole('dialog', { name: 'Appearance' })
  const trigger = page.getByRole('button', { name: /^Dark theme/ })
  await trigger.click()
  const menu = dialog.getByRole('menu')
  await expect(menu).toBeVisible()

  const save = dialog.getByRole('button', { name: 'Save', exact: true })
  await save.focus()
  await expect(menu).toHaveCount(0)
  await expect(save).toBeFocused()
  await expect(dialog).toBeVisible()
})

test('theme menu dismisses on pointer interaction elsewhere in its dialog', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Appearance' })
  const trigger = page.getByRole('button', { name: /^Dark theme/ })
  await trigger.click()
  const menu = dialog.getByRole('menu')
  await expect(menu).toBeVisible()

  await dialog.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(menu).toHaveCount(0)
  await expect(dialog).toBeVisible()
})

test('theme menu restores trigger focus when dismissed by nonfocusable dialog content', async ({
  page,
}) => {
  const dialog = page.getByRole('dialog', { name: 'Appearance' })
  const trigger = dialog.getByRole('button', { name: /^Dark theme/ })
  await trigger.click()
  const menu = dialog.getByRole('menu')
  const firstTheme = menu.getByRole('menuitemradio').first()
  await expect(menu).toBeVisible()
  await expect(menu).toBeFocused()
  await expect(menu.getByRole('menuitemradio', { checked: true })).toBeVisible()
  await page.keyboard.press('Home')
  await expect(firstTheme).toBeFocused()

  await dialog.getByRole('heading', { name: 'Dark theme', exact: true }).click()

  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('theme menu Tab exits to the next or previous control in its dialog', async ({ page }) => {
  await page.evaluate(() => {
    const browserWindow = window as Window & { appearanceFocusTrace?: string[] }
    const trace: string[] = (browserWindow.appearanceFocusTrace = [])
    const record = (kind: string, target: EventTarget | null) => {
      const description =
        target instanceof HTMLElement
          ? [
              target.tagName.toLowerCase(),
              target.getAttribute('role'),
              target.getAttribute('aria-label'),
              target.getAttribute('aria-checked'),
              target.hasAttribute('data-highlighted') ? 'highlighted' : undefined,
              target.textContent?.trim().replace(/\s+/g, ' ').slice(0, 32),
            ]
              .filter(Boolean)
              .join('|')
          : String(target)
      trace.push(`${performance.now().toFixed(1)} ${kind} ${description}`)
    }
    document.addEventListener('focusin', (event) => record('focusin', event.target), true)
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Home' || event.key === 'Tab') {
          record(`keydown ${event.key} target`, event.target)
          record(`keydown ${event.key} active`, document.activeElement)
        }
      },
      true
    )
  })
  const logFocusTrace = async () => {
    const trace = await page.evaluate(
      () => (window as Window & { appearanceFocusTrace?: string[] }).appearanceFocusTrace ?? []
    )
    console.info(`[appearance-focus-lifecycle] ${JSON.stringify(trace)}`)
  }
  try {
    const dialog = page.getByRole('dialog', { name: 'Appearance' })
    const trigger = dialog.getByRole('button', { name: /^Dark theme/ })
    await trigger.click()
    const menu = dialog.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu).toBeFocused()
    await expect(menu.getByRole('menuitemradio', { checked: true })).toBeVisible()
    const firstTheme = menu.getByRole('menuitemradio').first()
    await page.keyboard.press('Home')
    await expect(firstTheme).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(menu).toHaveCount(0)
    await expect(
      dialog
        .getByRole('radiogroup', { name: 'Accent' })
        .getByRole('radio', { name: 'Theme default' })
    ).toBeFocused()

    await trigger.click()
    const previousMenu = dialog.getByRole('menu')
    await expect(previousMenu).toBeVisible()
    await expect(previousMenu).toBeFocused()
    await expect(previousMenu.getByRole('menuitemradio', { checked: true })).toBeVisible()
    await page.keyboard.press('Home')
    await expect(previousMenu.getByRole('menuitemradio').first()).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(previousMenu).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: /^Light theme/ })).toBeFocused()
  } catch (error) {
    await logFocusTrace()
    throw error
  }
})

test('inline AppearanceEditor Tab closes the menu and focuses the next control', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: /^Dark theme/ })
  await trigger.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu).toBeFocused()
  await expect(menu.getByRole('menuitemradio', { checked: true })).toBeVisible()

  await page.keyboard.press('Home')
  await page.keyboard.press('Tab')

  await expect(menu).toHaveCount(0)
  await expect(
    page.getByRole('radiogroup', { name: 'Accent' }).getByRole('radio', { name: 'Theme default' })
  ).toBeFocused()
})

test('inline AppearanceEditor Shift+Tab closes the menu and focuses the previous control', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: /^Dark theme/ })
  await trigger.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu).toBeFocused()
  await expect(menu.getByRole('menuitemradio', { checked: true })).toBeVisible()

  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+Tab')

  await expect(menu).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Light theme/ })).toBeFocused()
})

test('inline AppearanceEditor Tab follows native summaries and skips negative tabindex', async ({
  page,
}) => {
  await page.evaluate(() => {
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Dark theme"]')
    const row = trigger?.closest('section')
    if (!row) throw new Error('The dark theme row should be present')

    const beforeStops = document.createElement('div')
    const before = document.createElement('details')
    const beforeSummary = document.createElement('summary')
    beforeSummary.textContent = 'Details before dark theme'
    before.append(beforeSummary)

    const skippedBefore = document.createElement('details')
    const skippedBeforeSummary = document.createElement('summary')
    skippedBeforeSummary.setAttribute('tabindex', '-1')
    skippedBeforeSummary.textContent = 'Programmatically focusable details before dark theme'
    skippedBefore.append(skippedBeforeSummary)
    beforeStops.append(before, skippedBefore)
    row.before(beforeStops)

    const afterStops = document.createElement('div')
    const after = document.createElement('details')
    const afterSummary = document.createElement('summary')
    afterSummary.textContent = 'Details after dark theme'
    after.append(afterSummary)

    const skippedAfter = document.createElement('details')
    const skippedAfterSummary = document.createElement('summary')
    skippedAfterSummary.setAttribute('tabindex', '-1')
    skippedAfterSummary.textContent = 'Programmatically focusable details after dark theme'
    skippedAfter.append(skippedAfterSummary)
    afterStops.append(skippedAfter, after)
    row.after(afterStops)
  })

  const trigger = page.getByRole('button', { name: /^Dark theme/ })
  const summaries = page.locator('summary')
  await expect(summaries).toHaveCount(4)
  await expect(summaries).toHaveText([
    'Details before dark theme',
    'Programmatically focusable details before dark theme',
    'Programmatically focusable details after dark theme',
    'Details after dark theme',
  ])
  await expect(summaries.nth(0)).not.toHaveAttribute('tabindex', '-1')
  await expect(summaries.nth(1)).toHaveAttribute('tabindex', '-1')
  await expect(summaries.nth(2)).toHaveAttribute('tabindex', '-1')
  await expect(summaries.nth(3)).not.toHaveAttribute('tabindex', '-1')
  await trigger.click()
  const nextMenu = page.getByRole('menu')
  await expect(nextMenu).toBeVisible()
  // Kobalte first hands focus to the menu container; wait for that handoff
  // before sending keyboard navigation.
  await expect(nextMenu).toBeFocused()
  await expect(nextMenu.getByRole('menuitemradio', { checked: true })).toBeVisible()
  await page.keyboard.press('Home')
  await expect(nextMenu.getByRole('menuitemradio').first()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(nextMenu).toHaveCount(0)
  await expect(summaries.nth(3)).toBeFocused()

  await trigger.click()
  const previousMenu = page.getByRole('menu')
  await expect(previousMenu).toBeVisible()
  await expect(previousMenu).toBeFocused()
  await expect(previousMenu.getByRole('menuitemradio', { checked: true })).toBeVisible()
  await page.keyboard.press('Home')
  await expect(previousMenu.getByRole('menuitemradio').first()).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(previousMenu).toHaveCount(0)
  await expect(summaries.first()).toBeFocused()
})

test.describe('narrow theme picker', () => {
  // Fix the viewport before beforeEach opens the popup: selection tests must not
  // race the asynchronous position update of an already-open, resized overlay.
  test.use({ viewport: { width: 320, height: 800 } })

  test('theme options remain visible and selectable in the narrow popup', async ({ page }) => {
    await page.getByRole('button', { name: /^Dark theme/ }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Dracula', exact: true })).toBeVisible()
    await page.getByRole('menuitemradio', { name: 'Dracula', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Dark theme/ })).toContainText('Dracula')
  })
})

for (const width of [320, 768, 1024, 1440]) {
  test(`composed editor at ${width}px has no overflow or serious accessibility violations`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('dialog', { name: 'Appearance' })).toBeVisible()
    const dialog = page.getByRole('dialog', { name: 'Appearance' })
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    )
    const result = await new AxeBuilder({ page }).include('[data-appearance-editor]').analyze()
    expect(
      result.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? '')
      )
    ).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`appearance-${width}.png`) })
  })
}
