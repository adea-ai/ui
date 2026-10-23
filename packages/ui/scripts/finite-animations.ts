/** Wait for finite transitions, including those replaced by a new CSS state. */
export async function waitForFiniteAnimations(element: Element): Promise<void> {
  const results = await Promise.allSettled(
    element
      .getAnimations({ subtree: true })
      // An infinite animation's `finished` promise never settles, so it is left
      // alone rather than holding the wait open forever.
      .filter((animation) => animation.effect?.getComputedTiming?.().iterations !== Infinity)
      .map((animation) => animation.finished)
  )
  for (const result of results) {
    if (result.status !== 'rejected') continue
    // CSS state changes cancel Animation.finished with AbortError. Other errors
    // remain failures; the subsequent locator action still checks actionability.
    if (result.reason?.name !== 'AbortError') throw result.reason
  }
}

/** The part of a Playwright page the settle step needs. */
type SettleablePage = {
  locator: (selector: string) => {
    evaluate: (fn: (element: Element) => unknown) => Promise<unknown>
  }
}

/**
 * Settles the page's finite transitions before the browser is closed.
 *
 * A packed leg ends with CSS transitions still running — the gate has measured
 * up to nineteen of them on the composer-fields legs — and the browser used to be
 * closed on them. A WebKit page torn down on a running transition can take its
 * renderer with it, and the gate cannot tell that apart from an application
 * failure afterwards: the renderer dies and the engine still exits cleanly.
 *
 * The wait is strict by default: a transition that fails for a reason other
 * than a cancelled one still fails the leg. `bestEffort` is for a leg that has
 * already failed, where the page may be gone and the leg's own error is the
 * informative one.
 */
export async function settleBeforeClose(
  page: SettleablePage,
  options: { bestEffort?: boolean } = {}
): Promise<void> {
  try {
    await page.locator('html').evaluate(waitForFiniteAnimations)
  } catch (error) {
    if (!options.bestEffort) throw error
  }
}

/**
 * Settles the page's transitions and then closes the browser, always.
 *
 * Closing the browser must not depend on the settle: a rejected settle on a
 * passing leg is a real failure, and it must still leave no browser process
 * behind. The settle's error is the one the leg reports; a close error never
 * replaces it, and on a leg that already failed it never replaces that leg's own
 * error (the caller rethrows it). A close that fails on a passing leg still
 * fails the leg.
 */
export async function settleAndClose(
  page: SettleablePage | undefined,
  browser: { close: () => Promise<unknown> },
  options: { legFailed?: boolean } = {}
): Promise<void> {
  let settleFailure: { error: unknown } | undefined
  let closeFailure: { error: unknown } | undefined
  try {
    if (page) await settleBeforeClose(page, { bestEffort: options.legFailed })
  } catch (error) {
    settleFailure = { error }
  }
  try {
    await browser.close()
  } catch (error) {
    closeFailure = { error }
  }
  if (settleFailure) throw settleFailure.error
  if (closeFailure && !options.legFailed) throw closeFailure.error
}
