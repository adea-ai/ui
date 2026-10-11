import { expect, test } from '@playwright/test'
import { buildAppearanceFontControlsBrowser } from './appearance-assets'

let script: string
let css: string

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
        setAppearanceFontSize: (fontSize: number) => void
      }
      fixtureWindow.setAppearanceFontSize(value)
    }, size)
    await expect(page.locator('html')).toHaveAttribute('data-font-settings', '')

    const controls = await page.evaluate(() => {
      const root = document.documentElement
      const wrapper = document.querySelector<HTMLElement>(
        '[aria-label="Shared controls outside Appearance"]'
      )
      if (!wrapper || wrapper.closest('[data-appearance-editor]')) {
        throw new Error('Global controls are missing or inside the Appearance editor')
      }
      const read = (target: HTMLElement) => {
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
        }
      }
      const buttonSm = wrapper.querySelector<HTMLElement>('[data-testid="global-font-button-sm"]')
      const buttonMd = wrapper.querySelector<HTMLElement>('[data-testid="global-font-button-md"]')
      const input = wrapper.querySelector<HTMLInputElement>(
        '[aria-label="Global font preference field"]'
      )
      if (!buttonSm || !buttonMd || !input) throw new Error('A shared global control is missing')
      return {
        rootFontSize: Number.parseFloat(getComputedStyle(root).fontSize),
        uiScale: Number.parseFloat(getComputedStyle(root).getPropertyValue('--font-ui-scale')),
        buttonSm: read(buttonSm),
        buttonMd: read(buttonMd),
        input: read(input),
        inputValue: input.value,
      }
    })
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
