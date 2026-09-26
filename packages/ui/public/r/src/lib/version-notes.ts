/**
 * Version notes, as text.
 *
 * A release changelog arrives as markdown and is shown to a reader who wants to
 * know what changed, not to a renderer. Rendering it would mean a markdown
 * dependency, a sanitiser, and a typographic result that competes with the
 * dialog's own type scale — so the markup is stripped to its words instead.
 *
 * The order matters: images and links are unwrapped to their alt text and label
 * *before* the emphasis rules run, because `[a](b)` contains brackets and
 * parentheses that the later patterns would otherwise trip on.
 */
export function plainTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^[ \t]*---+[ \t]*$/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/^[ \t]*\d+\.[ \t]+/gm, '')
    .replace(/```[^\n]*\n?/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * A release date, formatted for a reader. Returns the input when it cannot be
 * parsed — a date a build tool wrote in an unusual format is still better shown
 * verbatim than dropped.
 */
export function formatReleaseDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * Bytes as a reader-facing size. Used by the update dialog's progress readout,
 * where the number is reassurance rather than data — "12.4 MB of 48.1 MB" says
 * the download is moving, which a percentage alone does not.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['kB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}
