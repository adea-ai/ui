import { boundText } from '../sources/source'

/**
 * Where a request for approval stands.
 *
 * - `requested`: waiting on the reader. The only state with live buttons.
 * - `approved` / `denied`: settled; the record of the answer.
 * - `expired`: nobody can answer it any more (the run moved on, a timeout).
 * - `unavailable`: it is still open, but this client cannot answer it right now
 *   (offline, no authority, another client holds it). The buttons stay visible and
 *   disabled so the reader can see what was asked and why they cannot answer.
 */
export type ConfirmationState = 'requested' | 'approved' | 'denied' | 'expired' | 'unavailable'

/** Whether the choice is still open, which is exactly when the buttons are drawn. */
export function isAwaitingAnswer(state: ConfirmationState): boolean {
  return state === 'requested' || state === 'unavailable'
}

/**
 * The one line that replaces the buttons once the request settles. Who and when
 * appear only if the host supplied them: "Approved" is a fact the state gives,
 * "by Ana" is a fact only the host knows.
 */
export function confirmationOutcome(
  state: ConfirmationState,
  by?: string,
  at?: string
): string | undefined {
  const base =
    state === 'approved'
      ? 'Approved'
      : state === 'denied'
        ? 'Denied'
        : state === 'expired'
          ? 'Expired without an answer'
          : undefined
  if (base === undefined) return undefined
  const who = by ? boundText(by, 60) : ''
  const when = at ? boundText(at, 40) : ''
  return `${base}${who ? ` by ${who}` : ''}${when ? ` at ${when}` : ''}`
}

export type DecisionResult = { ok: true } | { ok: false; message: string }

const DEFAULT_FAILURE = 'Your answer could not be sent. Try again.'

/**
 * Run a host handler that may be synchronous, asynchronous, or throw, and report
 * the outcome as data. A rejection's own message is shown (bounded) because the
 * host usually knows why; a non-Error rejection gets a plain sentence instead of
 * "[object Object]".
 */
export async function settleDecision(
  handler: (() => void | Promise<void>) | undefined
): Promise<DecisionResult> {
  try {
    await handler?.()
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? boundText(error.message, 200) : ''
    return { ok: false, message: message || DEFAULT_FAILURE }
  }
}

/**
 * Why a choice is not available, in words. A host `disabledReason` outranks the
 * built-in sentence for a missing handler, and a request that is `unavailable`
 * without a reason still says so rather than showing dead buttons.
 */
export function decisionReason(options: {
  state: ConfirmationState
  disabledReason?: string
  hasHandler: boolean
  unavailableFallback: string
  missingFallback: string
}): string | undefined {
  if (options.disabledReason) return boundText(options.disabledReason, 240)
  if (options.state === 'unavailable') return options.unavailableFallback
  if (!options.hasHandler) return options.missingFallback
  return undefined
}
