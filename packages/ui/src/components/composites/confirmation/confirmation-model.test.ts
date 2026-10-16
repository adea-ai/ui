import { describe, expect, test } from 'bun:test'
import {
  confirmationOutcome,
  decisionReason,
  isAwaitingAnswer,
  settleDecision,
  type ConfirmationState,
} from './confirmation-model'

describe('isAwaitingAnswer', () => {
  test('only an open request has buttons', () => {
    const states: ConfirmationState[] = [
      'requested',
      'approved',
      'denied',
      'expired',
      'unavailable',
    ]
    expect(states.filter(isAwaitingAnswer)).toEqual(['requested', 'unavailable'])
  })
})

describe('confirmationOutcome', () => {
  test('says only what the state gives when the host supplied nothing else', () => {
    expect(confirmationOutcome('approved')).toBe('Approved')
    expect(confirmationOutcome('denied')).toBe('Denied')
    expect(confirmationOutcome('expired')).toBe('Expired without an answer')
  })

  test('adds who and when only when supplied', () => {
    expect(confirmationOutcome('approved', 'Ana')).toBe('Approved by Ana')
    expect(confirmationOutcome('denied', undefined, '10:02')).toBe('Denied at 10:02')
    expect(confirmationOutcome('approved', 'Ana', '10:02')).toBe('Approved by Ana at 10:02')
  })

  test('has no outcome while the request is open', () => {
    expect(confirmationOutcome('requested', 'Ana')).toBeUndefined()
    expect(confirmationOutcome('unavailable')).toBeUndefined()
  })

  test('bounds a hostile name', () => {
    const line = confirmationOutcome('approved', 'x'.repeat(1000))!
    expect(line.length).toBeLessThan(100)
  })
})

describe('settleDecision', () => {
  test('a handler that resolves, or is absent, is ok', async () => {
    expect(await settleDecision(async () => undefined)).toEqual({ ok: true })
    expect(await settleDecision(() => undefined)).toEqual({ ok: true })
    expect(await settleDecision(undefined)).toEqual({ ok: true })
  })

  test('a rejection becomes its message', async () => {
    const result = await settleDecision(() => Promise.reject(new Error('Session is read-only')))
    expect(result).toEqual({ ok: false, message: 'Session is read-only' })
  })

  test('a synchronous throw is caught too', async () => {
    const result = await settleDecision(() => {
      throw new Error('boom')
    })
    expect(result).toEqual({ ok: false, message: 'boom' })
  })

  test('a non-Error rejection gets a sentence, not [object Object]', async () => {
    const result = await settleDecision(() => Promise.reject({ code: 500 }))
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toBe('Your answer could not be sent. Try again.')
  })
})

describe('decisionReason', () => {
  const base = {
    state: 'requested' as ConfirmationState,
    hasHandler: true,
    unavailableFallback: 'Unavailable.',
    missingFallback: 'Not connected.',
  }

  test('an answerable request has no reason', () => {
    expect(decisionReason(base)).toBeUndefined()
  })

  test('the host reason wins', () => {
    expect(decisionReason({ ...base, disabledReason: 'You are offline.', hasHandler: false })).toBe(
      'You are offline.'
    )
  })

  test('a blank host reason does not disable a choice without explanation', () => {
    expect(decisionReason({ ...base, disabledReason: '   ' })).toBeUndefined()
  })

  test('a missing handler is stated, never hidden', () => {
    expect(decisionReason({ ...base, hasHandler: false })).toBe('Not connected.')
  })

  test('unavailable without a reason still explains itself', () => {
    expect(decisionReason({ ...base, state: 'unavailable' })).toBe('Unavailable.')
  })
})
