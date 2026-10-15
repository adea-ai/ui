import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { expectNoAxeViolations, hasNoHorizontalOverflow, mountFixture } from './ai-elements-harness'

let bundle: { script: string; css: string }

test.beforeAll(async () => {
  bundle = await bundleFixture('message-scroller')
})

type LoadMode =
  | 'render-then-resolve'
  | 'resolve-then-render'
  | 'delay-then-render'
  | 'render-after-settle'
  | 'gated'
  | 'noop'
type FixtureWindow = Window &
  typeof globalThis & {
    fixture: {
      mode: LoadMode
      delay: number
      calls: number
      concurrent: number
      maxConcurrent: number
      firstPaintMs: number
      append: (count: number) => void
      stream: (text: string) => void
      setTurnCount: (count: number) => void
      switchTo: (conversation: string) => void
      release: () => void
      setHasOlder: (value: boolean) => void
      turnCount: () => number
      probe: { id: string; offset: number; max: number } | undefined
    }
  }

async function open(page: Page, search = '', width = 900) {
  await page.setViewportSize({ width, height: 800 })
  await mountFixture(page, bundle, 'Message scroller', search)
  await expect(page.locator('#scroller')).toBeVisible()
}

const scroller = (page: Page) => page.locator('#scroller')
const metrics = (page: Page) =>
  scroller(page).evaluate((element) => ({
    top: element.scrollTop,
    fromBottom: element.scrollHeight - element.clientHeight - element.scrollTop,
    scrollable: element.scrollHeight > element.clientHeight,
  }))
const setMode = (page: Page, mode: LoadMode, delay = 300) =>
  page.evaluate(
    (next) => {
      const { fixture } = window as FixtureWindow
      fixture.mode = next.mode
      fixture.delay = next.delay
    },
    { mode, delay }
  )
const frames = (page: Page, count = 4) =>
  page.evaluate(
    (total) =>
      new Promise<void>((resolve) => {
        const step = (left: number) =>
          left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
        step(total)
      }),
    count
  )
const wheel = async (page: Page, delta: number) => {
  const box = (await scroller(page).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, delta)
}
const jump = (page: Page) => page.getByRole('button', { name: 'Jump to latest' })
const probe = (page: Page) => page.evaluate(() => (window as FixtureWindow).fixture.probe)
const calls = (page: Page) => page.evaluate(() => (window as FixtureWindow).fixture.calls)
const turnCount = (page: Page) => page.evaluate(() => (window as FixtureWindow).fixture.turnCount())
const toTop = async (page: Page) => {
  await wheel(page, -100_000)
  await expect.poll(async () => (await metrics(page)).top).toBe(0)
}

