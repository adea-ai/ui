/** Wait for finite transitions, including those replaced by a new CSS state. */
export async function waitForFiniteAnimations(element: Element): Promise<void> {
  const results = await Promise.allSettled(
    element.getAnimations({ subtree: true }).map((animation) => animation.finished)
  )
  for (const result of results) {
    if (result.status !== 'rejected') continue
    // CSS state changes cancel Animation.finished with AbortError. Other errors
    // remain failures; the subsequent locator action still checks actionability.
    if (result.reason?.name !== 'AbortError') throw result.reason
  }
}
