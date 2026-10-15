import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { expectNoAxeViolations, hasNoHorizontalOverflow, mountFixture } from './ai-elements-harness'

let bundle: { script: string; css: string }

test.beforeAll(async () => {
  bundle = await bundleFixture('questionnaire')
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1000 })
  await mountFixture(page, bundle, 'Questionnaire')
})

type Submission = Record<string, { optionIds: string[]; text: string }>
type FixtureWindow = Window &
  typeof globalThis & {
    fixture: {
      submissions: Submission[]
      changes: number
      slowCalls: number
      settle: (status: string) => void
    }
  }

const submissions = (page: Page) =>
  page.evaluate(() => (window as FixtureWindow).fixture.submissions)

/** What currently has focus, described the way a person would. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement
    if (!active || active === document.body) return 'body'
    const label =
      (active as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
      active.getAttribute('aria-label') ||
      active.textContent?.trim() ||
      ''
    return `${active.tagName.toLowerCase()}:${label}`
  })

const flow = (page: Page) => page.locator('#flow')

/** Pick an option by its visible label, as a pointer user would. */
const choose = (page: Page, label: string) =>
  flow(page)
    .locator('label', { hasText: new RegExp(`^${label}`) })
    .click()

test('a multi-question flow can be completed with the keyboard alone', async ({ page }) => {
  await page.locator('#before').focus()
  const next = flow(page).getByRole('button', { name: 'Next' })
  await expect(next).toBeDisabled()
  await expect(flow(page).getByText('Question 1 of 3')).toBeVisible()

  // Question 1: a single choice. Tab enters the group; arrows move and select.
  await page.keyboard.press('Tab')
  expect(await focused(page)).toMatch(/^input:The app/)
  await page.keyboard.press('ArrowDown')
  expect(await focused(page)).toMatch(/^input:The library/)
  await expect(flow(page).getByRole('radio', { name: /The library/ })).toBeChecked()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowUp')
  await expect(flow(page).getByRole('radio', { name: /The library/ })).toBeChecked()
  await expect(flow(page).getByRole('radio', { name: /Both/ })).not.toBeChecked()
  await expect(next).toBeEnabled()
  // Tab leaves the group for Next (Back is disabled on the first question).
  await page.keyboard.press('Tab')
  await expect(next).toBeFocused()
  await page.keyboard.press('Enter')

  // The new question's heading has focus, so it is read before anything is answered.
  await expect(flow(page).getByText('Question 2 of 3')).toBeVisible()
  expect(await focused(page)).toBe('h4:Which checks should run?')

  // Question 2: several choices. Space toggles each checkbox.
  await expect(next).toBeDisabled()
  await page.keyboard.press('Tab')
  expect(await focused(page)).toMatch(/^input:Unit tests/)
  await page.keyboard.press('Space')
  await page.keyboard.press('Tab')
  expect(await focused(page)).toMatch(/^input:Type check/)
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  await page.keyboard.press('Tab')
  expect(await focused(page)).toMatch(/^input:Lint/)
  await page.keyboard.press('Space')
  await expect(flow(page).getByRole('checkbox', { name: /Unit tests/ })).toBeChecked()
  await expect(flow(page).getByRole('checkbox', { name: /Type check/ })).not.toBeChecked()
  await expect(flow(page).getByRole('checkbox', { name: /Lint/ })).toBeChecked()

  // Back keeps the earlier answer, and focus goes to that question's heading.
  await page.keyboard.press('Tab')
  await expect(flow(page).getByRole('button', { name: 'Back' })).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await focused(page)).toBe('h4:Which scope should the change cover?')
  await expect(flow(page).getByRole('radio', { name: /The library/ })).toBeChecked()
  await page.keyboard.press('Tab')
  expect(await focused(page)).toMatch(/^input:The library/)
  await page.keyboard.press('Tab')
  await expect(next).toBeFocused()
  await page.keyboard.press('Space')
  expect(await focused(page)).toBe('h4:Which checks should run?')
  await expect(flow(page).getByRole('checkbox', { name: /Unit tests/ })).toBeChecked()
  await expect(next).toBeEnabled()

  // Question 3: free text. Plain Enter is a newline; Ctrl+Enter sends.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(next).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await focused(page)).toBe('h4:Anything else we should know?')
  const send = flow(page).getByRole('button', { name: 'Send answer' })
  await expect(send).toBeDisabled()
  await page.keyboard.press('Tab')
  const notes = flow(page).getByRole('textbox', { name: 'Your answer' })
  await expect(notes).toBeFocused()
  await page.keyboard.type('Ship it')
  await page.keyboard.press('Enter')
  await page.keyboard.type('after lunch')
  await expect(notes).toHaveValue('Ship it\nafter lunch')
  expect(await submissions(page)).toEqual([])
  await expect(send).toBeEnabled()

  await page.keyboard.press('Control+Enter')
  await expect.poll(() => submissions(page)).toHaveLength(1)
  expect((await submissions(page))[0]).toEqual({
    scope: { optionIds: ['lib'], text: '' },
    checks: { optionIds: ['unit', 'lint'], text: '' },
    notes: { optionIds: [], text: 'Ship it\nafter lunch' },
  })

  // Submitting locks every control, and sending again is refused.
  await expect(flow(page)).toHaveAttribute('data-status', 'submitting')
  await expect(notes).toBeDisabled()
  await expect(send).toBeDisabled()
  await expect(flow(page).getByRole('button', { name: 'Back' })).toBeDisabled()
  await flow(page).dispatchEvent('keydown', { key: 'Enter', ctrlKey: true })
  await flow(page).dispatchEvent('keydown', { key: 'Enter', metaKey: true })
  expect(await submissions(page)).toHaveLength(1)
})

