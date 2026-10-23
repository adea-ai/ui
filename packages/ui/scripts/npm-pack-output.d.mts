export interface NpmPackEntry {
  filename: string
  files?: { path: string }[]
  [key: string]: unknown
}
export function parseNpmPackEntries(raw: string): NpmPackEntry[]
export function parseNpmPackEntry(raw: string): NpmPackEntry
