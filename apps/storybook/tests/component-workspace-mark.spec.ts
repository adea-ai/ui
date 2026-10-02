import { contrastRatio, parseColor } from '@adea-ai/themes'
import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

// Engines serialise a computed colour as oklch, oklab or rgb at will; painting
// it resolves every form to the sRGB hex the catalogue measures.
function toHex(color: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d')!
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((value) => value!.toString(16).padStart(2, '0')).join('')}`
}

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('workspace-mark'))
})

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setContent(
        `<!doctype html><html lang="en"${theme === 'dark' ? ' class="dark"' : ''}><head><title>Workspace mark fixture</title></head><body></body></html>`
      )
      await page.addStyleTag({ content: css })
      await page.addScriptTag({ content: script })
    })

    for (const name of ['plugins', 'control-plane']) {
      test(`the ${name} count badge clears the monogram and reads at 4.5:1`, async ({ page }) => {
        const mark = page.getByRole('button', { name, exact: true })
        const badge = mark.locator('[data-slot="workspace-mark-badge"] > *')
        await expect(badge).toBeVisible()

        const geometry = await mark.evaluate((element) => {
          const letter = element.querySelector('[data-slot="workspace-mark-initial"]')
          const badgeElement = element.querySelector('[data-slot="workspace-mark-badge"] > *')
          if (!letter?.firstChild || !badgeElement) return null
          // The glyph's own box, not the flex item's, which is a full line tall.
          const range = document.createRange()
          range.selectNodeContents(letter)
          const glyph = range.getBoundingClientRect()
          const count = badgeElement.getBoundingClientRect()
          const style = getComputedStyle(badgeElement)
          return {
            glyph: { left: glyph.left, right: glyph.right, top: glyph.top, bottom: glyph.bottom },
            count: { left: count.left, right: count.right, top: count.top, bottom: count.bottom },
            fill: style.backgroundColor,
            label: style.color,
          }
        })
        expect(geometry).not.toBeNull()
        const { glyph, count } = geometry!
        const fill = await page.evaluate(toHex, geometry!.fill)
        const label = await page.evaluate(toHex, geometry!.label)
        const intersects =
          count.left < glyph.right &&
          count.right > glyph.left &&
          count.top < glyph.bottom &&
          count.bottom > glyph.top
        expect(intersects).toBe(false)

        const background = parseColor(fill)
        const foreground = parseColor(label)
        expect(background, `badge fill ${fill}`).toBeDefined()
        expect(foreground, `badge label ${label}`).toBeDefined()
        expect(contrastRatio(foreground!, background!)).toBeGreaterThanOrEqual(4.5)
      })
    }
  })
}
