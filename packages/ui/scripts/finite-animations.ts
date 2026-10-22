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
