/**
 * Stable font-family choices shared by the appearance editor and its host APIs.
 *
 * This stays independent of the theme-token manifest so consumers that need
 * only font settings do not retain the palette catalogue.
 */
const FONT_OPTIONS = [
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    description: 'The self-hosted Space Grotesk family.',
    stack: 'both',
  },
  {
    id: 'system',
    label: 'System',
    description: "The platform's own interface family and system monospace counterpart.",
    stack: 'both',
  },
  {
    id: 'geist',
    label: 'Geist',
    description: 'The face cortana already ships. Neutral and wide.',
    stack: 'both',
  },
  {
    id: 'geist-mono',
    label: 'Geist Mono',
    description: 'Monospace throughout, for someone who wants a uniform texture.',
    stack: 'both',
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    description: 'Monospace throughout, with coding ligatures off.',
    stack: 'both',
  },
] as const

/** Stable catalogue record type; saved values never contain CSS family strings. */
export type FontOption = (typeof FONT_OPTIONS)[number]

export const fontOptions: readonly FontOption[] = Object.freeze(FONT_OPTIONS)
