import { ACCENTS } from '@adea-ai/themes'

/*
 * Its own module so the theme provider's start-up path (the stored-preference reader
 * and the boot script both need the preset ids) does not import the token manifest in
 * `tokens.ts`, which is 20 KB of documentation data a provider never reads.
 * `tokens.ts` re-exports `accentPresets` and `AccentPreset`, and `themes.ts` re-exports
 * `accents`, so every existing import keeps working.
 */

/**
 * The accent axis.
 *
 * adea's accent presets, as a selection rather than a constant. `theme` is the
 * default and means "the variant's own primary" — monochrome in adea's palette —
 * and each named preset overrides the interactive roles through the
 * `[data-accent]` blocks in `theme.css`.
 *
 * These are the same six presets `accentPresets` exports in adea's own
 * `appearance.ts`, and the values match. A consumer's appearance picker and the
 * workshop's theme toolbar read this one list, so the two cannot disagree about
 * what a preset is called or what colour it is.
 */
export type AccentPreset = {
  /** The `data-accent` value. `theme` is the variant's own primary. */
  id: string
  label: string
  /** What the preset is for, in the gallery and in a picker. */
  description: string
  /** The accent as it appears in the light theme. Absent for `theme`. */
  light?: string
  /** The accent as it appears in the dark theme. Absent for `theme`. */
  dark?: string
}

export const accentPresets: readonly AccentPreset[] = Object.freeze([
  {
    id: 'theme',
    label: 'Theme',
    description:
      "The variant's own primary. Neutral in adea's palette, so the interface stays monochrome.",
  },
  ...ACCENTS,
])

/**
 * The six brand accent presets, in the order a picker should show them: the list
 * `accentPresets` carries after its own `theme` entry.
 *
 * Here and not beside the theme table in `lib/themes.ts` (which re-exports it, so
 * `@adea-ai/ui/lib/themes` still has it) because a bundler places a module whole, and
 * a host that wants only the list should not ship the 34-theme catalogue with it.
 */
export const accents = ACCENTS