test.describe('follow', () => {
  test.beforeEach(async ({ page }) => open(page))

  test('stays pinned to the bottom while turns arrive and a reply streams', async ({ page }) => {
    await expect.poll(async () => (await metrics(page)).fromBottom).toBeLessThanOrEqual(1)
    expect((await metrics(page)).scrollable).toBe(true)
    await expect(jump(page)).toHaveCount(0)

    for (let step = 0; step < 6; step += 1) {
      await page.evaluate(() => (window as FixtureWindow).fixture.append(1))
      await frames(page, 3)
      expect((await metrics(page)).fromBottom, `after turn ${step + 1}`).toBeLessThanOrEqual(2)
    }

    let text = ''
    for (let step = 1; step <= 40; step += 1) {
      text += `Streamed sentence ${step} keeps the reply growing line after line.\n`
      await page.evaluate((next) => (window as FixtureWindow).fixture.stream(next), text)
      await frames(page, 2)
      expect((await metrics(page)).fromBottom, `after chunk ${step}`).toBeLessThanOrEqual(2)
    }
    await expect(jump(page)).toHaveCount(0)
  })

  test('after scrolling up, new content does not move the view and "Jump to latest" returns', async ({
    page,
  }) => {
    await wheel(page, -700)
    await expect(jump(page)).toBeVisible()
    const parked = (await metrics(page)).top
    expect(parked).toBeGreaterThan(0)

    await page.evaluate(() => (window as FixtureWindow).fixture.append(5))
    let text = ''
    for (let step = 1; step <= 20; step += 1) {
      text += `Streamed line ${step}\n`
      await page.evaluate((next) => (window as FixtureWindow).fixture.stream(next), text)
      await frames(page, 2)
    }
    await frames(page, 4)
    expect(Math.abs((await metrics(page)).top - parked)).toBeLessThanOrEqual(1)
    await expect(jump(page)).toBeVisible()

    await jump(page).click()
    await expect.poll(async () => (await metrics(page)).fromBottom).toBeLessThanOrEqual(1)
    await expect(jump(page)).toHaveCount(0)

    // Following has resumed.
    await page.evaluate(() => (window as FixtureWindow).fixture.append(3))
    await frames(page, 4)
    expect((await metrics(page)).fromBottom).toBeLessThanOrEqual(2)
  })

  test('"Jump to latest" is reachable and usable from the keyboard', async ({ page }) => {
    await wheel(page, -700)
    await expect(jump(page)).toBeVisible()
    await jump(page).focus()
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await metrics(page)).fromBottom).toBeLessThanOrEqual(1)
  })

  test('a reply that is streaming is aria-busy and the thread is a polite log', async ({
    page,
  }) => {
    await expect(scroller(page)).toHaveAttribute('role', 'log')
    await expect(scroller(page)).toHaveAttribute('aria-live', 'polite')
    await expect(scroller(page)).toHaveAttribute('aria-relevant', 'additions')
    await page.evaluate(() => (window as FixtureWindow).fixture.stream('Working on it'))
    await expect(page.locator('article[aria-busy="true"]')).toHaveCount(1)
    await expect(page.locator('article[aria-busy="true"]')).toHaveAccessibleName('Assistant')
    await expect(
      page.getByRole('status').filter({ hasText: 'Assistant is responding' })
    ).toHaveCount(1)
    await page.evaluate(() => (window as FixtureWindow).fixture.stream(''))
    await expect(page.getByRole('status').filter({ hasText: 'Assistant finished' })).toHaveCount(1)
  })
})

