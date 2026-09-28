import { describe, expect, test } from 'bun:test'
import {
  assertAtomicIncrementBudget,
  assertComposedGzipBudget,
  MAX_ATOMIC_INCREMENT_GZIP_BYTES,
  MAX_COMPOSED_GZIP_BYTES,
} from '../scripts/conversation-packed-budget'

describe('packed conversation size budgets', () => {
  test('keeps the composed fixture ceiling at its re-baselined 63 KiB', () => {
    expect(MAX_COMPOSED_GZIP_BYTES).toBe(63 * 1024)
    expect(() => assertComposedGzipBudget(MAX_COMPOSED_GZIP_BYTES)).not.toThrow()
    expect(() => assertComposedGzipBudget(MAX_COMPOSED_GZIP_BYTES + 1)).toThrow(
      /Packed composed exceeds its gzip JS budget/
    )
  })

  test('caps only the atomic feature increment over the paired composed fixture', () => {
    expect(MAX_ATOMIC_INCREMENT_GZIP_BYTES).toBe(6 * 1024)
    expect(assertAtomicIncrementBudget(53_650, 53_650 + MAX_ATOMIC_INCREMENT_GZIP_BYTES)).toBe(
      MAX_ATOMIC_INCREMENT_GZIP_BYTES
    )
    expect(() =>
      assertAtomicIncrementBudget(53_650, 53_650 + MAX_ATOMIC_INCREMENT_GZIP_BYTES + 1)
    ).toThrow(/Atomic packed fixture exceeds its incremental gzip JS budget/)
  })
})
