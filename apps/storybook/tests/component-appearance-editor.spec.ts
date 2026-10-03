import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  buildAppearanceBrowser,
  renderAppearanceServer,
  startAppearanceFontAssetServer,
} from './appearance-assets'
import { fontSettingsBootstrapScript } from '../../../packages/ui/src/lib/appearance-font-settings'

let script: string
let css: string
let fontAssetServer: Awaited<ReturnType<typeof startAppearanceFontAssetServer>> | undefined

function normalizeFamilyList(value: string) {
  return value
    .replace(/["']/g, '')
    .split(',')
    .map((familyName) => familyName.trim())
    .join(',')
}

type ElementGeometry = {
  top: number
  bottom: number
  left: number
  right: number
  height: number
  width: number
  fontSize: number
  lineHeight: number
  textTop: number
  textBottom: number
  contentWidth: number
  contentHeight: number
  valueWidth: number | undefined
}

function measureAppearanceElement(target: HTMLElement): ElementGeometry {
  const bounds = target.getBoundingClientRect()
  const style = getComputedStyle(target)
  const range = document.createRange()
  range.selectNodeContents(target)
  const text = range.getBoundingClientRect()
  const valueWidth =
    target instanceof HTMLInputElement
      ? (() => {
          const context = document.createElement('canvas').getContext('2d')
          if (!context) throw new Error('Canvas text measurement is unavailable')
          context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
          return context.measureText(target.value).width
        })()
      : undefined
  return {
    top: bounds.top,
    bottom: bounds.bottom,
    left: bounds.left,
    right: bounds.right,
    height: bounds.height,
    width: bounds.width,
    fontSize: Number.parseFloat(style.fontSize),
    lineHeight: Number.parseFloat(style.lineHeight),
    textTop: text.top,
    textBottom: text.bottom,
    contentWidth:
      bounds.width -
      Number.parseFloat(style.borderLeftWidth) -
      Number.parseFloat(style.borderRightWidth) -
      Number.parseFloat(style.paddingLeft) -
      Number.parseFloat(style.paddingRight) -
      20,
    contentHeight:
      bounds.height -
      Number.parseFloat(style.borderTopWidth) -
      Number.parseFloat(style.borderBottomWidth) -
      Number.parseFloat(style.paddingTop) -
      Number.parseFloat(style.paddingBottom),
    valueWidth,
  }
}

function rectanglesOverlap(first: ElementGeometry, second: ElementGeometry) {
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  )
}

function hasOverlappingRectangles(rectangles: readonly ElementGeometry[]) {
  return rectangles.some((first, index) =>
    rectangles.slice(index + 1).some((second) => rectanglesOverlap(first, second))
  )
}

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
    // WebKit in the packed-solid lane measured mid font-swap: the fallback
    // face's wider text shoves the wrapped description below the floor the
    // settled layout clears. The assertion is about the layout, so measure
    // after the faces the stylesheet declares have landed.
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
    })
    const rem = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).fontSize)
    )
    await expect
      .poll(() => description.evaluate((element) => element.getBoundingClientRect().width))
      .toBeGreaterThanOrEqual(10 * rem)
    const choices = section.getByRole('radiogroup', { name: 'Accent', exact: true })
    for (const option of await choices.locator('label').all()) {
      const box = await option.boundingBox()
      const panel = await dialog.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(panel!.x)
      expect(box!.x + box!.width).toBeLessThanOrEqual(panel!.x + panel!.width + 1)
    }
    await choices.locator('label').filter({ hasText: 'Custom' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Custom accent' })).toBeVisible()
  })
}

test('the composed editor server-renders without a browser or application globals', async () => {
  const html = await renderAppearanceServer()
  expect(html).toContain('data-appearance-editor')
  expect(html).toContain('Appearance mode')
  expect(html).toContain('Light theme')
  expect(html).toContain('Dark theme')
  expect(html).toContain('Terminal')
  expect(html).toContain("Uses the palette's intended color.")
})

