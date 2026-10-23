import { expect, test } from 'bun:test'
import {
  settleAndClose,
  settleBeforeClose,
  waitForFiniteAnimations,
} from '../scripts/finite-animations'

const elementWithAnimations = (...finished: Promise<unknown>[]) =>
  ({
    getAnimations: () => finished.map((promise) => ({ finished: promise })),
  }) as unknown as Element

const pageWith = (element: Element) => {
  const selectors: string[] = []
  return {
    selectors,
    locator: (selector: string) => {
      selectors.push(selector)
      return {
        evaluate: async (fn: (element: Element) => unknown) => fn(element),
      }
    },
  }
}

test('a cancelled transition still waits for the other active animation', async () => {
  const { promise: active, resolve: finish } = Promise.withResolvers<void>()
  let settled = false
  const waiting = waitForFiniteAnimations(
    elementWithAnimations(Promise.reject(new DOMException('Cancelled', 'AbortError')), active)
  ).then(() => {
    settled = true
  })
  await Promise.resolve()
  expect(settled).toBe(false)
  finish()
  await waiting
  expect(settled).toBe(true)
})

test('unexpected animation failures remain failures', async () => {
  const error = new Error('Unexpected animation failure')
  await expect(waitForFiniteAnimations(elementWithAnimations(Promise.reject(error)))).rejects.toBe(
    error
  )
})

test('an element without animations settles immediately', async () => {
  await expect(waitForFiniteAnimations(elementWithAnimations())).resolves.toBeUndefined()
})

test('an infinite animation does not hold the wait open', async () => {
  // An infinite animation's `finished` promise never settles, so waiting for it
  // would hang the caller for good. The infinite promise below is never resolved:
  // the wait has to complete while it is still pending, which the old
  // implementation (waiting on every animation) cannot do.
  const infinite = new Promise<void>(() => {})
  const element = {
    getAnimations: () => [
      { finished: infinite, effect: { getComputedTiming: () => ({ iterations: Infinity }) } },
      { finished: Promise.resolve(), effect: { getComputedTiming: () => ({ iterations: 1 }) } },
    ],
  } as unknown as Element
  const outcome = await Promise.race([
    waitForFiniteAnimations(element).then(() => 'settled'),
    new Promise<string>((resolve) => setTimeout(() => resolve('held open'), 50)),
  ])
  expect(outcome).toBe('settled')
})

test('the page settles its transitions before the browser is closed', async () => {
  const { promise: active, resolve: finish } = Promise.withResolvers<void>()
  const page = pageWith(elementWithAnimations(active))
  let settled = false
  const waiting = settleBeforeClose(page).then(() => {
    settled = true
  })
  await Promise.resolve()
  expect(settled).toBe(false)
  finish()
  await waiting
  expect(settled).toBe(true)
  // The document root is what carries the page's transitions.
  expect(page.selectors).toEqual(['html'])
})

test('a genuine transition failure still fails the settle', async () => {
  const error = new Error('Unexpected animation failure')
  const page = pageWith(elementWithAnimations(Promise.reject(error)))
  await expect(settleBeforeClose(page)).rejects.toBe(error)
})

test('a leg that already failed keeps its own error', async () => {
  const error = new Error('Unexpected animation failure')
  const page = pageWith(elementWithAnimations(Promise.reject(error)))
  // The page may already be gone, so the settle is best-effort there.
  await expect(settleBeforeClose(page, { bestEffort: true })).resolves.toBeUndefined()
})

const browserThatCloses = (closeError?: Error) => {
  const calls: string[] = []
  return {
    calls,
    close: async () => {
      calls.push('close')
      if (closeError) throw closeError
    },
  }
}

test('the browser is closed even when the settle rejects, and the settle error is reported', async () => {
  const error = new Error('Unexpected animation failure')
  const page = pageWith(elementWithAnimations(Promise.reject(error)))
  const browser = browserThatCloses()
  await expect(settleAndClose(page, browser)).rejects.toBe(error)
  expect(browser.calls).toEqual(['close'])
})

test('the browser is closed after the page has settled, not before', async () => {
  const { promise: active, resolve: finish } = Promise.withResolvers<void>()
  const page = pageWith(elementWithAnimations(active))
  const browser = browserThatCloses()
  const closing = settleAndClose(page, browser)
  await Promise.resolve()
  expect(browser.calls).toEqual([])
  finish()
  await closing
  expect(browser.calls).toEqual(['close'])
})

test('a close failure never replaces the settle error', async () => {
  const settleError = new Error('Unexpected animation failure')
  const page = pageWith(elementWithAnimations(Promise.reject(settleError)))
  const browser = browserThatCloses(new Error('Browser already gone'))
  await expect(settleAndClose(page, browser)).rejects.toBe(settleError)
  expect(browser.calls).toEqual(['close'])
})

test('a close failure on a passing leg still fails the leg', async () => {
  const closeError = new Error('Browser did not close')
  const page = pageWith(elementWithAnimations())
  await expect(settleAndClose(page, browserThatCloses(closeError))).rejects.toBe(closeError)
})

test('a leg that already failed closes its browser and leaves its own error to the caller', async () => {
  const page = pageWith(elementWithAnimations(Promise.reject(new Error('Page already gone'))))
  const browser = browserThatCloses(new Error('Browser already gone'))
  await expect(settleAndClose(page, browser, { legFailed: true })).resolves.toBeUndefined()
  expect(browser.calls).toEqual(['close'])
})

test('a leg that never opened a page still closes its browser', async () => {
  const browser = browserThatCloses()
  await settleAndClose(undefined, browser)
  expect(browser.calls).toEqual(['close'])
})
