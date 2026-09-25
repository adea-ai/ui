/**
 * The design system's token manifest.
 *
 * `theme.css` is the source of truth for token *values*. This file is the
 * source of truth for token *names and meaning* — what each one is for, and
 * which ones a theme may vary.
 *
 * It exists because a manifest that is only documentation rots. Two things read
 * it instead:
 *
 *   - the token galleries in Storybook, so the review surface shows every token
 *     rather than the ones an author remembered;
 *   - `tests/tokens.test.ts`, which parses `theme.css` and fails when a token
 *     is declared in one place and missing from the other.
 *
 * That pairing is what makes "every token is documented and every documented
 * token exists" a property the build enforces rather than a promise.
 */

import { ACCENTS } from '@adea-ai/themes'

export type TokenKind =
  | 'color'
  | 'dimension'
  | 'font-family'
  | 'number'
  | 'duration'
  | 'easing'
  | 'shadow'
  | 'text'

export type TokenDefinition = {
  /** The custom property name, without the leading `--`. */
  name: string
  kind: TokenKind
  /** One line: what this token is for. Shown in the gallery. */
  description: string
  /** True when the light and dark themes give it different values. */
  themed?: boolean
}

/**
 * Colour roles, in the order they appear in a page: surfaces first, then text,
 * then the lines between them, then the semantic fills. The order is the
 * documentation — reading the gallery top to bottom walks the surface ladder.
 */
