// A browser process that dies mid-interaction leaves Playwright with one opaque
// line, and an ordinary close reports the same thing. The packed gates fail either
// way, so this module does not decide any outcome: it only names the case, so a
// failure is diagnosable from the log alone instead of arriving as an unexplained
// exit code with no indication of which leg lost the browser.
//
// Nothing here touches an assertion, a budget or a pass/fail decision.

const BROWSER_GONE_MESSAGES = [
  'Target page, context or browser has been closed',
  'browser has been closed',
  'Target closed',
]

// Playwright reports a renderer that died as "Target crashed". That is a different
// failure from the browser going away: the page's own process died, so the engine
// may still be running with no page left to talk to. The two are named apart.
const TARGET_CRASHED_MESSAGES = ['Target crashed']

/**
 * Did the browser process go away? True for Playwright's own wording for a closed
 * target, whichever operation surfaced it.
 */
export function isBrowserGoneError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return BROWSER_GONE_MESSAGES.some((text) => message.includes(text))
}

/**
 * Did the page's renderer crash? True for Playwright's wording for a crashed target.
 */
export function isTargetCrashedError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return TARGET_CRASHED_MESSAGES.some((text) => message.includes(text))
}

/**
 * Names a browser process that went away, or a renderer that died, mid-interaction.
 *
 * The returned error keeps the original as its cause, so the operation Playwright
 * was in and its own log are not lost. Any other error is returned unchanged, so
 * nothing else about a gate's outcome changes.
 *
 * `lastAction` is the interaction the leg was performing when it died, when the
 * gate was able to record it. Playwright's own error for a crashed renderer
 * carries no call log, so without it the failure says which leg died and not
 * which interaction it was in.
 */
export function describeBrowserGoneFailure(pilot, condition, engine, error, lastAction) {
  const detail = error instanceof Error ? error.message : String(error)
  const step = lastAction ? `, last action: ${lastAction}` : ''
  if (isTargetCrashedError(error)) {
    return new Error(
      `Packed ${pilot}/${condition}/${engine}: the page's renderer crashed mid-interaction ` +
        `(${detail}${step}); the packed contract is unproven in this run`,
      { cause: error }
    )
  }
  if (!isBrowserGoneError(error)) return error
  return new Error(
    `Packed ${pilot}/${condition}/${engine}: the browser process went away mid-interaction ` +
      `(${detail}${step}); the packed contract is unproven in this run`,
    { cause: error }
  )
}
