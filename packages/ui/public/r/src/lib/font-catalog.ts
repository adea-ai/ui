/**
 * Stable font-family choices shared by the appearance editor and its host APIs.
 *
 * This stays independent of the theme-token manifest so consumers that need
 * only font settings do not retain the palette catalogue.
 */
// Explicit catalogue choices resolve to the same named face in every role.
// System Code is the exception: it resolves to the platform monospace stack.
const FONT_OPTIONS = [
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    description: 'The self-hosted Space Grotesk family.',
    familyVariables: {
      ui: '--font-family-space-grotesk',
      content: '--font-family-space-grotesk',
      code: '--font-family-space-grotesk',
    },
    uiTracking: 'normal',
    uiWordSpacing: 'normal',
    stack: 'both',
  },
  {
    id: 'system',
    label: 'System',
    description: "The platform's own interface family and system monospace counterpart.",
    familyVariables: {
      ui: '--font-family-system',
      content: '--font-family-system',
      code: '--font-family-system-mono',
    },
    uiTracking: 'normal',
    uiWordSpacing: 'normal',
    stack: 'both',
  },
  {
    id: 'geist',
    label: 'Geist',
    description: 'The face cortana already ships. Neutral and wide.',
    familyVariables: {
      ui: '--font-family-geist',
      content: '--font-family-geist',
      code: '--font-family-geist',
    },
    uiTracking: 'normal',
    uiWordSpacing: 'normal',
    stack: 'both',
  },
  {
    id: 'geist-mono',
    label: 'Geist Mono',
    description: 'Monospace throughout, for someone who wants a uniform texture.',
    familyVariables: {
      ui: '--font-family-geist-mono',
      content: '--font-family-geist-mono',
      code: '--font-family-geist-mono',
    },
    uiTracking: '-0.03em',
    uiWordSpacing: '-1.5px',
    stack: 'both',
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    description: 'Monospace throughout, with coding ligatures off.',
    familyVariables: {
      ui: '--font-family-jetbrains-mono',
      content: '--font-family-jetbrains-mono',
      code: '--font-family-jetbrains-mono',
    },
    uiTracking: '-0.04em',
    uiWordSpacing: '-2.5px',
    stack: 'both',
  },
] as const

/** Stable catalogue record type; saved values never contain CSS family strings. */
export type FontOption = (typeof FONT_OPTIONS)[number]

export const fontOptions: readonly FontOption[] = Object.freeze(FONT_OPTIONS)