test.beforeAll(async () => {
  ;({ script, css } = await buildAppearanceBrowser())
  fontAssetServer = await startAppearanceFontAssetServer()
})

test.afterAll(async () => {
  await fontAssetServer?.close()
})

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.startsWith('System avoids font requests')) return
  const inlineEditor = testInfo.title.includes('inline AppearanceEditor')
  await page.setContent(
    `<!doctype html><html lang="en"${inlineEditor ? ' data-appearance-fixture="inline"' : ''}><head><title>Appearance fixture</title></head><body></body></html>`
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  if (!inlineEditor) await page.getByRole('button', { name: 'Appearance settings' }).click()
})

test('System avoids font requests and the selected catalogue face loads only its local asset', async ({
  page,
}) => {
  test.setTimeout(25_000)
  if (!fontAssetServer) throw new Error('Font asset server was not started')
  const assetServer = fontAssetServer
  const fontRequests: string[] = []
  const fontResponses: Array<{ url: string; status: number }> = []
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fontRequests.push(request.url())
  })
  page.on('response', (response) => {
    if (response.request().resourceType() === 'font') {
      fontResponses.push({ url: response.url(), status: response.status() })
    }
  })

  await page.setViewportSize({ width: 1280, height: 844 })
  await page.goto(assetServer.url)
  // The host runs the shared bootstrap before its theme stylesheet so the
  // default System preference wins the first style calculation, including in
  // engines that start a web-font request before client hydration.
  await page.addScriptTag({ content: fontSettingsBootstrapScript('appearance') })
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  await page.getByRole('button', { name: 'Appearance settings' }).click()
  await page.evaluate(() => document.fonts.ready)
  expect(fontRequests).toEqual([])
  await expect(page.locator('html')).not.toHaveAttribute('data-ui-font')

  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true })
  const family = dialog.getByRole('button', { name: 'UI font family', exact: true })
  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await family.scrollIntoViewIfNeeded()
  await family.click()
  await expect(family).toHaveAttribute('aria-expanded', 'true')
  const spaceGrotesk = page.getByRole('menuitemradio', { name: 'Space Grotesk', exact: true })
  await expect(spaceGrotesk).toBeVisible()
  await spaceGrotesk.click()
  await expect(family).toBeFocused()
  await expect(page.locator('html')).toHaveAttribute('data-ui-font', 'space-grotesk')
  await expect.poll(() => fontResponses.length).toBeGreaterThan(0)
  expect(fontRequests.length).toBeGreaterThan(0)
  const loadedFaces = await page.evaluate(
    async () =>
      (await document.fonts.load('14px "Space Grotesk Variable"', 'Adea local font sample 123'))
        .length
  )
  expect(loadedFaces).toBeGreaterThan(0)
  expect(
    await page.evaluate(() =>
      document.fonts.check('14px "Space Grotesk Variable"', 'Adea local font sample 123')
    )
  ).toBe(true)
  expect(fontRequests.every((url) => new URL(url).origin === new URL(assetServer.url).origin)).toBe(
    true
  )
  expect(fontRequests.every((url) => /\.woff2?(?:\?|$)/.test(new URL(url).pathname))).toBe(true)
  expect(fontResponses).toEqual(fontRequests.map((url) => ({ url, status: 200 })))

  const loadedRequestCount = fontRequests.length
  await family.click()
  await page.getByRole('menuitemradio', { name: 'System', exact: true }).click()
  await expect(family).toBeFocused()
  await expect(page.locator('html')).not.toHaveAttribute('data-ui-font')
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
  })
  expect(fontRequests).toHaveLength(loadedRequestCount)

  await family.click()
  await expect(family).toHaveAttribute('aria-expanded', 'true')
  const size = dialog.getByRole('spinbutton', { name: 'UI font size in pixels', exact: true })
  await size.focus()
  await expect(family).toHaveAttribute('aria-expanded', 'false')
  await expect(size).toBeFocused()
})

