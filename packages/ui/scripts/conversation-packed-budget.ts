/**
 * Absolute composed fixture ceiling. Re-baselined 54 → 63 KiB (2026-09) for the
 * `cn` swap: the config-extended merge runtime (`createCn(extend)`) ships cn's
 * compiler and default tables. Measured 61,916 gzip; the atomic increment below
 * is unchanged, because the engine delta cancels across the paired fixtures.
 */
export const MAX_COMPOSED_GZIP_BYTES = 63 * 1024

/**
 * Accepted headroom for the optional atomic editor over the paired plain fixture.
 * Re-baselined 6 → 6.5 KiB (2026-10) for the precompiled `cn` tables: the
 * generator's tooltip table fragments land in the editor-only closure, and the
 * paired fixtures measure the increment at 6,150 gzip where the composed
 * fixture itself dropped well under its ceiling.
 */
export const MAX_ATOMIC_INCREMENT_GZIP_BYTES = 6.5 * 1024

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
