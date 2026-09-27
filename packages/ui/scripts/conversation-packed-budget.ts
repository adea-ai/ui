/** Absolute composed fixture ceiling remains unchanged from its accepted baseline. */
export const MAX_COMPOSED_GZIP_BYTES = 54 * 1024

/** Accepted headroom for the optional atomic editor over the paired plain fixture. */
export const MAX_ATOMIC_INCREMENT_GZIP_BYTES = 6 * 1024

export function assertComposedGzipBudget(gzipBytes: number): void {
  if (gzipBytes > MAX_COMPOSED_GZIP_BYTES)
    throw new Error('Packed composed exceeds its gzip JS budget')
}

/**
 * Compare the actual atomic fixture to the same-condition composed fixture.
 * Common modules are retained by both fixtures and therefore excluded from this delta.
 */
export function assertAtomicIncrementBudget(
  plainGzipBytes: number,
  atomicGzipBytes: number
): number {
  const increment = atomicGzipBytes - plainGzipBytes
  if (increment > MAX_ATOMIC_INCREMENT_GZIP_BYTES)
    throw new Error('Atomic packed fixture exceeds its incremental gzip JS budget')
  return increment
}
