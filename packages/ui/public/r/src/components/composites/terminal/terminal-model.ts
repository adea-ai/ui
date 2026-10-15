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
  /** Index after the last mounted finished line. */
  end: number
  /** Retained lines before `start` that "show earlier" can reveal. */
  revealable: number
  /** Every earlier line not on screen, including those the parser discarded. */
  hidden: number
  /** Retained finished lines after `end`: output that arrived while the view was parked. */
  later: number
  /** Lines of the parked view that retention discarded before the reader moved on. */
  evicted: number
  /** The whole parked view was discarded, so the oldest retained lines are shown instead. */
  lost: boolean
}>

/**
 * The slice of the retained lines that is mounted. `limit` is how many finished
 * lines to show; the rest are counted, not rendered, because a terminal that
 * mounts every line of a long build is a frozen page.
 *
 * While the reader follows the tail the slice ends at the newest line. Once they
 * have scrolled away it is *parked*: `anchorEnd` is the number of lines (counting
 * the ones retention already discarded) that existed when they left, and the
 * slice stays ending there while output keeps arriving, so what they are reading
 * does not move under them. If retention discards the lines they were reading,
 * `evicted` says how many, and when all of them are gone `lost` is set and the
 * oldest retained lines are shown, because the nearest thing that still exists
 * is better than a blank box.
 */
export function terminalWindow(
  retained: number,
  dropped: number,
  limit: number,
  anchorEnd?: number
): TerminalWindow {
  const size = Math.max(1, Math.floor(limit))
  if (anchorEnd === undefined || anchorEnd >= dropped + retained) {
    const start = Math.max(0, retained - size)
    return {
      start,
      end: retained,
      revealable: start,
      hidden: start + dropped,
      later: 0,
      evicted: 0,
      lost: false,
    }
  }
  const wantedStart = Math.max(0, anchorEnd - size)
  const lost = anchorEnd <= dropped
  const end = lost ? Math.min(retained, size) : anchorEnd - dropped
  const start = lost ? 0 : Math.max(0, end - size)
  const evicted = lost
    ? anchorEnd - wantedStart
    : Math.max(0, Math.min(dropped, anchorEnd) - wantedStart)
  return {
    start,
    end,
    revealable: start,
    hidden: start + dropped,
    later: retained - end,
    evicted,
    lost,
  }
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
