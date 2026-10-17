import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/**
 * Shared plumbing for the AI-elements component specs.
 *
 * The page is served from `http://localhost` rather than `about:blank` so the
 * clipboard behaves as it does in an application: `navigator.clipboard` exists,
 * every engine is granted `clipboard-read` (Chromium also `clipboard-write`), and a copy reaches the
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
  // Chromium has both `clipboard-read` and `clipboard-write` to grant. WebKit knows only
  // `clipboard-read` and rejects `clipboard-write` as unknown, which fails the setup before the
  // fixture mounts, so it is granted the read permission alone. Either way a spec that copies
  // and reads the clipboard back reads the real one, and fails if the engine refuses it.
  const chromium = page.context().browser()?.browserType().name() === 'chromium'
  await page
    .context()
    .grantPermissions(chromium ? ['clipboard-read', 'clipboard-write'] : ['clipboard-read'], {
      origin: ORIGIN,
    })
  await page.goto(`${ORIGIN}/${search}`)
  await page.addStyleTag({ content: bundle.css })
  await page.addScriptTag({ content: bundle.script })
}

/**
 * Switch the theme and return once the page has finished changing colour.
 *
 * The base styles transition text, background and border colours over 200 ms, so
 * for that long after the class changes an element's computed colour is a blend of
 * the two themes. Axe reads those blends, and a half-way mix of two themes fails
 * contrast that neither theme does (frozen at 20 ms and 60 ms into a dark-to-light
 * change, a message page reports 54 and 7 failing nodes; at 100 ms and later, none).
 * The components keep their transitions: this waits for the ones the change started
 * rather than turning them off. Only finite transitions are awaited, so a running
 * spinner or caret does not hold the page up.
 */
export async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate(async (next) => {
    document.documentElement.classList.toggle('dark', next === 'dark')
    // Reading a computed style makes the browser recalculate styles now, which is when
    // the transitions this class change causes are created.
    void getComputedStyle(document.body).color
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished.catch(() => undefined))
    )
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
