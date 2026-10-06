import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Move focus to `target` with a real Tab key press.
 *
 * The tooltip focus gate opens a tip only on keyboard-intent focus — a Tab key
 * press immediately before the focus — so a spec that asserts a focus-announced
 * tooltip must move focus with the key that moves it natively, not with a
 * programmatic `focus()`.
 *
 * Pass `previous` — the tab stop before the target — and the walk is one press:
 * the previous stop is focused silently (a programmatic focus opens nothing
 * under the gate), and the Tab press carries the keyboard intent. Without
 * `previous` the helper walks the tab order from the top, which is right for
 * fixtures whose target sits among the first stops.
 */
export async function focusByKeyboard(
  page: Page,
  target: Locator,
  previous?: Locator,
  maxStops = 40
) {
  if (previous) {
    await previous.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }))
    await page.keyboard.press('Tab')
  } else {
    await page.keyboard.press('Tab')
    for (let stop = 1; stop < maxStops; stop += 1) {
      if (await target.evaluate((element) => element === document.activeElement)) break
      await page.keyboard.press('Tab')
    }
  }
  await expect(target).toBeFocused()
}
