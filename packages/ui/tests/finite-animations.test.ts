import { expect, test } from 'bun:test'
import { waitForFiniteAnimations } from '../scripts/finite-animations'

const elementWithAnimations = (...finished: Promise<unknown>[]) =>
  ({
    getAnimations: () => finished.map((promise) => ({ finished: promise })),
  }) as unknown as Element

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
