import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/**
 * Shared plumbing for the AI-elements component specs.
 *
 * The page is served from `http://localhost` rather than `about:blank` so the
 * clipboard behaves as it does in an application: `navigator.clipboard` exists,
 * the specs can grant `clipboard-read`/`clipboard-write`, and a copy reaches the
 * real clipboard instead of a stub that would pass whatever the component wrote.
 */
const ORIGIN = 'http://localhost:4173'

export async function mountFixture(
  page: Page,
  bundle: { script: string; css: string },
  title: string,
  search = ''
) {
  await page.route(`${ORIGIN}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body></body></html>`,
    })
  )
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN })
  await page.goto(`${ORIGIN}/${search}`)
  await page.addStyleTag({ content: bundle.css })
  await page.addScriptTag({ content: bundle.script })
}

export async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((next) => {
    document.documentElement.classList.toggle('dark', next === 'dark')
  }, theme)
}

/**
 * Run axe over the whole fixture in light and dark themes, at a desktop width
 * and at 320px, and require no violations at all (not only serious ones: these
 * are new components, so there is no backlog to excuse).
 */
export async function expectNoAxeViolations(
  page: Page,
  options: { exclude?: string[]; disable?: string[] } = {}
) {
  for (const width of [1024, 320]) {
    await page.setViewportSize({ width, height: 800 })
    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme)
      // A fixture is a component on a blank page, not a page: it has no h1 of its own.
      let builder = new AxeBuilder({ page }).disableRules([
        'page-has-heading-one',
        ...(options.disable ?? []),
      ])
      for (const selector of options.exclude ?? []) builder = builder.exclude(selector)
      const result = await builder.analyze()
      expect(
        result.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => node.target.join(' ')),
        })),
        `${theme} at ${width}px`
      ).toEqual([])
    }
  }
  await setTheme(page, 'light')
}

/** True when nothing on the page forces a horizontal scrollbar. */
export function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
}
