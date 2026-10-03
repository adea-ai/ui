import { expect, test } from '@playwright/test'
import { buildAppearanceFontControlsBrowser } from './appearance-assets'

let script: string
let css: string

function measureControl(target: HTMLElement) {
  const bounds = target.getBoundingClientRect()
  const style = getComputedStyle(target)
  const contentHeight =
    bounds.height -
    Number.parseFloat(style.borderTopWidth) -
    Number.parseFloat(style.borderBottomWidth) -
    Number.parseFloat(style.paddingTop) -
    Number.parseFloat(style.paddingBottom)
  const range = document.createRange()
  range.selectNodeContents(target)
  return {
    height: bounds.height,
    width: bounds.width,
    contentHeight,
    lineHeight: Number.parseFloat(style.lineHeight),
    textHeight: range.getBoundingClientRect().height,
    fontSize: Number.parseFloat(style.fontSize),
    inputValue: target instanceof HTMLInputElement ? target.value : undefined,
  }
}

test.beforeAll(async () => {
  ;({ script, css } = await buildAppearanceFontControlsBrowser())
})

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><html lang="en"><head></head><body></body></html>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('shared Button and Input controls fit maximum UI font sizes outside Appearance', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '16px'
  })

  for (const size of [28, 32]) {
    await page.evaluate((value) => {
      const fixtureWindow = window as Window & {
        setAppearanceFontSize?: (fontSize: number) => void
      }
      if (!fixtureWindow.setAppearanceFontSize)
        throw new Error('The shared font-settings fixture is not loaded')
      fixtureWindow.setAppearanceFontSize(value)
    }, size)
    await expect(page.locator('html')).toHaveAttribute('data-font-settings', '')

    const wrapper = page.locator('[aria-label="Shared controls outside Appearance"]')
    await expect(wrapper).toBeVisible()
    expect(
      await wrapper.evaluate((element) => element.closest('[data-appearance-editor]'))
    ).toBeNull()
    const buttonSm = wrapper.locator('[data-testid="global-font-button-sm"]')
    const buttonMd = wrapper.locator('[data-testid="global-font-button-md"]')
    const input = wrapper.getByRole('textbox', { name: 'Global font preference field' })
    const [rootSettings, buttonSmGeometry, buttonMdGeometry, inputGeometry] = await Promise.all([
      page.locator('html').evaluate((root) => ({
        rootFontSize: Number.parseFloat(getComputedStyle(root).fontSize),
        uiScale: Number.parseFloat(getComputedStyle(root).getPropertyValue('--font-ui-scale')),
      })),
      buttonSm.evaluate(measureControl),
      buttonMd.evaluate(measureControl),
      input.evaluate(measureControl),
    ])
    const controls = {
      ...rootSettings,
      buttonSm: buttonSmGeometry,
      buttonMd: buttonMdGeometry,
      input: inputGeometry,
      inputValue: inputGeometry.inputValue,
    }
    console.log(JSON.stringify({ globalFontControlGeometry: { size, ...controls } }))

    expect(controls.rootFontSize).toBe(16)
    expect(controls.uiScale).toBe(size / 14)
    expect(controls.inputValue).toBe('Sample preference')
    expect(controls.input.width).toBeGreaterThan(100)
    for (const control of [controls.buttonSm, controls.buttonMd, controls.input]) {
      expect(control.fontSize).toBeGreaterThan(20)
      expect(control.contentHeight + 1).toBeGreaterThanOrEqual(control.lineHeight)
      expect(control.contentHeight + 1).toBeGreaterThanOrEqual(control.textHeight)
    }
  }
})