export const colorTokens: TokenDefinition[] = [
  // Surfaces
  {
    name: 'background',
    kind: 'color',
    themed: true,
    description: 'The canvas every panel sits on.',
  },
  {
    name: 'foreground',
    kind: 'color',
    themed: true,
    description: 'Default body text on the canvas.',
  },
  {
    name: 'card',
    kind: 'color',
    themed: true,
    description: 'A panel or card raised one rung above the canvas.',
  },
  { name: 'card-foreground', kind: 'color', themed: true, description: 'Text on `card`.' },
  {
    name: 'popover',
    kind: 'color',
    themed: true,
    description: 'A floating surface: dialog, menu, popover, tooltip-free.',
  },
  { name: 'popover-foreground', kind: 'color', themed: true, description: 'Text on `popover`.' },
  {
    name: 'surface',
    kind: 'color',
    themed: true,
    description: 'Alias of `background`, for code that means "a surface" not "the page".',
  },
  {
    name: 'surface-sunken',
    kind: 'color',
    themed: true,
    description: 'A well: code blocks, inset lists, empty states.',
  },
  {
    name: 'surface-raised',
    kind: 'color',
    themed: true,
    description: 'Alias of `card`, for panels that sit on the canvas.',
  },
  {
    name: 'surface-overlay',
    kind: 'color',
    themed: true,
    description: 'Alias of `popover`, for floating layers.',
  },
  {
    name: 'surface-hover',
    kind: 'color',
    themed: true,
    description: 'The hover fill shared by rows, menu items and ghost controls.',
  },
  {
    name: 'surface-active',
    kind: 'color',
    themed: true,
    description: 'The pressed/selected fill, one rung past hover.',
  },
  {
    name: 'chrome',
    kind: 'color',
    themed: true,
    description: 'Window chrome: the top bar and its frosted fill.',
  },
  {
    name: 'chrome-alpha',
    kind: 'number',
    themed: true,
    description: 'Opacity of the chrome fill behind a blur.',
  },

  // The brand action
  {
    name: 'primary',
    kind: 'color',
    themed: true,
    description: 'The Adea emerald. The one primary action in a view.',
  },
  {
    name: 'primary-foreground',
    kind: 'color',
    themed: true,
    description: 'Label on `primary`. Black in dark, white in light — the accent flips polarity.',
  },
  {
    name: 'primary-hover',
    kind: 'color',
    themed: true,
    description: 'Hover rung for a primary action.',
  },
  {
    name: 'primary-subtle',
    kind: 'color',
    themed: true,
    description: 'Tinted primary fill: selected rows, focus rings, subtle buttons.',
  },

  {
    name: 'secondary',
    kind: 'color',
    themed: true,
    description: 'A quieter filled surface for a secondary action.',
  },
  {
    name: 'secondary-foreground',
    kind: 'color',
    themed: true,
    description: 'Label on `secondary`.',
  },
  {
    name: 'muted',
    kind: 'color',
    themed: true,
    description: 'A neutral fill: skeletons, inert chips, table footers.',
  },
  {
    name: 'muted-foreground',
    kind: 'color',
    themed: true,
    description: 'De-emphasised text. Measured to clear 4.5:1 on both `background` and `card`.',
  },
  {
    name: 'accent',
    kind: 'color',
    themed: true,
    description: "shadcn's hover-surface accent. Not the brand colour — that is `primary`.",
  },
  { name: 'accent-foreground', kind: 'color', themed: true, description: 'Text on `accent`.' },

  // Status
  {
    name: 'destructive',
    kind: 'color',
    themed: true,
    description: 'Irreversible or dangerous actions.',
  },
  {
    name: 'destructive-foreground',
    kind: 'color',
    themed: true,
    description: 'Label on `destructive`.',
  },
  {
    name: 'destructive-subtle',
    kind: 'color',
    themed: true,
    description: 'Tinted destructive fill: alert banners, invalid fields.',
  },
  { name: 'success', kind: 'color', themed: true, description: 'A completed or healthy state.' },
  { name: 'success-foreground', kind: 'color', themed: true, description: 'Label on `success`.' },
  { name: 'success-subtle', kind: 'color', themed: true, description: 'Tinted success fill.' },
  {
    name: 'warning',
    kind: 'color',
    themed: true,
    description: 'Something needs attention but is not broken.',
  },
  { name: 'warning-foreground', kind: 'color', themed: true, description: 'Label on `warning`.' },
  { name: 'warning-subtle', kind: 'color', themed: true, description: 'Tinted warning fill.' },
  { name: 'info', kind: 'color', themed: true, description: 'Neutral information.' },
  { name: 'info-foreground', kind: 'color', themed: true, description: 'Label on `info`.' },
  { name: 'info-subtle', kind: 'color', themed: true, description: 'Tinted info fill.' },

  // Lines
  {
    name: 'border',
    kind: 'color',
    themed: true,
    description: 'Every hairline: panel edges, dividers, card outlines.',
  },
  {
    name: 'input',
    kind: 'color',
    themed: true,
    description:
      'The edge of an editable control. A rung stronger than `border` so a field is findable.',
  },
  {
    name: 'ring',
    kind: 'color',
    themed: true,
    description: 'The focus ring. Always paired with `primary-subtle` as its glow.',
  },

  // Theme-invariant glass
  {
    name: 'scrim',
    kind: 'color',
    description: 'Dark glass for overlays and on-screen controls. Same in both themes.',
  },
  { name: 'scrim-foreground', kind: 'color', description: 'Text drawn on `scrim`.' },
  { name: 'scrim-edge', kind: 'color', description: 'The hairline drawn on `scrim`.' },

  // Diff and code
  { name: 'diff-add', kind: 'color', themed: true, description: 'Background of an added line.' },
  {
    name: 'diff-add-foreground',
    kind: 'color',
    themed: true,
    description: 'Text of an added line.',
  },
  {
    name: 'diff-delete',
    kind: 'color',
    themed: true,
    description: 'Background of a removed line.',
  },
  {
    name: 'diff-delete-foreground',
    kind: 'color',
    themed: true,
    description: 'Text of a removed line.',
  },
  { name: 'diff-hunk', kind: 'color', themed: true, description: 'Background of a hunk header.' },
  {
    name: 'diff-hunk-foreground',
    kind: 'color',
    themed: true,
    description: 'Text of a hunk header.',
  },
  {
    name: 'diff-meta-foreground',
    kind: 'color',
    themed: true,
    description: 'File headers and line numbers in a diff.',
  },

  // Charts
  {
    name: 'chart-1',
    kind: 'color',
    themed: true,
    description: 'Categorical series 1. The set is closed at six.',
  },
  { name: 'chart-2', kind: 'color', themed: true, description: 'Categorical series 2.' },
  { name: 'chart-3', kind: 'color', themed: true, description: 'Categorical series 3.' },
  { name: 'chart-4', kind: 'color', themed: true, description: 'Categorical series 4.' },
  { name: 'chart-5', kind: 'color', themed: true, description: 'Categorical series 5.' },
  { name: 'chart-6', kind: 'color', themed: true, description: 'Categorical series 6.' },

  // Sidebar (the shadcn contract, kept whole)
  {
    name: 'sidebar',
    kind: 'color',
    themed: true,
    description: 'The rail and sidebar surface, tinted against the canvas.',
  },
  {
    name: 'sidebar-foreground',
    kind: 'color',
    themed: true,
    description: 'Default text in the rail and sidebar.',
  },
  {
    name: 'sidebar-primary',
    kind: 'color',
    themed: true,
    description: 'The active destination in the rail.',
  },
  {
    name: 'sidebar-primary-foreground',
    kind: 'color',
    themed: true,
    description: 'Text on the active rail destination.',
  },
  {
    name: 'sidebar-accent',
    kind: 'color',
    themed: true,
    description: 'Hover and selected fill for rail and sidebar rows.',
  },
  {
    name: 'sidebar-accent-foreground',
    kind: 'color',
    themed: true,
    description: 'Text on `sidebar-accent`.',
  },
  {
    name: 'sidebar-border',
    kind: 'color',
    themed: true,
    description: 'The rule between the rail and the canvas.',
  },
  { name: 'sidebar-ring', kind: 'color', themed: true, description: 'Focus ring inside the rail.' },
  {
    name: 'sidebar-muted-foreground',
    kind: 'color',
    themed: true,
    description: 'Rail labels that are not the current destination.',
  },
]