test('font settings host imports resolve through the public package subpath', async ({ page }) => {
  await expect(page.locator('[data-font-settings-api]')).toHaveText('14/14/12;true')
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
      rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    }
  })
  expect(menuStyle.background).not.toBe('rgba(0, 0, 0, 0)')
  expect(menuStyle.overflowX).toBe('hidden')
  // The menu may grow with its content (long theme names render in full) but
  // never narrower than its trigger: the dark theme row's `sm:w-52` button.
  // The content's `duration-200` leaves transition-property at its `all`
  // initial value, so the anchor-width floor interpolates for 200ms after
  // opening — assert the settled contract, never a mid-transition frame.
  await expect
    .poll(() => menu.evaluate((element) => Number.parseFloat(getComputedStyle(element).minWidth)))
    .toBeCloseTo(menuStyle.rem * 13, 1)
  await page.keyboard.press('Escape')
  await page
    .getByRole('radiogroup', { name: 'Accent', exact: true })
    .locator('label')
    .filter({ hasText: 'Custom' })
    .click()
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

test('font controls remain keyboard accessible and all text roles scale at 200%', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })

  const metrics = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('[data-testid="content-font-preview"]')
    const code = document.querySelector<HTMLElement>('[data-testid="code-font-preview"]')
    if (!content || !code) throw new Error('Missing content or code font preview')
    return {
      root: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      body: Number.parseFloat(getComputedStyle(document.body).fontSize),
      content: Number.parseFloat(getComputedStyle(content).fontSize),
      code: Number.parseFloat(getComputedStyle(code).fontSize),
    }
  })
  expect(metrics.root).toBe(32)
  expect(metrics.body).toBe(28)
  expect(metrics.content).toBe(28)
  expect(metrics.code).toBe(24)

  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true })
  const family = dialog.getByRole('button', { name: 'UI font family', exact: true })
  const size = dialog.getByRole('spinbutton', { name: 'UI font size in pixels', exact: true })
  await expect(family).toContainText('System')
  await expect(size).toHaveValue('14')
  await expect(dialog.getByRole('button', { name: 'Content font family' })).toContainText('System')
  await expect(dialog.getByRole('spinbutton', { name: 'Content font size in pixels' })).toHaveValue(
    '14'
  )
  await expect(dialog.getByRole('button', { name: 'Code font family' })).toContainText('System')
  await expect(dialog.getByRole('spinbutton', { name: 'Code font size in pixels' })).toHaveValue(
    '12'
  )
  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await family.scrollIntoViewIfNeeded()
  await family.focus()
  const captureScrollState = () =>
    family.evaluate((trigger) => {
      if (!(trigger instanceof HTMLElement)) {
        throw new Error('Font family trigger is not an HTML element')
      }
      const state = []
      for (let element: HTMLElement | null = trigger; element; element = element.parentElement) {
        const computed = getComputedStyle(element)
        const declarations = ['overflow', 'overflow-x', 'overflow-y'] as const
        const overflow = `${computed.overflow} ${computed.overflowX} ${computed.overflowY}`
        if (element === document.scrollingElement || /(auto|scroll)/.test(overflow)) {
          state.push({
            tag: element.tagName,
            id: element.id,
            className: element.className,
            scrollTop: element.scrollTop,
            scrollLeft: element.scrollLeft,
            computedOverflow: [computed.overflow, computed.overflowX, computed.overflowY],
            declarations: declarations.map((property) => [
              property,
              element.style.getPropertyValue(property),
              element.style.getPropertyPriority(property),
            ]),
          })
        }
      }
      return state
    })
  const scrollStateBeforeOpen = await captureScrollState()
  expect(scrollStateBeforeOpen.some((entry) => entry.scrollTop > 0)).toBe(true)
  await page.keyboard.press('Enter')
  const menu = dialog.getByRole('menu')
  await expect(menu).toBeVisible()
  expect(await captureScrollState()).toEqual(scrollStateBeforeOpen)
  await page.keyboard.press('Escape')
  await expect(family).toBeFocused()
  expect(await captureScrollState()).toEqual(scrollStateBeforeOpen)

  await page.keyboard.press('Enter')
  await expect(menu).toBeVisible()
  const choices = menu.getByRole('menuitemradio')
  await expect(choices).toHaveCount(5)
  await expect(choices.first()).toHaveText('System')
  await expect(choices.first()).toHaveAttribute('aria-checked', 'true')
  await expect(menu.getByRole('separator')).toHaveCount(1)
  const labels = (await choices.allTextContents()).map((label) => label.trim())
  expect(labels).toEqual(['System', 'Space Grotesk', 'Geist', 'Geist Mono', 'JetBrains Mono'])

  const geistMono = menu.getByRole('menuitemradio', { name: 'Geist Mono', exact: true })
  await geistMono.focus()
  await page.keyboard.press('Enter')
  await expect(family).toContainText('Geist Mono')
  await expect(family).toHaveAttribute('aria-expanded', 'false')
  await expect(family).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(family).toHaveAttribute('aria-expanded', 'false')
  await expect(size).toBeFocused()

  await size.fill('100')
  await expect(size).toHaveAttribute('aria-invalid', 'true')
  await page.keyboard.press('Enter')
  await expect(size).toHaveValue('32')
  await expect(size).toHaveAttribute('aria-invalid', 'false')
  const draft = page.getByLabel('Draft preference')
  await expect(draft).toContainText('"ui":{"family":"geist-mono","size":32}')
  await expect(draft).toContainText('"content":{"family":"system","size":14}')
  await expect(draft).toContainText('"code":{"family":"system","size":12}')

  for (const axis of ['UI', 'Content', 'Code']) {
    const control = dialog.getByRole('spinbutton', { name: `${axis} font size in pixels` })
    const bounds = await control.boundingBox()
    const panel = await dialog.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(panel!.x)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(panel!.x + panel!.width + 1)
  }
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(
    accessibility.violations.filter((finding) =>
      ['serious', 'critical'].includes(finding.impact ?? '')
    )
  ).toEqual([])
})

