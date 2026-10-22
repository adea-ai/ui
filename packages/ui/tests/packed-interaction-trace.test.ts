import { expect, test } from 'bun:test'
import { tracePageInteractions } from '../scripts/packed-interaction-trace'

/** A locator that records the calls made on it, like Playwright's own. */
const locatorWith = () => {
  const calls: string[] = []
  const record =
    (action: string) =>
    async (..._args: unknown[]) => {
      calls.push(action)
    }
  return {
    calls,
    click: record('click'),
    fill: record('fill'),
    press: record('press'),
    hover: record('hover'),
  }
}

/** A page that hands out locators, like Playwright's own. */
const pageWith = () => {
  const locators = new Map<string, ReturnType<typeof locatorWith>>()
  const evaluated: number[] = []
  return {
    locators,
    evaluated,
    getByRole: (_role: string, options?: { name?: string }) => {
      const key = `${options?.name ?? _role}`
      const locator = locatorWith()
      locators.set(key, locator)
      return locator
    },
    getByLabel: (_label: string) => locatorWith(),
    getByTestId: (_id: string) => locatorWith(),
    getByText: (_text: string) => locatorWith(),
    locator: (_selector: string) => locatorWith(),
    evaluate: async (..._args: unknown[]) => {
      evaluated.push(1)
      return undefined
    },
  }
}

test('the trace names the action the leg performed', async () => {
  const page = pageWith()
  const trace = tracePageInteractions(page)
  expect(trace.lastAction()).toBeUndefined()

  const menu = page.getByRole('button', { name: 'Message input options' })
  await menu.press('ArrowDown')
  expect(trace.lastAction()).toBe("press on getByRole 'button' name 'Message input options'")

  await page.getByRole('menuitem', { name: 'Collapse the message input' }).click()
  expect(trace.lastAction()).toBe("click on getByRole 'menuitem' name 'Collapse the message input'")
})

test('the trace records an evaluate, which is where a crashed renderer surfaces', async () => {
  const page = pageWith()
  const trace = tracePageInteractions(page)
  await page.evaluate(() => 1)
  expect(trace.lastAction()).toBe('evaluate')
})

test('the trace records the target of a plain locator and of a text lookup', async () => {
  const page = pageWith()
  const trace = tracePageInteractions(page)
  await page.locator('html').hover()
  expect(trace.lastAction()).toBe("hover on locator 'html'")
  await page.getByText('Send').fill('x')
  expect(trace.lastAction()).toBe("fill on getByText 'Send'")
})

test('the traced locator is still the locator the caller asked for', async () => {
  const page = pageWith()
  tracePageInteractions(page)
  const menu = page.getByRole('button', { name: 'Message input options' })
  // The action still reaches the locator it came from.
  await menu.click()
  expect(page.locators.get('Message input options')?.calls).toEqual(['click'])
})

test('the trace decides nothing: a page without actions leaves it empty', () => {
  const trace = tracePageInteractions({})
  expect(trace.lastAction()).toBeUndefined()
  expect(tracePageInteractions(null).lastAction()).toBeUndefined()
})
