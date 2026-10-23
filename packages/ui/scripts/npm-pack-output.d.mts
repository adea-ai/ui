export function parseNpmPackEntry(raw: string): {
  filename: string
  files?: { path: string }[]
  [key: string]: unknown
}
