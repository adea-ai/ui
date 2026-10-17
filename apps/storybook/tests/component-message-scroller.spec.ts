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
/**
 * Return once the opening transcript has stopped changing size, with the reader at its end.
 *
 * The rows are `content-visibility: auto`: they are laid out at an estimate and take their
 * real height as they come into range, so for a few frames after mounting the thread keeps
 * shrinking and the browser keeps clamping the scroll offset down with it. Content that
 * arrives in that window lands on a scroller whose last scroll event is still being
 * delivered, and the follow controller cannot tell that clamp from a reader scrolling up.
 * A test about what streaming does to a settled thread starts from a settled thread.
 */
const settled = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const element = document.querySelector<HTMLElement>('#scroller')!
        let height = -1
        let steady = 0
        const frame = () => {
          const fromBottom = element.scrollHeight - element.clientHeight - element.scrollTop
          steady = element.scrollHeight === height && fromBottom <= 1 ? steady + 1 : 0
          height = element.scrollHeight
          if (steady >= 5) resolve()
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      })
  )
/**
 * Scroll the thread up with the wheel and return once it has come to rest.
 *
 * Engines that animate a wheel notch keep scrolling after the event is dispatched, so
 * "the view moved" is not "the view has stopped". How far a notch carries the view is
 * the engine's business (the rows are `content-visibility: auto`, so the distance also
 * depends on how the rows passed end up sized), so the stop is not an offset worked out
 * in advance: it is the offset and the height holding still for several frames, after
 * the view has begun to move. The thread is settled first so the move is from rest.
 */
const wheelBy = async (page: Page, delta: number) => {
  await settled(page)
  const start = (await metrics(page)).top
  await wheel(page, delta)
  await expect.poll(async () => (await metrics(page)).top).toBeLessThan(start)
  await atRest(page)
}
/** Return once the offset and the height have both held still for several frames. */
const atRest = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const element = document.querySelector<HTMLElement>('#scroller')!
        let last = ''
        let steady = 0
        const frame = () => {
          const now = `${element.scrollTop}/${element.scrollHeight}`
          steady = now === last ? steady + 1 : 0
          last = now
          if (steady >= 5) resolve()
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      })
  )
/**
 * Leave the reader idle just inside the top margin, where the next load starts.
 *
 * A wheel fling that is still running when the load starts moves the first visible turn
 * by the fling's own distance, which the insert-stability probe cannot tell from the
 * insert moving it. So the reader gets there in steps that each end at rest: out of the
 * bottom to well clear of the margin, then a short jump into it. (The rows are
 * `content-visibility: auto`, so a long scroll lands where the rows it passed end up
 * sized, not where it was aimed; each stop is awaited by what the thread does.)
 */
const approachTop = async (page: Page) => {
  for (const top of [1200, 600, 100]) {
    await scroller(page).evaluate((element, next) => {
      element.scrollTop = next
    }, top)
    if (top > 100) await atRest(page)
  }
}
/**
 * Park the reader on a turn, then start a load from the "Load earlier messages" control.
 *
 * Where the load margin ends is the engine's business: the rows are `content-visibility:
 * auto`, so a jump to a fixed offset lands where the rows it passed end up sized, and an
 * offset that starts a load in one engine (300 did, in Chromium) is outside the margin in
 * another (WebKit's calls stayed 0). So the reader is put on a turn found from the
 * geometry now (10 px into it, so the turn before is out of view by more than a
 * sub-pixel), re-aimed until the rows around have stopped resizing, and the load is
 * started from the control when the engine has not already started it, which loads
 * wherever the reader is. The anchor the scroller
 * took is read back, so a test that is about an anchor on that turn fails here, with the
 * turn it did get, if the setup missed.
 */
