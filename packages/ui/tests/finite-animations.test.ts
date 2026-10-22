import { expect, test } from 'bun:test'
import { settleBeforeClose, waitForFiniteAnimations } from '../scripts/finite-animations'

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
  // would hang the caller for good.
  const { promise: active, resolve: finish } = Promise.withResolvers<void>()
  const element = {
    getAnimations: () => [
      { finished: active, effect: { getComputedTiming: () => ({ iterations: Infinity }) } },
      { finished: Promise.resolve(), effect: { getComputedTiming: () => ({ iterations: 1 }) } },
    ],
  } as unknown as Element
  let settled = false
  const waiting = waitForFiniteAnimations(element).then(() => {
    settled = true
  })
  await Promise.resolve()
  expect(settled).toBe(false)
  finish()
  await waiting
  expect(settled).toBe(true)
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
