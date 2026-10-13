/**
 * Pure analysis of a bundle's chunk graph for the theme start-up gate
 * (`check-theme-startup.ts`).
 *
 * "Start-up" is what a browser fetches before the first screen: the entry chunk and
 * everything it imports *statically*. A chunk reached only through `import()` is
 * deferred, which is exactly where the theme catalogue must be for a host that opts
 * into the lazy provider.
 */

export type BundleChunk = {
  fileName: string
  code: string
  isEntry: boolean
  /** Chunks this one imports statically. */
  imports: readonly string[]
  /** Chunks this one imports with `import()`. */
  dynamicImports: readonly string[]
}

export type StartupReport = {
  /** Chunks fetched before the first screen, entry first. */
  startup: BundleChunk[]
  /** Chunks reachable only through a dynamic import. */
  deferred: BundleChunk[]
  startupRaw: number
  startupGzip: number
  /** Markers found in start-up chunks. */
  leaked: string[]
  /** Markers not found in any deferred chunk (the catalogue went missing, not just away). */
  missingFromDeferred: string[]
}

/** The static closure of the entry chunks, then everything else. */
export function analyzeStartup(
  chunks: readonly BundleChunk[],
  markers: readonly string[],
  gzipSize: (code: string) => number
): StartupReport {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
  const startup: BundleChunk[] = []
  const seen = new Set<string>()
  const queue = chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName)
  while (queue.length > 0) {
    const name = queue.shift()!
    if (seen.has(name)) continue
    seen.add(name)
    const chunk = byName.get(name)
    if (!chunk) continue
    startup.push(chunk)
    queue.push(...chunk.imports)
  }
  const deferred = chunks.filter((chunk) => !seen.has(chunk.fileName))
  const startupCode = startup.map((chunk) => chunk.code).join('\n')
  return {
    startup,
    deferred,
    startupRaw: Buffer.byteLength(startupCode),
    startupGzip: gzipSize(startupCode),
    leaked: markers.filter((marker) => startupCode.includes(marker)),
    missingFromDeferred: markers.filter(
      (marker) => !deferred.some((chunk) => chunk.code.includes(marker))
    ),
  }
}
