/**
 * Did the browser process go away? True for Playwright's own wording for a closed
 * target, whichever operation surfaced it.
 */
export function isBrowserGoneError(error: unknown): boolean

/**
 * Did the page's renderer crash? True for Playwright's wording for a crashed target.
 */
export function isTargetCrashedError(error: unknown): boolean

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
export function describeBrowserGoneFailure(
  pilot: string,
  condition: string,
  engine: string,
  error: unknown,
  lastAction?: string
): unknown
