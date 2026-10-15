import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { expectNoAxeViolations, hasNoHorizontalOverflow, mountFixture } from './ai-elements-harness'

let bundle: { script: string; css: string }

test.beforeAll(async () => {
  bundle = await bundleFixture('trace')
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 })
  await mountFixture(page, bundle, 'Trace')
})

const events = (page: Page) =>
  page.evaluate(() => (window as Window & { traceEvents?: string[] }).traceEvents ?? [])

const trigger = (page: Page, id: string) => page.locator(`#${id} button[aria-expanded]`).first()

test('Enter and Space toggle a line and aria-expanded follows', async ({ page }) => {
  const button = trigger(page, 'line-toggle')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('Loaded three keys')).toHaveCount(0)

  await page.locator('#before').focus()
  await page.keyboard.press('Tab')
  await expect(button).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('Loaded three keys')).toBeVisible()

  await page.keyboard.press('Space')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('Loaded three keys')).toHaveCount(0)

  await page.keyboard.press('Space')
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('aria-expanded', 'false')

  // Focus stays on the trigger through every toggle, so a keyboard user keeps their place.
  await expect(button).toBeFocused()
  expect(await events(page)).toEqual(['toggle:true', 'toggle:false', 'toggle:true', 'toggle:false'])
})

test('the trigger controls the content it discloses', async ({ page }) => {
  const button = trigger(page, 'line-toggle')
  await button.click()
  const controls = await button.getAttribute('aria-controls')
  expect(controls).toBeTruthy()
  await expect(page.locator(`[id="${controls}"]`)).toContainText('Loaded three keys')
})

test('a static line is not a tab stop; links, selectors and disclosures are', async ({ page }) => {
  for (const id of ['line-static', 'line-running', 'line-nostatus', 'line-error']) {
    const focusable = await page
      .locator(`#${id}`)
      .evaluate(
        (line) =>
          line.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length
      )
    expect(focusable, id).toBe(0)
  }

  // Walk the real tab order and record which lines receive focus.
  await page.locator('#before').focus()
  const stops: string[] = []
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press('Tab')
    const stop = await page.evaluate(() => {
      const active = document.activeElement
      return active?.closest('[data-slot="trace-line"]')?.id || active?.id || active?.tagName || ''
    })
    stops.push(stop)
    if (stop === 'after') break
  }
  expect(stops).toEqual(['line-toggle', 'line-link', 'line-select', 'line-nested', 'after'])
})

test('a link line opens in a new tab safely; a select line is a popup button', async ({ page }) => {
  const link = page.locator('#line-link a')
  await expect(link).toHaveAttribute('href', 'https://example.com/docs')
  await expect(link).toHaveAttribute('target', '_blank')
  expect(await link.getAttribute('rel')).toContain('noopener')

  const select = page.locator('#line-select button')
  await expect(select).toHaveAttribute('aria-haspopup', 'dialog')
  await select.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Space')
  expect(await events(page)).toEqual(['select', 'select'])
})

test('every status is spoken, not only coloured', async ({ page }) => {
  const snapshot = await page.getByRole('list', { name: 'Agent activity' }).ariaSnapshot()
  for (const phrase of [
    'Planned the change',
    'Completed',
    'Running tests',
    'Running',
    'Deploy',
    'Pending',
    'Type check',
    'Failed',
    'Lint',
    'Cancelled',
    'Done in 2 seconds',
  ]) {
    expect(snapshot, phrase).toContain(phrase)
  }
  // A line that made no claim says nothing about success.
  const unclaimed = await page.locator('#line-nostatus').innerText()
  expect(unclaimed).toBe('Heard back from the host')
  await expect(page.locator('#line-nostatus')).not.toHaveAttribute('data-status')

  // The glyph is decoration; the word carries the meaning.
  await expect(page.locator('#line-error [data-slot="trace-mark"]')).toHaveAttribute(
    'aria-hidden',
    'true'
  )
  const accessibleName = await page.locator('#line-error').evaluate((line) => line.textContent)
  expect(accessibleName).toContain('Failed')
})

test('only a running line is aria-busy', async ({ page }) => {
  await expect(page.locator('#line-running')).toHaveAttribute('aria-busy', 'true')
  for (const id of [
    'line-static',
    'line-pending',
    'line-error',
    'line-cancelled',
    'line-custom',
    'line-nostatus',
  ]) {
    await expect(page.locator(`#${id}`), id).not.toHaveAttribute('aria-busy')
  }
})

test('running lines animate normally and stop under prefers-reduced-motion', async ({ page }) => {
  const animations = (selector: string) =>
    page.locator(selector).evaluate((element) =>
      element
        .getAnimations({ subtree: true })
        // Keyframe animations only: a colour transition caused by the media flip is not motion.
        .filter((animation): animation is CSSAnimation => animation instanceof CSSAnimation)
        .map((animation) => ({
          name: animation.animationName,
          infinite: animation.effect?.getComputedTiming().iterations === Infinity,
        }))
    )

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const markMotion = await animations('#line-running [data-slot="trace-mark"]')
  const titleMotion = await animations('#line-running [data-slot="trace-title"]')
  expect(markMotion.some((animation) => animation.infinite)).toBe(true)
  expect(titleMotion.some((animation) => animation.infinite)).toBe(true)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await animations('#line-running [data-slot="trace-mark"]')).toEqual([])
  expect(await animations('#line-running [data-slot="trace-title"]')).toEqual([])
  // Nothing in the whole trace is still looping.
  const looping = await page
    .locator('main')
    .evaluate(
      (main) =>
        main
          .getAnimations({ subtree: true })
          .filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity)
          .length
    )
  expect(looping).toBe(0)

  // The title keeps a legible colour once the sweep is dropped.
  const title = await page
    .locator('#line-running [data-slot="trace-title"]')
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return { color: style.color, image: style.backgroundImage }
    })
  expect(title.image).toBe('none')
  expect(title.color).not.toBe('rgba(0, 0, 0, 0)')
})

test('a nested trace expands, line by line, to its output', async ({ page }) => {
  await expect(page.locator('#nested-output')).toHaveCount(0)
  await trigger(page, 'line-nested').click()
  await expect(trigger(page, 'line-nested')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('list', { name: 'Reviewer steps' })).toBeVisible()
  // The step is there but its output is not until it is opened too.
  await expect(page.locator('#nested-output')).toHaveCount(0)

  const inner = trigger(page, 'line-step')
  await inner.focus()
  await page.keyboard.press('Enter')
  await expect(inner).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#nested-output')).toBeVisible()
  await expect(page.locator('#nested-output')).toContainText('src/b.ts:40: TODO')
  await expect(page.locator('#nested-output')).toHaveAttribute('data-size', 'sm')

  // Collapsing the parent hides the whole subtree, and it can be opened again to the output.
  await trigger(page, 'line-nested').click()
  await expect(page.locator('#nested-output')).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Reviewer steps' })).toHaveCount(0)
  await trigger(page, 'line-nested').click()
  await trigger(page, 'line-step').click()
  await expect(page.locator('#nested-output')).toBeVisible()
})

test('long titles truncate instead of widening the page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  expect(await hasNoHorizontalOverflow(page)).toBe(true)
  const clipped = await page
    .locator('#line-toggle [data-slot="trace-title"]')
    .evaluate((element) => getComputedStyle(element).textOverflow)
  expect(clipped).toBe('ellipsis')
})

test('has no accessibility violations in either theme or at 320px', async ({ page }) => {
  await trigger(page, 'line-nested').click()
  await expectNoAxeViolations(page)
})