test('when the host settles the answer the exchange is read-only and focus is not lost', async ({
  page,
}) => {
  await choose(page, 'Both')
  await flow(page).getByRole('button', { name: 'Next' }).click()
  await choose(page, 'Type check')
  await flow(page).getByRole('button', { name: 'Next' }).click()
  await flow(page).getByRole('textbox', { name: 'Your answer' }).fill('Line one\nLine two')
  await flow(page).getByRole('textbox', { name: 'Your answer' }).press('Meta+Enter')
  await expect.poll(() => submissions(page)).toHaveLength(1)

  await page.evaluate(() => (window as FixtureWindow).fixture.settle('answered'))
  await expect(flow(page)).toHaveAttribute('data-status', 'answered')
  await expect(flow(page).getByText('Answered', { exact: true })).toBeVisible()
  const inside = await flow(page).evaluate((section) => ({
    controls: section.querySelectorAll('input, textarea, button, select, [contenteditable]').length,
    tabbable: section.querySelectorAll('[tabindex]:not([tabindex="-1"])').length,
    pairs: [...section.querySelectorAll('dl > div')].map((pair) => [
      pair.querySelector('dt')?.textContent,
      (pair.querySelector('dd') as HTMLElement).innerText,
    ]),
  }))
  expect(inside.controls).toBe(0)
  expect(inside.tabbable).toBe(0)
  expect(inside.pairs).toEqual([
    ['Which scope should the change cover?', 'Both'],
    ['Which checks should run?', 'Type check'],
    ['Anything else we should know?', 'Line one\nLine two'],
  ])

  // The control that had focus is gone; focus must not have fallen to <body>.
  const owner = await page.evaluate(() => document.activeElement?.closest('#flow')?.id ?? 'none')
  expect(owner).toBe('flow')
})

test('Ctrl+Enter sends only from the last question, and only when it is answered', async ({
  page,
}) => {
  await choose(page, 'The app')
  await flow(page)
    .getByRole('radio', { name: /The app/ })
    .press('Control+Enter')
  expect(await submissions(page)).toEqual([])
  await expect(flow(page).getByText('Question 1 of 3')).toBeVisible()

  await flow(page).getByRole('button', { name: 'Next' }).click()
  await choose(page, 'Lint')
  await flow(page).getByRole('button', { name: 'Next' }).click()
  const notes = flow(page).getByRole('textbox', { name: 'Your answer' })
  await notes.press('Control+Enter')
  expect(await submissions(page)).toEqual([])
  await notes.fill('   ')
  await notes.press('Control+Enter')
  expect(await submissions(page)).toEqual([])
  await notes.fill('Done')
  await notes.press('Control+Enter')
  await expect.poll(() => submissions(page)).toHaveLength(1)
})