test('Code font labels apply their exact catalogue family', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true })
  const family = dialog.getByRole('button', { name: 'Code font family', exact: true })
  const code = page.locator('[data-testid="code-font-preview"]')

  for (const option of [
    { id: 'space-grotesk', label: 'Space Grotesk' },
    { id: 'geist', label: 'Geist' },
  ]) {
    await family.scrollIntoViewIfNeeded()
    await family.click()
    const menu = dialog.getByRole('menu')
    await expect(menu).toBeVisible()
    await menu.getByRole('menuitemradio', { name: option.label, exact: true }).click()

    await expect(family).toContainText(option.label)
    await expect(page.locator('html')).toHaveAttribute('data-code-font', option.id)
    const [actualFamily, selectedToken, selectedFamily] = await Promise.all([
      code.evaluate((element) => getComputedStyle(element).fontFamily),
      page.locator('html').evaluate((root) => root.style.getPropertyValue('--font-code').trim()),
      page.locator('html').evaluate((root, id) => {
        return getComputedStyle(root).getPropertyValue(`--font-family-${id}`).trim()
      }, option.id),
    ])
    expect(selectedToken).toBe(`var(--font-family-${option.id})`)
    expect(normalizeFamilyList(actualFamily)).toBe(normalizeFamilyList(selectedFamily))
  }
})

