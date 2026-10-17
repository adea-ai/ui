import { boundText, sourceHost, sourceTitle, type Source } from '../sources/source'

/** Characters of a host or title that fit in a badge before it is clipped. */
const LABEL_LIMIT = 24

/**
 * The text on a citation badge.
 *
 * A 1-based `index` wins, because a number is what the sentence's own markers
 * and the Sources list use. Without one the badge shows the source's host (read
 * from the parsed URL, so it cannot be spoofed by a title), then a clipped title,
 * and only then a neutral word — never an invented number.
 */
export function citationLabel(index: number | undefined, source: Source | undefined): string {
  if (index !== undefined && Number.isInteger(index) && index >= 1 && index <= 9999) {
    return String(index)
  }
  if (source === undefined) return 'source'
  const host = sourceHost(source.url)
  if (host !== undefined) return boundText(host, LABEL_LIMIT)
  return boundText(source.title, LABEL_LIMIT) || 'source'
}

/**
 * The badge's accessible name. The visible label is a number or a host, which
 * says nothing on its own, so the name carries the title and host: a screen-reader
 * or voice-control user learns what is cited without opening the popover.
 */
export function citationName(sources: readonly Source[], index: number | undefined): string {
  const first = sources[0]
  if (first === undefined) return 'Citation'
  const label = citationLabel(index, first)
  if (sources.length > 1) return `Sources ${label} and ${sources.length - 1} more`
  const host = sourceHost(first.url)
  const title = sourceTitle(first)
  return host !== undefined && host !== title
    ? `Source ${label}: ${title}, ${host}`
    : `Source ${label}: ${title}`
}

/** Wrap a position into 0..count-1, so Previous on the first source goes to the last. */
export function wrapIndex(position: number, count: number): number {
  if (count <= 0) return 0
  return ((position % count) + count) % count
}

/**
 * How a citation's popover is open.
 *
 * - `peek` is a hover or keyboard-focus preview: it does not take focus, and it
 *   goes away when the pointer or focus does.
 * - `pinned` is a deliberate open (click, tap, Enter, Space): focus moves into
 *   the popover so its link and Previous/Next are reachable, and it stays until
 *   Escape, an outside press, or the badge is pressed again.
 *
 * A popover that only opened on hover would exclude keyboard and touch readers;
 * one that only opened on press would make pointer users click to glance at a
 * source. This is the smallest model that serves both, and it is a pure function
 * so the awkward transitions (hover then click must pin, not toggle shut) are
 * tested rather than argued about.
 */
export type CitationMode = 'closed' | 'peek' | 'pinned'
export type CitationEvent = 'enter' | 'leave' | 'focus' | 'blur' | 'press' | 'dismiss'

export function nextCitationMode(mode: CitationMode, event: CitationEvent): CitationMode {
  switch (event) {
    case 'press':
      return mode === 'pinned' ? 'closed' : 'pinned'
    case 'dismiss':
      return 'closed'
    case 'enter':
    case 'focus':
      return mode === 'closed' ? 'peek' : mode
    case 'leave':
    case 'blur':
      return mode === 'peek' ? 'closed' : mode
  }
}