test('a locked questionnaire says why, and the reason describes the controls', async ({ page }) => {
  const locked = page.locator('#locked')
  const reason = 'Reconnect to the session to answer.'
  await expect(locked.getByText(reason)).toBeVisible()
  await expect(locked.getByRole('status')).toHaveText(reason)
  for (const control of await locked.locator('input, textarea').all()) {
    await expect(control).toBeDisabled()
  }
  const next = locked.getByRole('button', { name: 'Next' })
  await expect(next).toBeDisabled()
  await expect(next).toHaveAccessibleDescription(reason)
  // Locking does not throw away what was already chosen.
  await expect(locked.getByRole('radio', { name: /The app/ })).toBeChecked()

  const single = page.locator('#locked-single')
  const why = single.getByRole('textbox', { name: 'Your answer' })
  await expect(why).toBeDisabled()
  await expect(why).toHaveValue('A draft answer')
  await expect(why).toHaveAccessibleDescription('Another window already answered.')
  const send = single.getByRole('button', { name: 'Send answer' })
  await expect(send).toBeDisabled()
  await expect(send).toHaveAccessibleDescription('Another window already answered.')
  await single.dispatchEvent('keydown', { key: 'Enter', ctrlKey: true })
  expect(await submissions(page)).toEqual([])
})

test('answered and expired questionnaires are a record, not a form', async ({ page }) => {
  const answered = page.locator('#answered')
  const rows = await answered.evaluate((section) =>
    [...section.querySelectorAll('dl > div')].map((pair) => [
      pair.querySelector('dt')?.textContent,
      (pair.querySelector('dd') as HTMLElement).innerText,
    ])
  )
  expect(rows).toEqual([
    ['Which scope should the change cover?', 'The library'],
    ['Which checks should run?', 'Unit tests, Lint'],
    ['Anything else we should know?', 'Keep it small.\nSecond line.'],
  ])
  await expect(answered.getByText('Answered', { exact: true })).toBeVisible()

  const expired = page.locator('#expired')
  await expect(expired.getByText('No longer waiting')).toBeVisible()
  await expect(expired.locator('dd')).toHaveText('Skipped')
  for (const id of ['answered', 'expired']) {
    expect(
      await page
        .locator(`#${id}`)
        .evaluate((section) => section.querySelectorAll('input, textarea, button').length),
      id
    ).toBe(0)
  }
})

test('a one-question form has no Back or Next and sends from the keyboard', async ({ page }) => {
  const single = page.locator('#single')
  await expect(single.getByRole('button', { name: 'Back' })).toHaveCount(0)
  await expect(single.getByRole('button', { name: 'Next' })).toHaveCount(0)
  await expect(single.getByText(/Question \d of/)).toHaveCount(0)
  const field = single.getByRole('textbox', { name: 'Your answer' })
  await field.fill('Because it is simplest')
  await field.press('Control+Enter')
  await expect
    .poll(() => submissions(page))
    .toEqual([{ why: { optionIds: [], text: 'Because it is simplest' } }])
})

test('a repeat send while the host is still handling the first is ignored', async ({ page }) => {
  const slow = page.locator('#slow')
  const field = slow.getByRole('textbox', { name: 'Your answer' })
  const calls = () => page.evaluate(() => (window as FixtureWindow).fixture.slowCalls)
  await field.focus()
  await page.keyboard.press('Control+Enter')
  await page.keyboard.press('Control+Enter')
  await slow.getByRole('button', { name: 'Send answer' }).dblclick()
  expect(await calls()).toBe(1)
  // Once the host has finished, the answer can be sent again.
  await page.waitForTimeout(600)
  await page.keyboard.press('Control+Enter')
  expect(await calls()).toBe(2)
})

test('fits a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  expect(await hasNoHorizontalOverflow(page)).toBe(true)
})

test('has no accessibility violations in either theme or at 320px', async ({ page }) => {
  await expectNoAxeViolations(page)
})