test('maximum UI font sizes keep font controls and editor actions within their geometry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '16px'
  })

  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true })
  const uiSize = dialog.getByRole('spinbutton', { name: 'UI font size in pixels', exact: true })

  for (const size of [28, 32]) {
    await uiSize.fill(String(size))
    await page.keyboard.press('Enter')
    await expect(uiSize).toHaveValue(String(size))

    const family = dialog.getByRole('button', { name: 'UI font family', exact: true })
    const input = dialog.getByRole('spinbutton', { name: 'UI font size in pixels', exact: true })
    const unit = input.locator('xpath=..').getByText('px', { exact: true })
    const actionLabels = ['Reset', 'Cancel', 'Save']
    const [rootFontSize, familyGeometry, inputGeometry, unitGeometry, actions] = await Promise.all([
      page.locator('html').evaluate((root) => Number.parseFloat(getComputedStyle(root).fontSize)),
      family.evaluate(measureAppearanceElement),
      input.evaluate(measureAppearanceElement),
      unit.evaluate(measureAppearanceElement),
      Promise.all(
        actionLabels.map((label) =>
          dialog
            .getByRole('button', { name: label, exact: true })
            .evaluate(measureAppearanceElement)
        )
      ),
    ])
    const controls = [familyGeometry, inputGeometry, unitGeometry]
    const geometry = {
      rootFontSize,
      family: familyGeometry,
      input: inputGeometry,
      unit: unitGeometry,
      controlsOverlap: hasOverlappingRectangles(controls),
      actionsOverlap: hasOverlappingRectangles(actions),
      actions,
    }
    console.log(JSON.stringify({ maximumUiFontGeometry: { size, ...geometry } }))

    expect(geometry.rootFontSize).toBe(16)
    expect(geometry.family.height + 1).toBeGreaterThanOrEqual(geometry.family.lineHeight)
    expect(geometry.input.contentHeight + 1).toBeGreaterThanOrEqual(geometry.input.lineHeight)
    expect(geometry.input.contentWidth + 1).toBeGreaterThanOrEqual(geometry.input.valueWidth ?? 0)
    expect(geometry.unit.height + 1).toBeGreaterThanOrEqual(geometry.unit.lineHeight)
    expect(geometry.actions.every((action) => action.height + 1 >= action.lineHeight)).toBe(true)
    expect(geometry.controlsOverlap).toBe(false)
    expect(geometry.actionsOverlap).toBe(false)
  }
})