test.describe('history', () => {
  test.beforeEach(async ({ page }) => open(page))

  for (const [mode, label] of [
    ['render-then-resolve', 'the host renders the turns, then resolves'],
    ['resolve-then-render', 'the host resolves, then renders on the next task'],
    ['delay-then-render', 'the host takes 300 ms, then renders'],
  ] as const) {
    test(`keeps the first visible turn in place when ${label}`, async ({ page }) => {
      await setMode(page, mode)
      // Park a few hundred px down, so the anchor is a real turn mid-thread.
      await wheel(page, -100_000)
      await expect.poll(() => calls(page)).toBeGreaterThanOrEqual(1)
      await expect.poll(() => turnCount(page)).toBe(40)
      await frames(page, 8)

      const result = await probe(page)
      expect(result).toBeDefined()
      expect(
        result!.max,
        `anchor ${result!.id} moved by ${result!.max}px at some frame`
      ).toBeLessThanOrEqual(1)
      // And the turn really is where it was: the reader's scrollTop absorbed the insert.
      const offsetNow = await page.evaluate((id) => {
        const surface = document.querySelector('#scroller')!
        const element = surface.querySelector(`[data-anchor-id="${id}"]`)!
        return element.getBoundingClientRect().top - surface.getBoundingClientRect().top
      }, result!.id)
      expect(Math.abs(offsetNow - result!.offset)).toBeLessThanOrEqual(1)
      expect((await metrics(page)).top).toBeGreaterThan(300)
      expect(await calls(page)).toBe(1)
    })
  }

  test('keeps the place when the host renders long after it resolved, if it says it is loading', async ({
    page,
  }) => {
    await setMode(page, 'render-after-settle', 350)
    await wheel(page, -100_000)
    await expect.poll(() => turnCount(page), { timeout: 5_000 }).toBe(40)
    await frames(page, 8)
    const result = await probe(page)
    expect(result!.max, `anchor ${result!.id} moved by ${result!.max}px`).toBeLessThanOrEqual(1)
    expect((await metrics(page)).top).toBeGreaterThan(300)
  })

  test('never starts a second load while one is in flight', async ({ page }) => {
    await setMode(page, 'gated')
    await wheel(page, -100_000)
    await expect.poll(() => calls(page)).toBe(1)
    await expect(page.getByText('Loading earlier messages…')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Load earlier messages' })).toHaveCount(0)

    // Leave the top and come back, twice: each time the sentinel re-enters the view.
    for (let round = 0; round < 2; round += 1) {
      await wheel(page, 500)
      await frames(page, 3)
      await wheel(page, -100_000)
      await frames(page, 3)
    }
    expect(await calls(page)).toBe(1)
    expect(await page.evaluate(() => (window as FixtureWindow).fixture.maxConcurrent)).toBe(1)

    await page.evaluate(() => (window as FixtureWindow).fixture.release())
    await expect.poll(() => turnCount(page)).toBe(40)
    await frames(page, 6)
    await expect(page.getByText('Loading earlier messages…')).toHaveCount(0)
    expect(await calls(page)).toBe(1)
  })

  test('the "Load earlier messages" button works from the keyboard and focus is not lost', async ({
    page,
  }) => {
    // A host with nothing to add leaves the button in place to press.
    await setMode(page, 'noop')
    await toTop(page)
    const button = page.getByRole('button', { name: 'Load earlier messages' })
    await expect(button).toBeVisible()
    await expect.poll(() => calls(page)).toBeGreaterThanOrEqual(1)
    await frames(page, 4)
    const before = await calls(page)

    await setMode(page, 'delay-then-render', 200)
    await page.locator('#before').focus()
    await page.keyboard.press('Tab')
    await expect(scroller(page)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(button).toBeFocused()
    await page.keyboard.press('Enter')
    await expect.poll(() => calls(page)).toBe(before + 1)
    await expect(page.getByText('Loading earlier messages…')).toBeVisible()
    await expect.poll(() => turnCount(page)).toBe(40)
    await expect(page.getByText('Loading earlier messages…')).toHaveCount(0)
    await frames(page, 4)

    // The control that was pressed was replaced twice; focus must still be inside the thread.
    const where = await page.evaluate(() => {
      const active = document.activeElement
      return active === document.body
        ? 'body'
        : active?.closest('#scroller')
          ? 'thread'
          : 'elsewhere'
    })
    expect(where).toBe('thread')
  })

  test('the button is gone once there is nothing earlier', async ({ page }) => {
    await page.evaluate(() => (window as FixtureWindow).fixture.setHasOlder(false))
    await expect(page.getByRole('button', { name: 'Load earlier messages' })).toHaveCount(0)
    await toTop(page)
    await frames(page, 3)
    expect(await calls(page)).toBe(0)
  })

  test('changing resetKey mid-load cancels the anchor and re-arms following', async ({ page }) => {
    await setMode(page, 'gated')
    await wheel(page, -100_000)
    await expect.poll(() => calls(page)).toBe(1)
    await expect(page.getByText('Loading earlier messages…')).toBeVisible()

    // The reader opens another conversation while the old one is still loading.
    await page.evaluate(() => (window as FixtureWindow).fixture.switchTo('B'))
    await expect(page.getByText('Loading earlier messages…')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Load earlier messages' })).toBeVisible()
    await expect.poll(async () => (await metrics(page)).fromBottom).toBeLessThanOrEqual(1)

    // The stale load now finishes and inserts turns whose ids exist in the new thread.
    await page.evaluate(() => (window as FixtureWindow).fixture.release())
    await expect.poll(() => turnCount(page)).toBe(40)
    await frames(page, 8)
    // Had the old anchor been applied, the view would have been dragged back to it.
    expect((await metrics(page)).fromBottom).toBeLessThanOrEqual(2)
    expect(await calls(page)).toBe(1)
  })

  test('a new load can start straight after a reset', async ({ page }) => {
    await setMode(page, 'gated')
    await wheel(page, -100_000)
    await expect.poll(() => calls(page)).toBe(1)
    await page.evaluate(() => (window as FixtureWindow).fixture.switchTo('B'))
    await setMode(page, 'render-then-resolve')
    await frames(page, 6)
    const before = await calls(page)
    // Reaching the top of the new thread is what asks for older turns; the stale
    // gated load from the previous thread must not be holding the slot.
    await wheel(page, -100_000)
    await expect.poll(() => calls(page)).toBe(before + 1)
    await expect.poll(() => turnCount(page)).toBe(40)
  })
})

test.describe('motion', () => {
  test('the loading indicator spins normally and is still under reduced motion', async ({
    page,
  }) => {
    await open(page)
    await setMode(page, 'gated')
    await wheel(page, -100_000)
    const status = page.getByText('Loading earlier messages…')
    await expect(status).toBeVisible()
    const looping = () =>
      page.locator('#frame').evaluate(
        (frame) =>
          frame
            .getAnimations({ subtree: true })
            .filter((animation): animation is CSSAnimation => animation instanceof CSSAnimation)
            .filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity)
            .length
      )
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    expect(await looping()).toBeGreaterThan(0)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await looping()).toBe(0)
    // The words stay: the state is not communicated by the spinner alone.
    await expect(status).toBeVisible()
    await page.evaluate(() => (window as FixtureWindow).fixture.release())
  })

  test('a streaming reply shows no caret under reduced motion', async ({ page }) => {
    await open(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.evaluate(() => (window as FixtureWindow).fixture.stream('Streaming now'))
    await expect(page.locator('#scroller .streaming-caret')).toHaveCount(1)
    expect(
      await page
        .locator('#scroller .streaming-caret')
        .evaluate((caret) => getComputedStyle(caret).display)
    ).toBe('none')
  })
})

test.describe('narrow screens', () => {
  test('a 320px viewport has no horizontal overflow, with long unbroken text', async ({ page }) => {
    await open(page, '', 320)
    await page.evaluate(() =>
      (window as FixtureWindow).fixture.stream(
        `${'unbrokenidentifier'.repeat(20)} https://example.com/${'a'.repeat(200)}\n\n\`\`\`\n${'x'.repeat(300)}\n\`\`\``
      )
    )
    await frames(page, 4)
    expect(await hasNoHorizontalOverflow(page)).toBe(true)
    const scrollerOverflow = await scroller(page).evaluate(
      (element) => element.scrollWidth - element.clientWidth
    )
    expect(scrollerOverflow).toBeLessThanOrEqual(0)
    await expect(jump(page)).toHaveCount(0)
  })
})

test.describe('size', () => {
  test('a 2,000-turn transcript paints within budget and scrolls', async ({ page }) => {
    // Software-rendered CI browsers are slow with 2,000 laid-out turns.
    test.setTimeout(180_000)
    await open(page, '?turns=2000')
    await expect.poll(() => turnCount(page)).toBe(2000)
    await expect
      .poll(() => page.evaluate(() => (window as FixtureWindow).fixture.firstPaintMs))
      .toBeGreaterThan(0)
    const firstPaint = await page.evaluate(() => (window as FixtureWindow).fixture.firstPaintMs)
    // Generous: this guards against super-linear rendering, not machine speed.
    expect(firstPaint, `first paint took ${Math.round(firstPaint)}ms`).toBeLessThan(20_000)
    await expect.poll(async () => (await metrics(page)).fromBottom).toBeLessThanOrEqual(1)

    // Scrolling through it stays responsive: a long wheel run finishes quickly.
    const start = Date.now()
    for (let step = 0; step < 20; step += 1) await wheel(page, -4_000)
    await expect.poll(async () => (await metrics(page)).top).toBeGreaterThan(0)
    expect(Date.now() - start).toBeLessThan(90_000)
    await expect(jump(page)).toBeVisible()
    await jump(page).click()
    await expect.poll(async () => (await metrics(page)).fromBottom).toBeLessThanOrEqual(2)

    // Streaming into the end of a huge transcript still follows.
    let text = ''
    for (let step = 1; step <= 10; step += 1) {
      text += `chunk ${step}\n`
      await page.evaluate((next) => (window as FixtureWindow).fixture.stream(next), text)
      await frames(page, 2)
    }
    expect((await metrics(page)).fromBottom).toBeLessThanOrEqual(2)
  })
})

test('has no accessibility violations in either theme or at 320px', async ({ page }) => {
  await open(page)
  await page.evaluate(() => (window as FixtureWindow).fixture.stream('A reply in progress'))
  await wheel(page, -700)
  await expect(jump(page)).toBeVisible()
  await expectNoAxeViolations(page)
})
