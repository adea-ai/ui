/**
 * Did the browser process go away? True for Playwright's own wording for a closed
 * target, whichever operation surfaced it.
 */
export function isBrowserGoneError(error: unknown): boolean

/**
 * Names a browser process that went away mid-interaction.
 *
 * The returned error keeps the original as its cause, so the operation Playwright
 * was in and its own log are not lost. Any other error is returned unchanged, so
 * nothing else about a gate's outcome changes.
 */
export function describeBrowserGoneFailure(
  pilot: string,
  condition: string,
  engine: string,
  error: unknown
): unknown