test('the terminal row follows the interface theme and offers the full catalogue', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Terminal', exact: true })
  await expect(trigger).toBeVisible()
  await trigger.click()
  const menu = page.getByRole('menu')
  const options = menu.getByRole('menuitemradio')
  // The UI-theme default plus every catalogue record — both appearances,
  // because the terminal paints one fixed palette rather than a light/dark axis.
  await expect(options).toHaveCount(15)
  await expect(menu.getByRole('menuitemradio', { name: 'UI theme', exact: true })).toBeVisible()
  // Each option carries a compact theme preview and a one-line description;
  // the description stays visual so the accessible name is just the theme.
  await expect(menu.locator('[data-theme-menu-preview]')).toHaveCount(15)
  await expect(menu.getByText('Uses the interface theme.', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
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

test('the primary accent grid stays six-choice while additional and theme accents remain separate', async ({
  page,
}) => {
  const accent = page.getByRole('radiogroup', { name: 'Accent', exact: true })
  const primary = accent.locator('[data-primary-accent-grid]')
  const ids = await primary
    .locator('[data-primary-accent]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-primary-accent'))
    )
  expect(ids).toEqual(['theme', 'blue', 'green', 'amber', 'cyan', 'pink'])
  await expect(primary.getByRole('radio')).toHaveCount(6)
  await expect(primary.getByRole('radio', { name: 'Theme default' })).toBeChecked()
  await expect(accent.getByText('Additional colors', { exact: true })).toBeVisible()
  await expect(accent.locator('[data-additional-accent="violet"]')).toBeVisible()
  await expect(accent.getByText('Theme accents', { exact: true })).toBeVisible()
  await expect(accent.locator('[data-theme-accent]')).toHaveCount(4)

  const blue = primary.getByRole('radio', { name: 'Blue', exact: true })
  await blue.focus()
  await page.keyboard.press('Space')
  await expect(blue).toBeChecked()
  await expect(page.getByLabel('Draft preference')).toContainText('"accent":"blue"')
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
  await page
    .getByRole('radiogroup', { name: 'Accent', exact: true })
    .locator('label')
    .filter({ hasText: 'Custom' })
    .click()
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
  const family = page.getByRole('button', { name: 'UI font family', exact: true })
  await expect(family).toBeDisabled()

  // Dispatch on the disabled element directly so this exercises the shared
  // trigger adapter even though real pointer/keyboard input cannot target a
  // native disabled button.
  await family.evaluate((button) => {
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
  })
  await expect(page.getByRole('dialog').getByRole('menu')).toHaveCount(0)
})

test('a pending save disables theme choices when the menu is already open', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /^Dark theme/ })
  await trigger.click()
  const menu = page.getByRole('menu')
  const themes = menu.getByRole('menuitemradio')
  await expect(themes).toHaveCount(9)

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
  await expect(themes).toHaveCount(9)
  await expect(menu).toBeFocused()
  await expect(menu.getByRole('menuitemradio', { checked: true })).toBeVisible()
  await page.keyboard.press('Home')
  await expect(themes.nth(0)).toBeFocused()
  await page.keyboard.press('End')
  await expect(themes.nth(8)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(themes.nth(7)).toBeFocused()
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
    // Tab walks DOM order: the terminal row sits between the theme rows and
    // the accent choices, so it is the stop after the dark theme trigger.
    await expect(dialog.getByRole('button', { name: 'Terminal', exact: true })).toBeFocused()

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
  await expect(page.getByRole('button', { name: 'Terminal', exact: true })).toBeFocused()
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

test('theme menus scroll inside a fixed cap and the accent row starts at the theme default', async ({
  page,
}) => {
  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true })

  await dialog.getByRole('button', { name: 'Dark theme', exact: true }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()

  // The cap is fixed, not the popper's measured available height: an adaptive
  // menu made the host sidebar scroll to reveal it. The menu owns the overflow
  // instead — five visible rows, the rest one wheel away.
  await expect(menu).toHaveCSS('max-height', '320px')
  expect(await menu.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)

  const checked = menu.getByRole('menuitemradio', { checked: true })
  await expect(checked).toBeVisible()
  // The selected row's indicator reads in the accent, like every other
  // selected state — the component default, not a caller's styling.
  await expect(checked.locator('[data-slot="dropdown-menu-indicator"]')).toHaveClass(/text-primary/)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  const accentGroup = dialog.getByRole('radiogroup', { name: 'Accent', exact: true })
  const themeDefault = accentGroup.getByRole('radio', { name: 'Theme default' })
  await expect(themeDefault).toBeChecked()
  // The theme's own accent is the first swatch — the old dedicated chip is
  // folded into the grid rather than sitting beside it as a second control.
  expect(await accentGroup.getByRole('radio').first().getAttribute('value')).toBe('theme')
})

test('the accents the theme pair carries are offered after the presets and preview live', async ({
  page,
}) => {
  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true })
  const accentGroup = dialog.getByRole('radiogroup', { name: 'Accent', exact: true })
  const themeAccents = accentGroup.locator('[data-theme-accent]')
  // Adea's pair offers its own blue, magenta, cyan and green through
  // `themeAccentPresets`; they follow the six presets in the swatch grid.
  await expect(themeAccents).toHaveCount(4)
  const values = await accentGroup
    .getByRole('radio')
    .evaluateAll((radios) => radios.map((radio) => radio.getAttribute('value')))
  expect(values.indexOf('ansi-blue')).toBeGreaterThan(values.indexOf('pink'))

  const before = await page
    .locator('[data-live-preview]')
    .evaluate((element) => getComputedStyle(element).color)
  await accentGroup.locator('[data-theme-accent="ansi-blue"] label').click()
  await expect(accentGroup.getByRole('radio', { name: 'Theme blue' })).toBeChecked()
  await expect(page.getByLabel('Draft preference')).toContainText('"accent":"ansi-blue"')
  // A theme accent is a known choice, never the custom field.
  await expect(dialog.getByRole('textbox', { name: 'Custom accent' })).toHaveCount(0)
  await expect(dialog.getByText(/^Theme blue · /)).toBeVisible()
  await expect
    .poll(() =>
      page.locator('[data-live-preview]').evaluate((element) => getComputedStyle(element).color)
    )
    .not.toBe(before)
})