export const radiusTokens: TokenDefinition[] = [
  {
    name: 'radius-lg',
    kind: 'dimension',
    description:
      '10px — cards and panels. Also the knob: move this one value to re-round the whole system.',
  },
  { name: 'radius-sm', kind: 'dimension', description: '6px — badges, keyboard keys, menu items.' },
  {
    name: 'radius-md',
    kind: 'dimension',
    description: '8px — every control: buttons, inputs, selects.',
  },
  { name: 'radius-xl', kind: 'dimension', description: '14px — dialogs, menus, sheets.' },
  { name: 'radius-2xl', kind: 'dimension', description: '18px — full-window surfaces and media.' },
]

export const typographyTokens: TokenDefinition[] = [
  {
    name: 'font-sans',
    kind: 'font-family',
    description: 'The selected interface face. Space Grotesk unless the font axis says otherwise.',
  },
  {
    name: 'font-mono',
    kind: 'font-family',
    description: 'The selected monospace face. Code, terminals, ids, paths.',
  },
  {
    name: 'font-family-space-grotesk',
    kind: 'font-family',
    description: 'The interface default, and the face the visual language was drawn against.',
  },
  {
    name: 'font-family-jetbrains-mono',
    kind: 'font-family',
    description: 'The monospace default. Code, terminals, diffs.',
  },
  {
    name: 'font-family-geist',
    kind: 'font-family',
    description: 'An alternative interface face. cortana already ships it.',
  },
  {
    name: 'font-family-geist-mono',
    kind: 'font-family',
    description: 'The monospace counterpart to Geist.',
  },
  {
    name: 'font-family-system',
    kind: 'font-family',
    description: "The platform's own interface face. First-class, not a fallback.",
  },
  {
    name: 'font-family-system-mono',
    kind: 'font-family',
    description: "The platform's own monospace face.",
  },
  {
    name: 'ui-tracking',
    kind: 'text',
    description:
      'Letter spacing for measured chrome. `normal` on a proportional face, tightened when the UI font is monospace — which is roughly 20% wider at the same size.',
  },
  {
    name: 'ui-word-spacing',
    kind: 'text',
    description:
      "Word spacing for measured chrome. Mono's space is a full advance-width cell, so a two-word label reads as two floating words without this.",
  },
  {
    name: 'text-2xs',
    kind: 'text',
    description: '11px — the smallest label the system permits: kbd keys, status bar.',
  },
  { name: 'text-xs', kind: 'text', description: '12px — metadata, badges, secondary rows.' },
  {
    name: 'text-sm',
    kind: 'text',
    description: '14px — the interface default. Body copy, labels, controls.',
  },
  { name: 'text-base', kind: 'text', description: '16px — card titles and dialog titles.' },
  { name: 'text-lg', kind: 'text', description: '18px — a section heading inside a page.' },
  { name: 'text-xl', kind: 'text', description: '20px — a page title.' },
  { name: 'text-2xl', kind: 'text', description: '24px — a display figure.' },
  {
    name: 'text-3xl',
    kind: 'text',
    description: '30px — the largest size in the system. Reserved for an empty-state headline.',
  },
]

