import { safeHref } from '../../ui/message/parse-message-text'

/**
 * What a reply drew on.
 *
 * Every field except `title` is optional because a source is only as much as the
 * host knew: a search result has a snippet, a file has no URL, a tool result has
 * neither. Nothing is inferred from what is missing, and two entries that share a
 * URL stay two entries — the host may have cited two passages of one page, and a
 * list that quietly merged them would also renumber every citation after it.
 */
export type Source = Readonly<{
  /** A stable key for streaming updates. Falls back to position. */
  id?: string
  title: string
  url?: string
  snippet?: string
}>

/** Titles and snippets come from the open web; these keep one of them from owning the layout. */
export const SOURCE_TITLE_LIMIT = 160
export const SOURCE_SNIPPET_LIMIT = 480

// C0 controls other than tab and newline, DEL, and the bidirectional marks,
// overrides and isolates: the last group is how a title can be made to read as a
// different string than the one that is stored. Tested by code point rather than
// by a regular expression so no control or invisible character appears in this file.
function isHidden(code: number): boolean {
  return (
    code <= 0x08 ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f) ||
    code === 0x7f ||
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  )
}

function stripHidden(value: string): string {
  let out = ''
  for (let index = 0; index < value.length; index += 1) {
    if (!isHidden(value.charCodeAt(index))) out += value.charAt(index)
  }
  return out
}

/**
 * Untrusted text, made safe to lay out: hidden and direction-overriding
 * characters removed, runs of whitespace (including newlines) collapsed to one
 * space, and clipped to `limit` with an ellipsis. It is still only ever rendered
 * as a text node — this is about length and spoofing, not escaping.
 */
export function boundText(value: string, limit: number): string {
  // Clip before the regex passes so a multi-megabyte value costs a slice, not a scan.
  const head = value.length > limit * 4 ? value.slice(0, limit * 4) : value
  const clean = stripHidden(head).replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return clean
  const clipped = clean.slice(0, limit)
  // Never end on half of a surrogate pair: it renders as a replacement glyph.
  const last = clipped.charCodeAt(clipped.length - 1)
  const whole = last >= 0xd800 && last <= 0xdbff ? clipped.slice(0, -1) : clipped
  return `${whole.trimEnd()}…`
}

/**
 * A URL a link may point at: `http:`, `https:` or `mailto:`, no embedded
 * credentials. `safeHref` (the message parser's own gate) already refuses other
 * schemes, whitespace and control characters and over-long values; credentials are
 * refused here as well because `https://trusted.example@evil.example/` shows a
 * host that is not the one the link goes to.
 */
export function safeSourceUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const href = safeHref(value)
  if (href === undefined) return undefined
  try {
    const url = new URL(href)
    if (url.username !== '' || url.password !== '') return undefined
  } catch {
    return undefined
  }
  return href
}

/**
 * The host to show beside a title, taken from the parsed URL (so an
 * internationalised name appears in its `xn--` form and a look-alike cannot pass
 * for the real one). A mailto source shows its address. Undefined when the URL is
 * absent or unsafe: nothing is guessed.
 */
export function sourceHost(value: string | undefined): string | undefined {
  const href = safeSourceUrl(value)
  if (href === undefined) return undefined
  try {
    const url = new URL(href)
    if (url.protocol === 'mailto:') {
      return boundText(decodeURIComponent(url.pathname), 80) || undefined
    }
    return url.hostname || undefined
  } catch {
    return undefined
  }
}

/** The line a collapsed list shows. One source is singular; the count is the list's length. */
export function sourcesLabel(count: number): string {
  return `Used ${count} ${count === 1 ? 'source' : 'sources'}`
}

/** What to call a source: its title, else its host, else an honest placeholder. */
export function sourceTitle(source: Source): string {
  return boundText(source.title, SOURCE_TITLE_LIMIT) || sourceHost(source.url) || 'Untitled source'
}
