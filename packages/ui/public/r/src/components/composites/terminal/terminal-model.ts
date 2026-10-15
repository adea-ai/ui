/**
 * The terminal's pure decisions: what its status says, which lines are mounted,
 * and whether the reader is at the end. They live apart from the component so
 * the rules that are easy to get subtly wrong — an off-by-one in "N earlier
 * lines", a tolerance that yanks the reader back to the bottom — have tests.
 */

/**
 * What the host knows about the command. Absent means no statement: a terminal
 * handed output with no status does not say whether the command is still running.
 */
export type TerminalStatus =
  | { state: 'running' }
  | { state: 'exited'; code: number }
  | { state: 'cancelled' }

/** The words for a status, which are also what a screen reader hears. */
export function terminalStatusLabel(status: TerminalStatus): string {
  if (status.state === 'running') return 'Running'
  if (status.state === 'cancelled') return 'Cancelled'
  return Number.isInteger(status.code) ? `Exited with code ${status.code}` : 'Exited'
}

/** Whether a status is a non-zero exit — the one thing the header tones as a failure. */
export function isFailedExit(status: TerminalStatus | undefined): boolean {
  return status?.state === 'exited' && Number.isInteger(status.code) && status.code !== 0
}

export type TerminalWindow = Readonly<{
  /** Index of the first mounted finished line. */
  start: number
  /** Retained lines before `start` that "show earlier" can reveal. */
  revealable: number
  /** Every earlier line not on screen, including those the parser discarded. */
  hidden: number
}>

/**
 * The tail of the retained lines that is mounted. `limit` is how many finished
 * lines to show; the rest are counted, not rendered, because a terminal that
 * mounts every line of a long build is a frozen page.
 */
export function terminalWindow(retained: number, dropped: number, limit: number): TerminalWindow {
  const start = Math.max(0, retained - Math.max(1, Math.floor(limit)))
  return { start, revealable: start, hidden: start + dropped }
}

/** The limit after one "show earlier" press: one more page, never past what exists. */
export function revealEarlier(limit: number, page: number, retained: number): number {
  return Math.min(Math.max(retained, 1), limit + Math.max(1, Math.floor(page)))
}

/** Subpixel scroll positions and zoom make "exactly at the bottom" unreliable. */
export const BOTTOM_TOLERANCE_PX = 4

/**
 * Whether a scroller is showing its end. This decides whether new output
 * follows the reader: at the bottom it does, anywhere else the view is theirs.
 */
export function isAtBottom(scrollHeight: number, scrollTop: number, clientHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight <= BOTTOM_TOLERANCE_PX
}