export const densityTokens: TokenDefinition[] = [
  { name: 'control-height-2xs', kind: 'dimension', description: '20px — an inline chip control.' },
  { name: 'control-height-xs', kind: 'dimension', description: '24px — a dense table row action.' },
  { name: 'control-height-sm', kind: 'dimension', description: '28px — the toolbar default.' },
  {
    name: 'control-height-md',
    kind: 'dimension',
    description: '32px — the form default. Button and Input are this size unless told otherwise.',
  },
  { name: 'control-height-lg', kind: 'dimension', description: '36px — a primary form action.' },
  {
    name: 'control-height-xl',
    kind: 'dimension',
    description: '40px — a hero control in an empty state.',
  },
  {
    name: 'control-padding-2xs',
    kind: 'dimension',
    description: 'Inline padding that pairs with the 20px control.',
  },
  {
    name: 'control-padding-xs',
    kind: 'dimension',
    description: 'Inline padding that pairs with the 24px control.',
  },
  {
    name: 'control-padding-sm',
    kind: 'dimension',
    description: 'Inline padding that pairs with the 28px control.',
  },
  {
    name: 'control-padding-md',
    kind: 'dimension',
    description: 'Inline padding that pairs with the 32px control.',
  },
  {
    name: 'control-padding-lg',
    kind: 'dimension',
    description: 'Inline padding that pairs with the 36px control.',
  },
  {
    name: 'control-padding-xl',
    kind: 'dimension',
    description: 'Inline padding that pairs with the 40px control.',
  },
  { name: 'row-height-sm', kind: 'dimension', description: '28px — a dense list row.' },
  { name: 'row-height-md', kind: 'dimension', description: '32px — the default list row.' },
  { name: 'row-height-lg', kind: 'dimension', description: '36px — a two-line list row.' },
  { name: 'rail-width', kind: 'dimension', description: '58px — the icon-only rail.' },
  { name: 'rail-width-expanded', kind: 'dimension', description: '236px — the labelled rail.' },
  {
    name: 'rail-item-height',
    kind: 'dimension',
    description: '36px — a rail or sidebar destination.',
  },
  {
    name: 'sidebar-width',
    kind: 'dimension',
    description: '256px — the secondary navigation column.',
  },
  {
    name: 'sidebar-width-compact',
    kind: 'dimension',
    description: '48px — the collapsed secondary column.',
  },
  { name: 'topbar-height', kind: 'dimension', description: '48px — the window title row.' },
  { name: 'statusbar-height', kind: 'dimension', description: '28px — the bottom readout strip.' },
]