const parkAndLoad = async (page: Page, id: string) => {
  // Where the turn sits against the top of the view. An engine that keeps whole-pixel
  // scroll offsets (WebKit: 9 px, not 10) cannot be aimed at a fractional row edge, so
  // "10 px in" is a band, 5 to 15, which still leaves the turn before it out of view.
  const offsetOf = () =>
    scroller(page).evaluate(
      (element, turnId) =>
        element.querySelector(`[data-anchor-id="${turnId}"]`)!.getBoundingClientRect().top -
        element.getBoundingClientRect().top,
      id
    )
  await expect
    .poll(
      async () => {
        let offset = await offsetOf()
        if (offset > -5 || offset < -15) {
          await scroller(page).evaluate(
            (element, move) =>
              element.scrollTo({ top: element.scrollTop + move, behavior: 'instant' }),
            offset + 10
          )
          await atRest(page)
          offset = await offsetOf()
        }
        return offset <= -5 && offset >= -15 ? 'parked' : `${id} is ${offset}px from the top`
      },
      {
        message: `${id} is about 10px above the top of the view once the rows have stopped resizing`,
      }
    )
    .toBe('parked')
  // An engine whose reader is already inside the margin has started the load itself, and
  // the control is gone; one that is not has the control, and it starts the load.
  await page.evaluate(() =>
    document.querySelector<HTMLElement>('[data-slot="message-scroller-older"] button')?.click()
  )
  await expect.poll(() => calls(page)).toBe(1)
  await atRest(page)
  const taken = await page.evaluate(() => (window as FixtureWindow).fixture.probe?.id)
  expect(taken, `the anchor taken when the load started`).toBe(id)
}
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
    await wheelBy(page, -700)
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
      // Park near the top, so the anchor is a real turn mid-thread.
      await approachTop(page)
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
    await approachTop(page)
    await expect.poll(() => turnCount(page), { timeout: 5_000 }).toBe(40)
    await frames(page, 8)
    const result = await probe(page)
    expect(result!.max, `anchor ${result!.id} moved by ${result!.max}px`).toBeLessThanOrEqual(1)
    expect((await metrics(page)).top).toBeGreaterThan(300)
  })

  test('a scroll that is still running when the load starts carries on to the top', async ({
    page,
  }) => {
    // The reader is mid-fling toward the top (an animated scroll, as a wheel or touch
    // momentum is) when the sentinel comes into range and the load begins. The load has
    // nothing to add, and restoring the anchor must not cancel the rest of the fling.
    await setMode(page, 'noop')
    await settled(page)
    await scroller(page).evaluate((element) => element.scrollTo({ top: 1500, behavior: 'instant' }))
    await atRest(page)
    await scroller(page).evaluate((element) => element.scrollTo({ top: 0, behavior: 'smooth' }))
    await expect.poll(async () => (await metrics(page)).top).toBe(0)
    expect(await calls(page)).toBeGreaterThanOrEqual(1)
  })

  test('history that lands while the reader is scrolling keeps the turn the reader arrived at', async ({
    page,
  }) => {
    // The reader scrolls on after the load has started (an animated scroll, as a wheel
    // or touch momentum is), and the host answers only once they have stopped. The turns
    // that land above must not move the turn the reader came to rest on.
    await setMode(page, 'gated')
    await settled(page)
    await scroller(page).evaluate((element) => element.scrollTo({ top: 1500, behavior: 'instant' }))
    await atRest(page)
    await scroller(page).evaluate((element) => element.scrollTo({ top: 0, behavior: 'smooth' }))
    await expect.poll(async () => (await metrics(page)).top).toBe(0)
    await atRest(page)
    await expect.poll(() => calls(page)).toBe(1)

    const offsetOf = (id: string) =>
      page.evaluate((anchorId) => {
        const surface = document.querySelector('#scroller')!
        const element = surface.querySelector(`[data-anchor-id="${anchorId}"]`)!
        return element.getBoundingClientRect().top - surface.getBoundingClientRect().top
      }, id)
    const before = await offsetOf('turn-1000')
    await page.evaluate(() => (window as FixtureWindow).fixture.release())
    await expect.poll(() => turnCount(page)).toBe(40)
    await atRest(page)
    expect(Math.abs((await offsetOf('turn-1000')) - before)).toBeLessThanOrEqual(1)
    expect((await metrics(page)).top).toBeGreaterThan(300)
  })

  test('a row that sizes itself late below the turn the reader came to rest on does not move the view', async ({
    page,
  }) => {
    // The turn that was first in view when the load began is not the one the reader
    // comes to rest on: they scrolled on to the top while the host was answering. A
    // row between the two (an image, highlighted code, a row leaving
    // `content-visibility`) that changes size moves the first turn, and with it an
    // anchor left there, without moving anything the reader is looking at.
    await setMode(page, 'gated')
    await settled(page)
    await scroller(page).evaluate((element) => element.scrollTo({ top: 1500, behavior: 'instant' }))
    await atRest(page)
    await scroller(page).evaluate((element) => element.scrollTo({ top: 0, behavior: 'smooth' }))
    await expect.poll(async () => (await metrics(page)).top).toBe(0)
    await atRest(page)
    await expect.poll(() => calls(page)).toBe(1)

    const offsetOf = (id: string) =>
      page.evaluate((anchorId) => {
        const surface = document.querySelector('#scroller')!
        const element = surface.querySelector(`[data-anchor-id="${anchorId}"]`)!
        return element.getBoundingClientRect().top - surface.getBoundingClientRect().top
      }, id)
    const before = await offsetOf('turn-1000')
    await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('[data-anchor-id="turn-1001"]')!
      row.style.paddingBottom = '40px'
    })
    await atRest(page)
    expect(Math.abs((await offsetOf('turn-1000')) - before)).toBeLessThanOrEqual(1)

    await page.evaluate(() => (window as FixtureWindow).fixture.release())
    await expect.poll(() => turnCount(page)).toBe(40)
    await atRest(page)
    expect(Math.abs((await offsetOf('turn-1000')) - before)).toBeLessThanOrEqual(1)
    expect((await metrics(page)).top).toBeGreaterThan(300)
  })

  test('a reader who moves in the same task as a content change is still followed', async ({
    page,
  }) => {
    // The scroll event is delivered at the next rendering opportunity, so a scroll and a
    // change to the content made in one task reach the scroller in the opposite order:
    // the content observers run first, and the reader's move is only seen afterwards.
    // The anchor must still end up on the turn the reader came to, or a row that sizes
    // itself late between the two moves the view.
    await setMode(page, 'gated')
    await settled(page)
    // The load begins with the anchor on a turn below the one the reader will end on.
    await parkAndLoad(page, 'turn-1001')

    await scroller(page).evaluate((element) => {
      element.scrollTo({ top: 0, behavior: 'instant' })
      const content = element.querySelector('[data-slot="conversation-content"]')!
      content.append(document.createElement('span')) // a child mutation: the observer's microtask
    })
    await atRest(page)

    const offsetOf = (id: string) =>
      page.evaluate((anchorId) => {
        const surface = document.querySelector('#scroller')!
        const element = surface.querySelector(`[data-anchor-id="${anchorId}"]`)!
        return element.getBoundingClientRect().top - surface.getBoundingClientRect().top
      }, id)
    const before = await offsetOf('turn-1000')
    expect((await metrics(page)).top).toBe(0)
    // The turn the reader is on grows below its own top edge, which moves the turn the
    // load began on (the next one down) but nothing the reader is looking at.
    await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('[data-anchor-id="turn-1000"]')!
      row.style.paddingBottom = '40px'
    })
    await atRest(page)
    expect(Math.abs((await offsetOf('turn-1000')) - before)).toBeLessThanOrEqual(1)
    expect((await metrics(page)).top).toBe(0)
  })

  test("a row that grows in the same task as the reader's move does not move the view", async ({
    page,
  }) => {
    // The anchor is a turn below the one the reader will end on, with a row between the two.
    // The reader moves up and that row grows in the same task as a child mutation, so the
    // first observer callback sees both at once: the anchor has moved down by the growth,
    // and nothing the reader is looking at has moved.
    await setMode(page, 'gated')
    await settled(page)
    await parkAndLoad(page, 'turn-1002')

    // The offset turn-1000 has at the top is read in the same task, before the row grows,
    // so the expectation is measured on this engine and not carried over from another.
    const baseline = await scroller(page).evaluate((element) => {
      element.scrollTo({ top: 0, behavior: 'instant' })
      const offset = () =>
        element.querySelector('[data-anchor-id="turn-1000"]')!.getBoundingClientRect().top -
        element.getBoundingClientRect().top
      const before = offset()
      element.querySelector<HTMLElement>('[data-anchor-id="turn-1001"]')!.style.paddingBottom =
        '30px'
      element
        .querySelector('[data-slot="conversation-content"]')!
        .append(document.createElement('span'))
      return before
    })
    await atRest(page)

    const offset = await page.evaluate(() => {
      const surface = document.querySelector('#scroller')!
      const element = surface.querySelector('[data-anchor-id="turn-1000"]')!
      return element.getBoundingClientRect().top - surface.getBoundingClientRect().top
    })
    expect(
      Math.abs(offset - baseline),
      `turn-1000 is at ${offset}px, was ${baseline}px`
    ).toBeLessThanOrEqual(1)
    expect((await metrics(page)).top).toBe(0)
  })

  test('a row above a reader at rest that grows moves the reader down by the growth', async ({
    page,
  }) => {
    // The reader is parked on a turn, with the row before it just out of view. That row
    // grows (an image, highlighted code, a row leaving `content-visibility`) far enough
    // that its bottom edge is now inside the view. The turn the reader was on has moved
    // down by the growth and the view must follow it: the growing row is not the turn the
    // reader was reading, even though some of it is now in view.
    await setMode(page, 'gated')
    await settled(page)
    await parkAndLoad(page, 'turn-1002')

    const geometry = await scroller(page).evaluate((element) => {
      const top = element.getBoundingClientRect().top
      const turn = (id: string) =>
        element.querySelector<HTMLElement>(`[data-anchor-id="${id}"]`)!.getBoundingClientRect()
      const before = { reader: turn('turn-1002').top - top, above: turn('turn-1001').bottom - top }
      const row = element.querySelector<HTMLElement>('[data-anchor-id="turn-1001"]')!
      // Enough to bring the row's bottom edge 100 px into the view.
      const padding = parseFloat(getComputedStyle(row).paddingBottom)
      row.style.paddingBottom = `${padding + Math.ceil(100 - before.above)}px`
      return { before, scrollTop: element.scrollTop }
    })
    expect(
      geometry.before.above,
      'the row before the reader starts out of view'
    ).toBeLessThanOrEqual(0)
    await atRest(page)

    const after = await scroller(page).evaluate((element) => {
      const top = element.getBoundingClientRect().top
      const turn = (id: string) =>
        element.querySelector<HTMLElement>(`[data-anchor-id="${id}"]`)!.getBoundingClientRect()
      return { reader: turn('turn-1002').top - top, scrollTop: element.scrollTop }
    })
    expect(
      Math.abs(after.reader - geometry.before.reader),
      `turn-1002 is at ${after.reader}px, was ${geometry.before.reader}px`
    ).toBeLessThanOrEqual(1)
    expect(after.scrollTop).toBeGreaterThan(geometry.scrollTop)
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
    // The new thread's rows are still taking their real height, and the browser clamps the
    // offset down with them. A load that lands in that window meets the clamp's scroll event
    // and the follow controller reads it as the reader scrolling up. This test is about the
    // stale load, so it starts from a settled thread.
    await settled(page)

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
    await settled(page)
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
