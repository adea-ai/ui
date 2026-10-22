// Regression for the Packed conversation gate's browser-death diagnosis.
//
// A WebKit process that dies mid-interaction leaves Playwright with one opaque
// line ("Target page, context or browser has been closed") and an empty log, so
// the gate used to fail without saying which leg lost the browser. A renderer
// that dies is reported the same way, as "Target crashed". These cases pin
// both diagnoses, and — just as importantly — pin that nothing else about the
// gate's outcome changes.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  describeBrowserGoneFailure,
  isBrowserGoneError,
  isTargetCrashedError,
} from './packed-browser-gone.mjs'

const browserGone = new Error('evaluate: Target page, context or browser has been closed')
const rendererCrashed = new Error('evaluate: Target crashed ')

test('a browser process that went away is recognised', () => {
  assert.equal(isBrowserGoneError(browserGone), true)
  assert.equal(isBrowserGoneError(new Error('browser has been closed')), true)
  assert.equal(
    isBrowserGoneError(new Error('Protocol error (Runtime.evaluate): Target closed.')),
    true
  )
  // A message that merely mentions a closed target is not a browser death.
  assert.equal(isBrowserGoneError(new Error('Packed composed exceeds its gzip JS budget')), false)
  assert.equal(isBrowserGoneError(new Error('Packed conversation lost its module graph')), false)
  assert.equal(isBrowserGoneError(undefined), false)
})

test('a renderer that crashed is recognised as its own failure', () => {
  assert.equal(isTargetCrashedError(rendererCrashed), true)
  // A crashed target is not a closed one: the engine may still be running with no
  // page left to talk to, which is a different thing to report.
  assert.equal(isBrowserGoneError(rendererCrashed), false)
  assert.equal(isTargetCrashedError(browserGone), false)
  assert.equal(isTargetCrashedError(new Error('Packed composed exceeds its gzip JS budget')), false)
})

test('the failure names the leg that lost the browser', () => {
  const named = describeBrowserGoneFailure('composed', 'solid', 'webkit', browserGone)
  assert.ok(named instanceof Error)
  assert.match(named.message, /Packed composed\/solid\/webkit/)
  assert.match(named.message, /the browser process went away mid-interaction/)
  // The run is inconclusive; it never claims the packed contract was proven.
  assert.match(named.message, /the packed contract is unproven in this run/)
  assert.doesNotMatch(named.message, /passed|proven contract|verified/i)
})

test('a crashed renderer is named as a renderer crash, not as a lost browser', () => {
  const named = describeBrowserGoneFailure('atomic', 'solid', 'webkit', rendererCrashed)
  assert.ok(named instanceof Error)
  assert.match(named.message, /Packed atomic\/solid\/webkit/)
  assert.match(named.message, /the page's renderer crashed mid-interaction/)
  // The two failures are named apart: a crash is not a browser that went away.
  assert.doesNotMatch(named.message, /browser process went away/)
  assert.match(named.message, /the packed contract is unproven in this run/)
  assert.doesNotMatch(named.message, /passed|proven contract|verified/i)
  // The original failure is still the cause.
  assert.equal(named.cause, rendererCrashed)
})

test("the original failure is kept as the cause, so Playwright's detail is not lost", () => {
  const named = describeBrowserGoneFailure('composed', 'solid', 'webkit', browserGone)
  assert.equal(named.cause, browserGone)
  assert.match(named.cause.message, /Target page, context or browser has been closed/)
})

test('every other failure is returned unchanged', () => {
  // The gate fails closed on everything else; the diagnosis must not reshape it.
  for (const error of [
    new Error('Packed composed exceeds its gzip JS budget'),
    new Error('Packed conversation lost its module graph'),
    new Error('Packed atomic is missing its composed baseline'),
  ]) {
    assert.equal(describeBrowserGoneFailure('composed', 'solid', 'webkit', error), error)
  }
  const notAnError = 'a thrown string'
  assert.equal(describeBrowserGoneFailure('composed', 'solid', 'webkit', notAnError), notAnError)
})