export const elevationTokens: TokenDefinition[] = [
  {
    name: 'shadow-2xs',
    kind: 'shadow',
    themed: true,
    description: 'Barely there: a chip resting on a card.',
  },
  {
    name: 'shadow-xs',
    kind: 'shadow',
    themed: true,
    description: 'A card or panel on the canvas.',
  },
  {
    name: 'shadow-sm',
    kind: 'shadow',
    themed: true,
    description: 'A control that lifts: a pressed toggle, a thumb.',
  },
  { name: 'shadow-md', kind: 'shadow', themed: true, description: 'A menu or popover.' },
  { name: 'shadow-lg', kind: 'shadow', themed: true, description: 'A dialog or sheet.' },
  {
    name: 'shadow-xl',
    kind: 'shadow',
    themed: true,
    description: 'The command palette, above everything.',
  },
]

export const motionTokens: TokenDefinition[] = [
  {
    name: 'duration-fast',
    kind: 'duration',
    description: '120ms — a state change the user is already watching.',
  },
  { name: 'duration-normal', kind: 'duration', description: '200ms — an entrance.' },
  { name: 'duration-slow', kind: 'duration', description: '320ms — a layout settle.' },
  {
    name: 'ease-out',
    kind: 'easing',
    description: 'A fast start and a long settle. Reads as decisive rather than floaty.',
  },
  {
    name: 'ease-in-out',
    kind: 'easing',
    description: 'For a loop that has no start or end, such as a shimmer.',
  },
]

export const zIndexTokens: TokenDefinition[] = [
  { name: 'z-base', kind: 'number', description: 'In flow, at the document order.' },
  {
    name: 'z-docked',
    kind: 'number',
    description: 'A sticky table header standing above its own scroll body.',
  },
  { name: 'z-sticky', kind: 'number', description: 'The top bar and any other pinned chrome.' },
  { name: 'z-drawer', kind: 'number', description: 'A drawer, below a modal dialog.' },
  { name: 'z-dialog', kind: 'number', description: 'A modal dialog and its scrim.' },
  {
    name: 'z-menu',
    kind: 'number',
    description: 'Menus, popovers and comboboxes. Above dialogs, because a dialog can contain one.',
  },
  {
    name: 'z-tooltip',
    kind: 'number',
    description: 'Tooltips. Above menus, because a menu item can carry one.',
  },
  {
    name: 'z-toast',
    kind: 'number',
    description: 'Notifications. Above everything, so they are never hidden by a dialog.',
  },
]

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
 * The font axis.
 *
 * The family is a selection, like the accent: `data-font` sits on the same element
 * and each option swaps the interface face. `space-grotesk` is the default because
 * it is the face the visual language was drawn against, and `system` is a
 * first-class option rather than a fallback — an application that wants the
 * platform's own face should be able to say so without losing the rest of the
 * system.
 */
export type FontOption = {
  /** The `data-font` value. `space-grotesk` is the default and needs no attribute. */
  id: string
  label: string
  description: string
  /** Which of the two stacks this option sets. */
  stack: 'sans' | 'mono' | 'both'
}

export const fontOptions: readonly FontOption[] = Object.freeze([
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    description: 'The default, and the face the visual language was drawn against.',
    stack: 'both',
  },
  {
    id: 'system',
    label: 'System',
    description: "The platform's own face. What a terminal or editor usually wants.",
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
])

/** Every token, in gallery order. */
export const designTokens = {
  color: colorTokens,
  radius: radiusTokens,
  typography: typographyTokens,
  density: densityTokens,
  elevation: elevationTokens,
  motion: motionTokens,
  zIndex: zIndexTokens,
} as const

/** Flat list, for completeness checks and for search. */
export const allTokens: TokenDefinition[] = Object.values(designTokens).flat()

/**
 * Aliases that exist only to make a call site read better, and which therefore
 * have no gallery row of their own. Kept explicit so the completeness check
 * below can tell "deliberately absent" from "forgotten".
 */
export const undocumentedTokenAliases: string[] = ['radius']
