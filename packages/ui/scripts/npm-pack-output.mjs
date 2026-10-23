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

export function parseNpmPackEntry(raw) {
  const report = JSON.parse(raw)
  const candidates = Array.isArray(report)
    ? report
    : isEntry(report)
      ? [report]
      : typeof report === 'object' && report !== null
        ? Object.values(report)
        : []
  const entry = candidates.find(isEntry)
  if (!entry) throw new Error('npm pack did not report an artifact filename')
  return entry
}
