import { boundText } from '../sources/source'

/**
 * The figures a host may know about a context window. Every one is optional and
 * means "the host told us", so absence is never rendered as zero: `used: 0` is a
 * fresh conversation, a missing `used` is an unknown.
 */
export type ContextBreakdown = Readonly<{
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  reasoning?: number
}>

export type ContextCost = Readonly<{
  amount: number
  /** An ISO 4217 code such as `USD`. Without one the amount is shown unlabelled. */
  currency?: string
}>

export type ContextFigures = Readonly<{
  /** Tokens in the window now. */
  used?: number
  /** The window's size. */
  total?: number
  breakdown?: ContextBreakdown
  cost?: ContextCost
}>

/** A usable figure: a finite, non-negative number. NaN, Infinity and negatives are "unknown". */
export function isFigure(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

const BREAKDOWN_ROWS = [
  ['input', 'Input'],
  ['output', 'Output'],
  ['cacheRead', 'Cache read'],
  ['cacheWrite', 'Cache write'],
  ['reasoning', 'Reasoning'],
] as const

/** The breakdown entries the host actually supplied, in a fixed reading order. */
export function breakdownRows(
  breakdown: ContextBreakdown | undefined
): readonly { key: string; label: string; value: number }[] {
  if (!breakdown) return []
  const rows: { key: string; label: string; value: number }[] = []
  for (const [key, label] of BREAKDOWN_ROWS) {
    const value = breakdown[key]
    if (isFigure(value)) rows.push({ key, label, value })
  }
  return rows
}

/**
 * Whether there is anything to show. When there is not, the trigger is not
 * rendered at all: an empty gauge or "0%" would assert an empty window.
 */
export function hasContextFigures(figures: ContextFigures): boolean {
  return (
    isFigure(figures.used) ||
    isFigure(figures.total) ||
    breakdownRows(figures.breakdown).length > 0 ||
    (figures.cost !== undefined && isFigure(figures.cost.amount))
  )
}

/**
 * Percentage of the window used, rounded. Needs both figures and a non-empty
 * window; it is not clamped, because "112%" is the truth about an overrun and a
 * clamp would hide it (the ring is what saturates, not the number).
 */
export function contextPercent(
  used: number | undefined,
  total: number | undefined
): number | undefined {
  if (!isFigure(used) || !isFigure(total) || total <= 0) return undefined
  return Math.round((used / total) * 100)
}

export type ContextLevel = 'normal' | 'high' | 'critical' | 'full'

/**
 * How full, in steps. The step changes an icon and a word as well as a colour, so
 * it reads without colour vision and in a screen reader.
 */
export function contextLevel(percent: number | undefined): ContextLevel {
  if (percent === undefined) return 'normal'
  if (percent >= 100) return 'full'
  if (percent >= 90) return 'critical'
  if (percent >= 75) return 'high'
  return 'normal'
}

export function contextLevelWord(level: ContextLevel): string | undefined {
  switch (level) {
    case 'high':
      return 'Getting full'
    case 'critical':
      return 'Nearly full'
    case 'full':
      return 'Full'
    case 'normal':
      return undefined
  }
}

/** Compact token count for the trigger: 950, 1.2K, 48.2K, 1.3M. */
export function formatTokens(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  )
}

/** The exact count for the popover. */
export function formatExact(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

/**
 * Money, with its currency symbol when the code is valid. An unrecognised code
 * (`Intl` throws a RangeError) is shown as written, bounded, rather than being
 * swapped for a currency the host never named.
 */
export function formatCost(cost: ContextCost, locale = 'en-US'): string {
  const digits = { minimumFractionDigits: 2, maximumFractionDigits: cost.amount < 1 ? 4 : 2 }
  if (!cost.currency) return new Intl.NumberFormat(locale, digits).format(cost.amount)
  try {
    return new Intl.NumberFormat(locale, {
      ...digits,
      style: 'currency',
      currency: cost.currency,
    }).format(cost.amount)
  } catch {
    return `${new Intl.NumberFormat(locale, digits).format(cost.amount)} ${boundText(cost.currency, 8)}`
  }
}

/**
 * The trigger's accessible name: the whole claim in words. Percent when both
 * figures are known, else the most informative thing that is.
 */
export function contextLabel(figures: ContextFigures, locale = 'en-US'): string | undefined {
  const percent = contextPercent(figures.used, figures.total)
  if (percent !== undefined) {
    const word = contextLevelWord(contextLevel(percent))
    return `${percent}% of context used${word ? `, ${word.toLowerCase()}` : ''}`
  }
  if (isFigure(figures.used)) return `${formatTokens(figures.used, locale)} tokens used`
  if (isFigure(figures.total)) return `${formatTokens(figures.total, locale)} token context window`
  if (breakdownRows(figures.breakdown).length > 0) return 'Token usage'
  if (figures.cost && isFigure(figures.cost.amount))
    return `Cost ${formatCost(figures.cost, locale)}`
  return undefined
}

/** The short visible text inside the trigger. Always a prefix-compatible part of `contextLabel`. */
export function contextShort(figures: ContextFigures, locale = 'en-US'): string | undefined {
  const percent = contextPercent(figures.used, figures.total)
  if (percent !== undefined) return `${percent}%`
  if (isFigure(figures.used)) return formatTokens(figures.used, locale)
  if (isFigure(figures.total)) return formatTokens(figures.total, locale)
  if (breakdownRows(figures.breakdown).length > 0) return 'Usage'
  if (figures.cost && isFigure(figures.cost.amount)) return formatCost(figures.cost, locale)
  return undefined
}
