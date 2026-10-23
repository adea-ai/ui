/**
 * Reads the report `npm pack --json` prints on stdout.
 *
 * npm up to 11 prints an array with one entry per packed package. npm 12 (the
 * one Node 24.18 ships) prints an object keyed by package name instead, so a
 * bare `const [archive] = JSON.parse(...)` throws `{} is not iterable` before a
 * packed gate has launched anything. An entry is the object that names the
 * tarball in a string `filename`; the report may be an array of entries, one
 * entry, or an object keyed by package name.
 */
function isEntry(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (/** @type {{ filename?: unknown }} */ (value).filename) === 'string' &&
    /** @type {{ filename: string }} */ (value).filename !== ''
  )
}

function reportCandidates(raw) {
  const report = JSON.parse(raw)
  return Array.isArray(report)
    ? report
    : isEntry(report)
      ? [report]
      : typeof report === 'object' && report !== null
        ? Object.values(report)
        : []
}

/**
 * Every entry of the report, in order. Strict: one element that names no
 * tarball rejects the whole report, so a gate that demands exactly one archive
 * cannot be satisfied by a malformed second entry being dropped.
 */
export function parseNpmPackEntries(raw) {
  const candidates = reportCandidates(raw)
  if (candidates.length === 0 || !candidates.every(isEntry))
    throw new Error('npm pack did not report an artifact filename')
  return candidates
}

/** The first entry that names a tarball; other malformed entries are ignored. */
export function parseNpmPackEntry(raw) {
  const entry = reportCandidates(raw).find(isEntry)
  if (!entry) throw new Error('npm pack did not report an artifact filename')
  return entry
}
