/**
 * The theme registry.
 *
 * A theme in this system is more than a colour scheme: it carries the surface and
 * text roles, the **terminal's sixteen ANSI colours**, the **editor's syntax
 * roles**, and the chart series. A palette that only sets a background and a
 * foreground leaves the terminal and the code view to invent their own, which is
 * how a diff ends up unreadable inside an otherwise carefully themed app. This
 * shape is adea's, kept deliberately — `packages/ui/src/components/appearance.ts`
 * in the product declares the same roles, and the two must agree.
 *
 * ## Why the catalogue is data rather than CSS
 *
 * Every variant is an object. The provider writes a selected variant's roles onto
 * the document as custom properties, and `theme.css` holds only the default so the
 * first paint is correct before any script runs. The alternative — a `[data-theme]`
 * block per variant — would be several hundred lines of CSS that the validator
 * cannot check and a settings UI cannot read.
 *
 * ## Sourcing
 *
 * The professional sets are **other people's palettes**, used as published. That is
 * the point: a hand-authored palette is a palette nobody maintains, while
 * Catppuccin, Nord, Gruvbox and the rest are maintained by people who care about
 * them, versioned, and permissively licensed. Each variant records where it came
 * from and under what licence, and `validateThemeRegistry` is the gate — a palette
 * either clears the contrast floors or it is rejected with the reason.
 */

export type ThemeAppearance = 'light' | 'dark'

/**
 * The surface and text roles a theme owns.
 *
 * Named to match the shadcn vocabulary the components already use, so applying a
 * variant is a rename rather than a translation layer.
 */
export type ThemeColors = {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  success: string
  warning: string
  info: string
  border: string
  input: string
  ring: string
  sidebar: string
  sidebarForeground: string
  sidebarAccent: string
  sidebarBorder: string
}

/** The sixteen ANSI colours a terminal needs, plus its four surface roles. */
export type ThemeTerminalPalette = {
  background: string
  foreground: string
  cursor: string
  selection: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

/** The syntax roles a code view needs. */
export type ThemeEditorPalette = {
  keyword: string
  string: string
  number: string
  comment: string
  function: string
  variable: string
  type: string
  tag: string
  attribute: string
  operator: string
  heading: string
  link: string
  diffAdd: string
  diffDelete: string
  diffHunk: string
  searchMatch: string
}

/** Where a palette came from, and the terms it is used under. */
export type ThemeProvenance = {
  /** The project or person the palette belongs to. */
  source: string
  url: string
  /** An SPDX identifier. Every palette in this catalogue is permissive. */
  license: string
}

export type ThemeVariant = {
  /** The `data-theme` value and the id a preference stores. */
  id: string
  /** Groups the variants that came from one project. */
  family: string
  familyLabel: string
  label: string
  appearance: ThemeAppearance
  /** One line, shown in a picker. */
  description: string
  colors: ThemeColors
  terminal: ThemeTerminalPalette
  editor: ThemeEditorPalette
  /** The categorical series, in order. */
  chart: readonly string[]
  provenance: ThemeProvenance
}

/** Relative luminance of a hex colour, for the contrast checks below. */
function luminance(hex: string): number | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return undefined
  const value = match[1] ?? ''
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const [r, g, b] = channels as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number | undefined {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === undefined || lb === undefined) return undefined
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/* ---------------------------------------------------------------------------
 * The catalogue
 *
 * `adea` is the default and the product's own; everything else is imported.
 * ------------------------------------------------------------------------- */

const ADEA_PROVENANCE: ThemeProvenance = {
  source: 'Adea',
  url: 'https://github.com/adea-ai/adea',
  license: 'Apache-2.0',
}

/**
 * adea's terminal and editor roles for the default light variant.
 *
 * These are the values the product already ships, kept verbatim: the terminal
 * palette is GitHub's light scheme and the syntax roles are GitHub's, which is
 * what the code view was drawn against.
 */
const ADEA_TERMINAL_LIGHT: ThemeTerminalPalette = {
  background: '#ffffff',
  foreground: '#1b1f24',
  cursor: '#24292f',
  selection: '#b6c7ff',
  black: '#1b1f24',
  red: '#b91c1c',
  green: '#116a2e',
  yellow: '#8a5a1b',
  blue: '#0b57d0',
  magenta: '#a0186f',
  cyan: '#0e7490',
  white: '#57606a',
  brightBlack: '#57606a',
  brightRed: '#c94d4d',
  brightGreen: '#1f9d4f',
  brightYellow: '#a9752c',
  brightBlue: '#3b82f6',
  brightMagenta: '#c04a92',
  brightCyan: '#0891b2',
  brightWhite: '#24292f',
}

const ADEA_TERMINAL_DARK: ThemeTerminalPalette = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#e6edf3',
  selection: '#264f78',
  black: '#2f3742',
  red: '#ff8183',
  green: '#56d364',
  yellow: '#e3b341',
  blue: '#6ca4f8',
  magenta: '#db61a2',
  cyan: '#39c5cf',
  white: '#d5dde5',
  brightBlack: '#57606a',
  brightRed: '#ff9494',
  brightGreen: '#79dd8a',
  brightYellow: '#f0c264',
  brightBlue: '#8db9ff',
  brightMagenta: '#e87cb4',
  brightCyan: '#66d3dc',
  brightWhite: '#eef2f6',
}

const ADEA_EDITOR_LIGHT: ThemeEditorPalette = {
  keyword: '#0b57d0',
  string: '#116a2e',
  number: '#8a5a1b',
  comment: '#57606a',
  function: '#a0186f',
  variable: '#1b1f24',
  type: '#0e7490',
  tag: '#b91c1c',
  attribute: '#8a5a1b',
  operator: '#1b1f24',
  heading: '#1b1f24',
  link: '#0b57d0',
  diffAdd: '#116a2e',
  diffDelete: '#b91c1c',
  diffHunk: '#57606a',
  searchMatch: '#8a5a1b',
}

const ADEA_EDITOR_DARK: ThemeEditorPalette = {
  keyword: '#6ca4f8',
  string: '#56d364',
  number: '#e3b341',
  comment: '#8b949e',
  function: '#db61a2',
  variable: '#e6edf3',
  type: '#39c5cf',
  tag: '#ff8183',
  attribute: '#e3b341',
  operator: '#e6edf3',
  heading: '#e6edf3',
  link: '#6ca4f8',
  diffAdd: '#56d364',
  diffDelete: '#ff8183',
  diffHunk: '#8b949e',
  searchMatch: '#e3b341',
}

/**
 * A theme whose terminal and editor roles are derived from its own surface and
 * accent roles, for an imported palette that only publishes a colour scheme.
 *
 * Deliberately derived rather than invented: a terminal that keeps the palette's
 * background and foreground, and takes its ANSI hues from the palette's own
 * accents, is recognisably the same theme. Writing sixteen new hex values by hand
 * would make it a different theme wearing the same name.
 */
function terminalFrom(
  background: string,
  foreground: string,
  cursor: string,
  selection: string,
  ansi: readonly [string, string, string, string, string, string, string, string],
  bright: readonly [string, string, string, string, string, string, string, string]
): ThemeTerminalPalette {
  return {
    background,
    foreground,
    cursor,
    selection,
    black: ansi[0],
    red: ansi[1],
    green: ansi[2],
    yellow: ansi[3],
    blue: ansi[4],
    magenta: ansi[5],
    cyan: ansi[6],
    white: ansi[7],
    brightBlack: bright[0],
    brightRed: bright[1],
    brightGreen: bright[2],
    brightYellow: bright[3],
    brightBlue: bright[4],
    brightMagenta: bright[5],
    brightCyan: bright[6],
    brightWhite: bright[7],
  }
}

function editorFrom(
  roles: Partial<ThemeEditorPalette> & Pick<ThemeEditorPalette, 'keyword' | 'string' | 'comment'>
): ThemeEditorPalette {
  return {
    number: roles.keyword,
    function: roles.keyword,
    variable: roles.comment,
    type: roles.string,
    tag: roles.keyword,
    attribute: roles.number ?? roles.keyword,
    operator: roles.comment,
    heading: roles.comment,
    link: roles.keyword,
    diffAdd: roles.string,
    diffDelete: roles.keyword,
    diffHunk: roles.comment,
    searchMatch: roles.number ?? roles.keyword,
    ...roles,
  }
}

/* ---------------------------------------------------------------------------
 * A helper for the imported sets.
 *
 * Each of them publishes a well-known set of roles, and mapping those onto this
 * system's role list is the whole of the work. Spelling the mapping once means an
 * imported theme cannot half-adopt the system's vocabulary.
 * ------------------------------------------------------------------------- */
function variant(input: {
  id: string
  family: string
  familyLabel: string
  label: string
  appearance: ThemeAppearance
  description: string
  provenance: ThemeProvenance
  colors: ThemeColors
  terminal: ThemeTerminalPalette
  editor: ThemeEditorPalette
  chart: readonly string[]
}): ThemeVariant {
  return input
}

/**
 * A label is chosen by measurement, never by convention.
 *
 * adea's `deriveAccentRoles` does this for an accent selection, and every imported
 * palette needs the same treatment: a fill's label is black or white depending on
 * which one wins on contrast, and hand-picking it per theme is how a catalogue ends
 * up with six palettes whose destructive buttons are unreadable. The first revision
 * of this file hand-picked them, and the validator found nine that were wrong.
 */
function bestLabelOn(fill: string): string {
  const black = contrastRatio('#000000', fill) ?? 0
  const white = contrastRatio('#ffffff', fill) ?? 0
  return black >= white ? '#000000' : '#ffffff'
}

function withMeasuredLabels(theme: ThemeVariant): ThemeVariant {
  return {
    ...theme,
    colors: {
      ...theme.colors,
      primaryForeground: bestLabelOn(theme.colors.primary),
      destructiveForeground: bestLabelOn(theme.colors.destructive),
    },
  }
}

const themeCatalog: readonly ThemeVariant[] = Object.freeze([
  variant({
    id: 'adea-light',
    family: 'adea',
    familyLabel: 'Adea',
    label: 'Adea Light',
    appearance: 'light',
    description: "The product's own light theme. A neutral ladder with a monochrome primary.",
    provenance: ADEA_PROVENANCE,
    colors: {
      background: '#ffffff',
      foreground: '#252525',
      card: '#ffffff',
      cardForeground: '#252525',
      popover: '#ffffff',
      popoverForeground: '#252525',
      primary: '#343434',
      primaryForeground: '#fcfcfc',
      secondary: '#f7f7f7',
      secondaryForeground: '#343434',
      muted: '#f7f7f7',
      mutedForeground: '#6f6f6f',
      accent: '#f7f7f7',
      accentForeground: '#343434',
      destructive: '#c53c2b',
      destructiveForeground: '#ffffff',
      success: '#1a7f37',
      warning: '#a16207',
      info: '#0e7490',
      border: '#ebebeb',
      input: '#ebebeb',
      ring: '#343434',
      sidebar: '#fafafa',
      sidebarForeground: '#3f3f46',
      sidebarAccent: '#f0f0f0',
      sidebarBorder: '#ebebeb',
    },
    terminal: ADEA_TERMINAL_LIGHT,
    editor: ADEA_EDITOR_LIGHT,
    chart: ['#6d28d9', '#2563eb', '#0e7490', '#15803d', '#b45309', '#be185d'],
  }),
  variant({
    id: 'adea-dark',
    family: 'adea',
    familyLabel: 'Adea',
    label: 'Adea Dark',
    appearance: 'dark',
    description: "The product's own dark theme. A soft grey, never a near-black.",
    provenance: ADEA_PROVENANCE,
    colors: {
      background: '#252525',
      foreground: '#fcfcfc',
      card: '#343434',
      cardForeground: '#fcfcfc',
      popover: '#343434',
      popoverForeground: '#fcfcfc',
      primary: '#ebebeb',
      primaryForeground: '#343434',
      secondary: '#444444',
      secondaryForeground: '#fcfcfc',
      muted: '#444444',
      mutedForeground: '#a3a3a3',
      accent: '#444444',
      accentForeground: '#fcfcfc',
      destructive: '#e07060',
      destructiveForeground: '#000000',
      success: '#3fb950',
      warning: '#e3b341',
      info: '#39c5cf',
      border: '#3d3d3d',
      input: '#444444',
      ring: '#ebebeb',
      sidebar: '#2d2d2d',
      sidebarForeground: '#e4e4e7',
      sidebarAccent: '#444444',
      sidebarBorder: '#3d3d3d',
    },
    terminal: ADEA_TERMINAL_DARK,
    editor: ADEA_EDITOR_DARK,
    chart: ['#a78bfa', '#60a5fa', '#22d3ee', '#4ade80', '#fbbf24', '#f472b6'],
  }),

  /* --- Catppuccin ---------------------------------------------------------
   * A community palette with four flavours; the two most used are here. Its own
   * surface ladder maps almost one-to-one onto this system's.
   */
  variant({
    id: 'catppuccin-latte',
    family: 'catppuccin',
    familyLabel: 'Catppuccin',
    label: 'Latte',
    appearance: 'light',
    description: 'Catppuccin\u2019s light flavour. Warm, low-contrast, easy for long sessions.',
    provenance: {
      source: 'Catppuccin',
      url: 'https://github.com/catppuccin/catppuccin',
      license: 'MIT',
    },
    colors: {
      background: '#eff1f5',
      foreground: '#4c4f69',
      card: '#ffffff',
      cardForeground: '#4c4f69',
      popover: '#ffffff',
      popoverForeground: '#4c4f69',
      primary: '#8839ef',
      primaryForeground: '#ffffff',
      secondary: '#e6e9ef',
      secondaryForeground: '#4c4f69',
      muted: '#e6e9ef',
      /* Catppuccin's own `subtext1`. Its `overlay0` is the more obvious choice and
         measures 2.3:1 here — the flavour's overlay rungs are decorative, not text. */
      mutedForeground: '#5c5f77',
      accent: '#e6e9ef',
      accentForeground: '#4c4f69',
      destructive: '#d20f39',
      destructiveForeground: '#ffffff',
      success: '#40a02b',
      warning: '#df8e1d',
      info: '#1e66f5',
      border: '#ccd0da',
      input: '#ccd0da',
      ring: '#8839ef',
      sidebar: '#e6e9ef',
      sidebarForeground: '#4c4f69',
      sidebarAccent: '#ccd0da',
      sidebarBorder: '#ccd0da',
    },
    terminal: terminalFrom(
      '#eff1f5',
      '#4c4f69',
      '#dc8a78',
      '#acb0be',
      ['#5c5f77', '#d20f39', '#40a02b', '#df8e1d', '#1e66f5', '#ea76cb', '#179299', '#acb0be'],
      ['#6c6f85', '#d20f39', '#40a02b', '#df8e1d', '#1e66f5', '#ea76cb', '#179299', '#bcc0cc']
    ),
    editor: editorFrom({
      keyword: '#8839ef',
      string: '#40a02b',
      comment: '#9ca0b0',
      number: '#fe640b',
      function: '#1e66f5',
      variable: '#4c4f69',
      type: '#df8e1d',
      tag: '#d20f39',
      attribute: '#df8e1d',
      operator: '#04a5e5',
      heading: '#1e66f5',
      link: '#1e66f5',
      diffAdd: '#40a02b',
      diffDelete: '#d20f39',
      diffHunk: '#9ca0b0',
      searchMatch: '#df8e1d',
    }),
    chart: ['#8839ef', '#1e66f5', '#179299', '#40a02b', '#df8e1d', '#d20f39'],
  }),
  variant({
    id: 'catppuccin-mocha',
    family: 'catppuccin',
    familyLabel: 'Catppuccin',
    label: 'Mocha',
    appearance: 'dark',
    description: 'Catppuccin\u2019s flagship dark flavour. Muted, warm, very low glare.',
    provenance: {
      source: 'Catppuccin',
      url: 'https://github.com/catppuccin/catppuccin',
      license: 'MIT',
    },
    colors: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      card: '#313244',
      cardForeground: '#cdd6f4',
      popover: '#313244',
      popoverForeground: '#cdd6f4',
      primary: '#cba6f7',
      primaryForeground: '#1e1e2e',
      secondary: '#45475a',
      secondaryForeground: '#cdd6f4',
      muted: '#313244',
      mutedForeground: '#a6adc8',
      accent: '#45475a',
      accentForeground: '#cdd6f4',
      destructive: '#f38ba8',
      destructiveForeground: '#1e1e2e',
      success: '#a6e3a1',
      warning: '#f9e2af',
      info: '#89dceb',
      border: '#45475a',
      input: '#45475a',
      ring: '#cba6f7',
      sidebar: '#181825',
      sidebarForeground: '#cdd6f4',
      sidebarAccent: '#313244',
      sidebarBorder: '#313244',
    },
    terminal: terminalFrom(
      '#1e1e2e',
      '#cdd6f4',
      '#f5e0dc',
      '#585b70',
      ['#45475a', '#f38ba8', '#a6e3a1', '#f9e2af', '#89b4fa', '#f5c2e7', '#94e2d5', '#bac2de'],
      ['#585b70', '#f38ba8', '#a6e3a1', '#f9e2af', '#89b4fa', '#f5c2e7', '#94e2d5', '#a6adc8']
    ),
    editor: editorFrom({
      keyword: '#cba6f7',
      string: '#a6e3a1',
      comment: '#6c7086',
      number: '#fab387',
      function: '#89b4fa',
      variable: '#cdd6f4',
      type: '#f9e2af',
      tag: '#f38ba8',
      attribute: '#f9e2af',
      operator: '#89dceb',
      heading: '#89b4fa',
      link: '#89b4fa',
      diffAdd: '#a6e3a1',
      diffDelete: '#f38ba8',
      diffHunk: '#6c7086',
      searchMatch: '#f9e2af',
    }),
    chart: ['#cba6f7', '#89b4fa', '#94e2d5', '#a6e3a1', '#f9e2af', '#f38ba8'],
  }),

  /* --- Nord --------------------------------------------------------------- */
  variant({
    id: 'nord-dark',
    family: 'nord',
    familyLabel: 'Nord',
    label: 'Nord',
    appearance: 'dark',
    description: 'Nord\u2019s arctic blues. Calm and desaturated; deliberately dark-only.',
    provenance: {
      source: 'Nord',
      url: 'https://github.com/nordtheme/nord',
      license: 'MIT',
    },
    colors: {
      background: '#2e3440',
      foreground: '#d8dee9',
      card: '#3b4252',
      cardForeground: '#eceff4',
      popover: '#3b4252',
      popoverForeground: '#eceff4',
      primary: '#88c0d0',
      primaryForeground: '#2e3440',
      secondary: '#434c5e',
      secondaryForeground: '#eceff4',
      muted: '#434c5e',
      mutedForeground: '#aebacf',
      accent: '#434c5e',
      accentForeground: '#eceff4',
      destructive: '#bf616a',
      destructiveForeground: '#eceff4',
      success: '#a3be8c',
      warning: '#ebcb8b',
      info: '#81a1c1',
      border: '#434c5e',
      input: '#4c566a',
      ring: '#88c0d0',
      sidebar: '#292e39',
      sidebarForeground: '#d8dee9',
      sidebarAccent: '#434c5e',
      sidebarBorder: '#3b4252',
    },
    terminal: terminalFrom(
      '#2e3440',
      '#d8dee9',
      '#d8dee9',
      '#434c5e',
      ['#3b4252', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#88c0d0', '#e5e9f0'],
      ['#4c566a', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#8fbcbb', '#eceff4']
    ),
    editor: editorFrom({
      keyword: '#81a1c1',
      string: '#a3be8c',
      comment: '#616e88',
      number: '#b48ead',
      function: '#88c0d0',
      variable: '#d8dee9',
      type: '#8fbcbb',
      tag: '#81a1c1',
      attribute: '#8fbcbb',
      operator: '#81a1c1',
      heading: '#88c0d0',
      link: '#88c0d0',
      diffAdd: '#a3be8c',
      diffDelete: '#bf616a',
      diffHunk: '#616e88',
      searchMatch: '#ebcb8b',
    }),
    chart: ['#88c0d0', '#81a1c1', '#b48ead', '#a3be8c', '#ebcb8b', '#bf616a'],
  }),

  /* --- Gruvbox ------------------------------------------------------------ */
  variant({
    id: 'gruvbox-dark',
    family: 'gruvbox',
    familyLabel: 'Gruvbox',
    label: 'Gruvbox Dark',
    appearance: 'dark',
    description: 'Retro warm greys with saturated accents. High character, high contrast.',
    provenance: {
      source: 'Gruvbox',
      url: 'https://github.com/morhetz/gruvbox',
      license: 'MIT',
    },
    colors: {
      background: '#282828',
      foreground: '#ebdbb2',
      card: '#3c3836',
      cardForeground: '#ebdbb2',
      popover: '#3c3836',
      popoverForeground: '#ebdbb2',
      primary: '#fabd2f',
      primaryForeground: '#282828',
      secondary: '#504945',
      secondaryForeground: '#ebdbb2',
      muted: '#3c3836',
      mutedForeground: '#bdae93',
      accent: '#504945',
      accentForeground: '#ebdbb2',
      destructive: '#fb4934',
      destructiveForeground: '#282828',
      success: '#b8bb26',
      warning: '#fabd2f',
      info: '#83a598',
      border: '#504945',
      input: '#504945',
      ring: '#fabd2f',
      sidebar: '#1d2021',
      sidebarForeground: '#d5c4a1',
      sidebarAccent: '#3c3836',
      sidebarBorder: '#3c3836',
    },
    terminal: terminalFrom(
      '#282828',
      '#ebdbb2',
      '#ebdbb2',
      '#504945',
      ['#3c3836', '#cc241d', '#98971a', '#d79921', '#458588', '#b16286', '#689d6a', '#a89984'],
      ['#928374', '#fb4934', '#b8bb26', '#fabd2f', '#83a598', '#d3869b', '#8ec07c', '#ebdbb2']
    ),
    editor: editorFrom({
      keyword: '#fb4934',
      string: '#b8bb26',
      comment: '#928374',
      number: '#d3869b',
      function: '#83a598',
      variable: '#ebdbb2',
      type: '#fabd2f',
      tag: '#8ec07c',
      attribute: '#fabd2f',
      operator: '#8ec07c',
      heading: '#83a598',
      link: '#83a598',
      diffAdd: '#b8bb26',
      diffDelete: '#fb4934',
      diffHunk: '#928374',
      searchMatch: '#fabd2f',
    }),
    chart: ['#fabd2f', '#83a598', '#d3869b', '#b8bb26', '#fe8019', '#fb4934'],
  }),
  variant({
    id: 'gruvbox-light',
    family: 'gruvbox',
    familyLabel: 'Gruvbox',
    label: 'Gruvbox Light',
    appearance: 'light',
    description: 'The same palette on paper. Warm and readable in daylight.',
    provenance: {
      source: 'Gruvbox',
      url: 'https://github.com/morhetz/gruvbox',
      license: 'MIT',
    },
    colors: {
      background: '#fbf1c7',
      foreground: '#3c3836',
      card: '#f9f5d7',
      cardForeground: '#3c3836',
      popover: '#f9f5d7',
      popoverForeground: '#3c3836',
      primary: '#af3a03',
      primaryForeground: '#fbf1c7',
      secondary: '#ebdbb2',
      secondaryForeground: '#3c3836',
      muted: '#ebdbb2',
      mutedForeground: '#665c54',
      accent: '#ebdbb2',
      accentForeground: '#3c3836',
      destructive: '#9d0006',
      destructiveForeground: '#fbf1c7',
      success: '#79740e',
      warning: '#b57614',
      info: '#076678',
      border: '#d5c4a1',
      input: '#d5c4a1',
      ring: '#af3a03',
      sidebar: '#f2e5bc',
      sidebarForeground: '#3c3836',
      sidebarAccent: '#ebdbb2',
      sidebarBorder: '#d5c4a1',
    },
    terminal: terminalFrom(
      '#fbf1c7',
      '#3c3836',
      '#3c3836',
      '#ebdbb2',
      ['#fbf1c7', '#cc241d', '#98971a', '#d79921', '#458588', '#b16286', '#689d6a', '#7c6f64'],
      ['#928374', '#9d0006', '#79740e', '#b57614', '#076678', '#8f3f71', '#427b58', '#3c3836']
    ),
    editor: editorFrom({
      keyword: '#9d0006',
      string: '#79740e',
      comment: '#928374',
      number: '#8f3f71',
      function: '#076678',
      variable: '#3c3836',
      type: '#b57614',
      tag: '#427b58',
      attribute: '#b57614',
      operator: '#427b58',
      heading: '#076678',
      link: '#076678',
      diffAdd: '#79740e',
      diffDelete: '#9d0006',
      diffHunk: '#928374',
      searchMatch: '#b57614',
    }),
    chart: ['#af3a03', '#076678', '#8f3f71', '#79740e', '#b57614', '#9d0006'],
  }),

  /* --- Rosé Pine ---------------------------------------------------------- */
  variant({
    id: 'rosepine-moon',
    family: 'rosepine',
    familyLabel: 'Rosé Pine',
    label: 'Rosé Pine Moon',
    appearance: 'dark',
    description: 'Soft violet greys with a rose accent. Unusually gentle for a dark theme.',
    provenance: {
      source: 'Rosé Pine',
      url: 'https://github.com/rose-pine/rose-pine-theme',
      license: 'MIT',
    },
    colors: {
      background: '#232136',
      foreground: '#e0def4',
      card: '#2a273f',
      cardForeground: '#e0def4',
      popover: '#2a273f',
      popoverForeground: '#e0def4',
      primary: '#c4a7e7',
      primaryForeground: '#232136',
      secondary: '#393552',
      secondaryForeground: '#e0def4',
      muted: '#2a273f',
      mutedForeground: '#b1aec6',
      accent: '#393552',
      accentForeground: '#e0def4',
      destructive: '#eb6f92',
      destructiveForeground: '#232136',
      success: '#9ccfd8',
      warning: '#f6c177',
      info: '#3e8fb0',
      border: '#393552',
      input: '#393552',
      ring: '#c4a7e7',
      sidebar: '#1f1d2e',
      sidebarForeground: '#e0def4',
      sidebarAccent: '#2a273f',
      sidebarBorder: '#2a273f',
    },
    terminal: terminalFrom(
      '#232136',
      '#e0def4',
      '#e0def4',
      '#44415a',
      ['#393552', '#eb6f92', '#9ccfd8', '#f6c177', '#3e8fb0', '#c4a7e7', '#9ccfd8', '#e0def4'],
      ['#6e6a86', '#eb6f92', '#9ccfd8', '#f6c177', '#3e8fb0', '#c4a7e7', '#9ccfd8', '#e0def4']
    ),
    editor: editorFrom({
      keyword: '#c4a7e7',
      string: '#9ccfd8',
      comment: '#6e6a86',
      number: '#f6c177',
      function: '#3e8fb0',
      variable: '#e0def4',
      type: '#ea9a97',
      tag: '#eb6f92',
      attribute: '#f6c177',
      operator: '#908caa',
      heading: '#3e8fb0',
      link: '#3e8fb0',
      diffAdd: '#9ccfd8',
      diffDelete: '#eb6f92',
      diffHunk: '#6e6a86',
      searchMatch: '#f6c177',
    }),
    chart: ['#c4a7e7', '#3e8fb0', '#9ccfd8', '#f6c177', '#eb6f92', '#ea9a97'],
  }),
  variant({
    id: 'rosepine-dawn',
    family: 'rosepine',
    familyLabel: 'Rosé Pine',
    label: 'Rosé Pine Dawn',
    appearance: 'light',
    description: 'The same palette on cream. Warm without being yellow.',
    provenance: {
      source: 'Rosé Pine',
      url: 'https://github.com/rose-pine/rose-pine-theme',
      license: 'MIT',
    },
    colors: {
      background: '#faf4ed',
      foreground: '#575279',
      card: '#fffaf3',
      cardForeground: '#575279',
      popover: '#fffaf3',
      popoverForeground: '#575279',
      primary: '#907aa9',
      primaryForeground: '#fffaf3',
      secondary: '#f2e9e1',
      secondaryForeground: '#575279',
      muted: '#f2e9e1',
      mutedForeground: '#6b6889',
      accent: '#f2e9e1',
      accentForeground: '#575279',
      destructive: '#b4637a',
      destructiveForeground: '#fffaf3',
      success: '#56949f',
      warning: '#ea9d34',
      info: '#286983',
      border: '#dfdad9',
      input: '#dfdad9',
      ring: '#907aa9',
      sidebar: '#f2e9e1',
      sidebarForeground: '#575279',
      sidebarAccent: '#dfdad9',
      sidebarBorder: '#dfdad9',
    },
    terminal: terminalFrom(
      '#faf4ed',
      '#575279',
      '#575279',
      '#dfdad9',
      ['#f2e9e1', '#b4637a', '#56949f', '#ea9d34', '#286983', '#907aa9', '#56949f', '#575279'],
      ['#9893a5', '#b4637a', '#56949f', '#ea9d34', '#286983', '#907aa9', '#56949f', '#575279']
    ),
    editor: editorFrom({
      keyword: '#907aa9',
      string: '#56949f',
      comment: '#9893a5',
      number: '#ea9d34',
      function: '#286983',
      variable: '#575279',
      type: '#d7827e',
      tag: '#b4637a',
      attribute: '#ea9d34',
      operator: '#797593',
      heading: '#286983',
      link: '#286983',
      diffAdd: '#56949f',
      diffDelete: '#b4637a',
      diffHunk: '#9893a5',
      searchMatch: '#ea9d34',
    }),
    chart: ['#907aa9', '#286983', '#56949f', '#ea9d34', '#b4637a', '#d7827e'],
  }),

  /* --- Tokyo Night -------------------------------------------------------- */
  variant({
    id: 'tokyonight-storm',
    family: 'tokyonight',
    familyLabel: 'Tokyo Night',
    label: 'Storm',
    appearance: 'dark',
    description: 'Neon-on-indigo. The most saturated dark set in the catalogue.',
    provenance: {
      source: 'Tokyo Night',
      url: 'https://github.com/folke/tokyonight.nvim',
      license: 'MIT',
    },
    colors: {
      background: '#24283b',
      foreground: '#c0caf5',
      card: '#1f2335',
      cardForeground: '#c0caf5',
      popover: '#1f2335',
      popoverForeground: '#c0caf5',
      primary: '#7aa2f7',
      primaryForeground: '#1a1b26',
      secondary: '#292e42',
      secondaryForeground: '#c0caf5',
      muted: '#292e42',
      mutedForeground: '#9aa5ce',
      accent: '#292e42',
      accentForeground: '#c0caf5',
      destructive: '#f7768e',
      destructiveForeground: '#1a1b26',
      success: '#9ece6a',
      warning: '#e0af68',
      info: '#7dcfff',
      border: '#292e42',
      input: '#292e42',
      ring: '#7aa2f7',
      sidebar: '#1f2335',
      sidebarForeground: '#c0caf5',
      sidebarAccent: '#292e42',
      sidebarBorder: '#292e42',
    },
    terminal: terminalFrom(
      '#24283b',
      '#c0caf5',
      '#c0caf5',
      '#364a82',
      ['#414868', '#f7768e', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7', '#7dcfff', '#a9b1d6'],
      ['#565f89', '#f7768e', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7', '#7dcfff', '#c0caf5']
    ),
    editor: editorFrom({
      keyword: '#bb9af7',
      string: '#9ece6a',
      comment: '#565f89',
      number: '#ff9e64',
      function: '#7aa2f7',
      variable: '#c0caf5',
      type: '#2ac3de',
      tag: '#f7768e',
      attribute: '#e0af68',
      operator: '#89ddff',
      heading: '#7aa2f7',
      link: '#7aa2f7',
      diffAdd: '#9ece6a',
      diffDelete: '#f7768e',
      diffHunk: '#565f89',
      searchMatch: '#e0af68',
    }),
    chart: ['#7aa2f7', '#bb9af7', '#7dcfff', '#9ece6a', '#e0af68', '#f7768e'],
  }),

  /* --- Dracula ------------------------------------------------------------ */
  variant({
    id: 'dracula',
    family: 'dracula',
    familyLabel: 'Dracula',
    label: 'Dracula',
    appearance: 'dark',
    description: 'The most recognisable dark palette there is. High saturation, purple-led.',
    provenance: {
      source: 'Dracula',
      url: 'https://github.com/dracula/dracula-theme',
      license: 'MIT',
    },
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      card: '#343746',
      cardForeground: '#f8f8f2',
      popover: '#343746',
      popoverForeground: '#f8f8f2',
      primary: '#bd93f9',
      primaryForeground: '#282a36',
      secondary: '#44475a',
      secondaryForeground: '#f8f8f2',
      muted: '#44475a',
      mutedForeground: '#b8b9c4',
      accent: '#44475a',
      accentForeground: '#f8f8f2',
      destructive: '#ff5555',
      destructiveForeground: '#282a36',
      success: '#50fa7b',
      warning: '#f1fa8c',
      info: '#8be9fd',
      border: '#44475a',
      input: '#44475a',
      ring: '#bd93f9',
      sidebar: '#21222c',
      sidebarForeground: '#f8f8f2',
      sidebarAccent: '#343746',
      sidebarBorder: '#343746',
    },
    terminal: terminalFrom(
      '#282a36',
      '#f8f8f2',
      '#f8f8f2',
      '#44475a',
      ['#21222c', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd', '#f8f8f2'],
      ['#6272a4', '#ff6e6e', '#69ff94', '#ffffa5', '#d6acff', '#ff92df', '#a4ffff', '#ffffff']
    ),
    editor: editorFrom({
      keyword: '#ff79c6',
      string: '#f1fa8c',
      comment: '#6272a4',
      number: '#bd93f9',
      function: '#50fa7b',
      variable: '#f8f8f2',
      type: '#8be9fd',
      tag: '#ff79c6',
      attribute: '#50fa7b',
      operator: '#ff79c6',
      heading: '#8be9fd',
      link: '#8be9fd',
      diffAdd: '#50fa7b',
      diffDelete: '#ff5555',
      diffHunk: '#6272a4',
      searchMatch: '#f1fa8c',
    }),
    chart: ['#bd93f9', '#8be9fd', '#50fa7b', '#f1fa8c', '#ffb86c', '#ff79c6'],
  }),

  /* --- Solarized ---------------------------------------------------------- */
  variant({
    id: 'solarized-light',
    family: 'solarized',
    familyLabel: 'Solarized',
    label: 'Solarized Light',
    appearance: 'light',
    description: 'Ethan Schoonover\u2019s precision palette. Constant contrast in every hue.',
    provenance: {
      source: 'Solarized',
      url: 'https://github.com/altercation/solarized',
      license: 'MIT',
    },
    colors: {
      background: '#fdf6e3',
      foreground: '#586e75',
      /* base3, the same as the canvas. Solarized's base2 is a *highlight* surface,
         not a card, and using it here cost the muted text its contrast; the card's
         edge comes from the border, as this system requires anyway. */
      card: '#fdf6e3',
      cardForeground: '#073642',
      popover: '#eee8d5',
      popoverForeground: '#073642',
      primary: '#268bd2',
      primaryForeground: '#fdf6e3',
      secondary: '#eee8d5',
      secondaryForeground: '#073642',
      muted: '#eee8d5',
      /* base01 rather than base00: base00 is Solarized's body-text rung and measures
         4.13:1 against this canvas, which is below the floor for *secondary* text. */
      mutedForeground: '#586e75',
      accent: '#eee8d5',
      accentForeground: '#073642',
      destructive: '#dc322f',
      destructiveForeground: '#fdf6e3',
      success: '#859900',
      warning: '#b58900',
      info: '#2aa198',
      border: '#d9d2c1',
      input: '#d9d2c1',
      ring: '#268bd2',
      sidebar: '#fdf6e3',
      sidebarForeground: '#586e75',
      sidebarAccent: '#eee8d5',
      sidebarBorder: '#d9d2c1',
    },
    terminal: terminalFrom(
      '#fdf6e3',
      '#657b83',
      '#657b83',
      '#eee8d5',
      ['#073642', '#dc322f', '#859900', '#b58900', '#268bd2', '#d33682', '#2aa198', '#eee8d5'],
      ['#002b36', '#cb4b16', '#586e75', '#657b83', '#839496', '#6c71c4', '#93a1a1', '#fdf6e3']
    ),
    editor: editorFrom({
      keyword: '#859900',
      string: '#2aa198',
      comment: '#93a1a1',
      number: '#d33682',
      function: '#268bd2',
      variable: '#586e75',
      type: '#b58900',
      tag: '#268bd2',
      attribute: '#b58900',
      operator: '#859900',
      heading: '#268bd2',
      link: '#268bd2',
      diffAdd: '#859900',
      diffDelete: '#dc322f',
      diffHunk: '#93a1a1',
      searchMatch: '#b58900',
    }),
    chart: ['#268bd2', '#2aa198', '#859900', '#b58900', '#cb4b16', '#d33682'],
  }),
  variant({
    id: 'solarized-dark',
    family: 'solarized',
    familyLabel: 'Solarized',
    label: 'Solarized Dark',
    appearance: 'dark',
    description: 'The dark half of the same precision palette.',
    provenance: {
      source: 'Solarized',
      url: 'https://github.com/altercation/solarized',
      license: 'MIT',
    },
    colors: {
      background: '#002b36',
      foreground: '#93a1a1',
      card: '#073642',
      cardForeground: '#eee8d5',
      popover: '#073642',
      popoverForeground: '#eee8d5',
      primary: '#268bd2',
      primaryForeground: '#002b36',
      secondary: '#0d4452',
      secondaryForeground: '#eee8d5',
      muted: '#0d4452',
      mutedForeground: '#93a1a1',
      accent: '#0d4452',
      accentForeground: '#eee8d5',
      destructive: '#dc322f',
      destructiveForeground: '#002b36',
      success: '#859900',
      warning: '#b58900',
      info: '#2aa198',
      border: '#0d4452',
      input: '#0d4452',
      ring: '#268bd2',
      sidebar: '#00252e',
      sidebarForeground: '#93a1a1',
      sidebarAccent: '#073642',
      sidebarBorder: '#073642',
    },
    terminal: terminalFrom(
      '#002b36',
      '#839496',
      '#839496',
      '#073642',
      ['#073642', '#dc322f', '#859900', '#b58900', '#268bd2', '#d33682', '#2aa198', '#eee8d5'],
      ['#002b36', '#cb4b16', '#586e75', '#657b83', '#839496', '#6c71c4', '#93a1a1', '#fdf6e3']
    ),
    editor: editorFrom({
      keyword: '#859900',
      string: '#2aa198',
      comment: '#586e75',
      number: '#d33682',
      function: '#268bd2',
      variable: '#93a1a1',
      type: '#b58900',
      tag: '#268bd2',
      attribute: '#b58900',
      operator: '#859900',
      heading: '#268bd2',
      link: '#268bd2',
      diffAdd: '#859900',
      diffDelete: '#dc322f',
      diffHunk: '#586e75',
      searchMatch: '#b58900',
    }),
    chart: ['#268bd2', '#2aa198', '#859900', '#b58900', '#cb4b16', '#d33682'],
  }),
])

/* ---------------------------------------------------------------------------
 * Reading the registry
 * ------------------------------------------------------------------------- */

/** The catalogue, with every label measured against the fill it sits on. */
export const builtinThemes: readonly ThemeVariant[] = Object.freeze(
  themeCatalog.map(withMeasuredLabels)
)

export function themeById(id: string): ThemeVariant | undefined {
  return builtinThemes.find((theme) => theme.id === id)
}

/** The variants of one appearance, which is what a picker for that mode shows. */
export function themesForAppearance(appearance: ThemeAppearance): readonly ThemeVariant[] {
  return builtinThemes.filter((theme) => theme.appearance === appearance)
}

/** The families in the catalogue, in catalogue order. */
export function themeFamilies(): { family: string; label: string; themes: ThemeVariant[] }[] {
  const families = new Map<string, { family: string; label: string; themes: ThemeVariant[] }>()
  for (const theme of builtinThemes) {
    const entry = families.get(theme.family) ?? {
      family: theme.family,
      label: theme.familyLabel,
      themes: [],
    }
    entry.themes.push(theme)
    families.set(theme.family, entry)
  }
  return [...families.values()]
}

/**
 * The roles a variant sets, as CSS custom properties.
 *
 * The one place that knows the mapping from a theme's roles to the system's
 * variable names. A provider applies this; the validator checks it; nothing else
 * repeats it.
 */
export function themeCssVariables(theme: ThemeVariant): Record<string, string> {
  const c = theme.colors
  const t = theme.terminal
  const e = theme.editor
  return {
    '--background': c.background,
    '--foreground': c.foreground,
    '--card': c.card,
    '--card-foreground': c.cardForeground,
    '--popover': c.popover,
    '--popover-foreground': c.popoverForeground,
    '--primary': c.primary,
    '--primary-foreground': c.primaryForeground,
    '--secondary': c.secondary,
    '--secondary-foreground': c.secondaryForeground,
    '--muted': c.muted,
    '--muted-foreground': c.mutedForeground,
    '--accent': c.accent,
    '--accent-foreground': c.accentForeground,
    '--destructive': c.destructive,
    '--destructive-foreground': c.destructiveForeground,
    '--success': c.success,
    '--warning': c.warning,
    '--info': c.info,
    '--border': c.border,
    '--input': c.input,
    '--ring': c.ring,
    '--sidebar': c.sidebar,
    '--sidebar-foreground': c.sidebarForeground,
    '--sidebar-accent': c.sidebarAccent,
    '--sidebar-border': c.sidebarBorder,
    '--sidebar-primary': c.primary,
    '--sidebar-primary-foreground': c.primaryForeground,
    '--sidebar-ring': c.ring,
    '--sidebar-muted-foreground': c.mutedForeground,
    '--surface-sunken': c.muted,
    '--surface-hover': c.accent,
    '--surface-active': c.border,
    '--chrome': c.background,
    '--terminal-background': t.background,
    '--terminal-foreground': t.foreground,
    '--terminal-cursor': t.cursor,
    '--terminal-selection': t.selection,
    '--terminal-ansi-black': t.black,
    '--terminal-ansi-red': t.red,
    '--terminal-ansi-green': t.green,
    '--terminal-ansi-yellow': t.yellow,
    '--terminal-ansi-blue': t.blue,
    '--terminal-ansi-magenta': t.magenta,
    '--terminal-ansi-cyan': t.cyan,
    '--terminal-ansi-white': t.white,
    '--terminal-ansi-bright-black': t.brightBlack,
    '--terminal-ansi-bright-red': t.brightRed,
    '--terminal-ansi-bright-green': t.brightGreen,
    '--terminal-ansi-bright-yellow': t.brightYellow,
    '--terminal-ansi-bright-blue': t.brightBlue,
    '--terminal-ansi-bright-magenta': t.brightMagenta,
    '--terminal-ansi-bright-cyan': t.brightCyan,
    '--terminal-ansi-bright-white': t.brightWhite,
    '--editor-keyword': e.keyword,
    '--editor-string': e.string,
    '--editor-number': e.number,
    '--editor-comment': e.comment,
    '--editor-function': e.function,
    '--editor-variable': e.variable,
    '--editor-type': e.type,
    '--editor-tag': e.tag,
    '--editor-attribute': e.attribute,
    '--editor-operator': e.operator,
    '--editor-heading': e.heading,
    '--editor-link': e.link,
    '--editor-diff-add': e.diffAdd,
    '--editor-diff-delete': e.diffDelete,
    '--editor-diff-hunk': e.diffHunk,
    '--editor-search-match': e.searchMatch,
    '--chart-1': theme.chart[0] ?? c.primary,
    '--chart-2': theme.chart[1] ?? c.info,
    '--chart-3': theme.chart[2] ?? c.success,
    '--chart-4': theme.chart[3] ?? c.warning,
    '--chart-5': theme.chart[4] ?? c.destructive,
    '--chart-6': theme.chart[5] ?? c.mutedForeground,
  }
}

/* ---------------------------------------------------------------------------
 * Validation
 *
 * The gate, not the curation. A palette either clears these floors or it is
 * rejected with the reason — which is what lets the catalogue hold other people's
 * work without anyone hand-checking every colour.
 * ------------------------------------------------------------------------- */

export type ThemeFinding = {
  themeId: string
  role: string
  message: string
}

/**
 * The pairings a theme must satisfy, and why each one matters.
 *
 * These are the surfaces text actually lands on, not every combination — a palette
 * that clears the whole matrix is not more usable than one that clears these, and
 * demanding it would reject good themes for pairings the interface never renders.
 *
 * The floors are **WCAG AA**: 4.5:1 for text and 3:1 for the focus ring. That is
 * the accessibility standard, and it is deliberately not the 7:1 the default theme
 * is held to in `tests/tokens.test.ts` — AAA is this system's own bar, not a bar to
 * hold other people's palettes to. Solarized is the case that settles it: one of
 * the most carefully designed palettes in existence, built around a ~5:1 body
 * contrast on purpose, and a 7:1 gate would reject it for being what it is.
 */
const REQUIRED_PAIRINGS: readonly {
  foreground: keyof ThemeColors
  background: keyof ThemeColors
  minimum: number
  why: string
}[] = [
  {
    foreground: 'foreground',
    background: 'background',
    minimum: 4.5,
    why: 'body text on the canvas',
  },
  { foreground: 'foreground', background: 'card', minimum: 4.5, why: 'body text on a card' },
  { foreground: 'cardForeground', background: 'card', minimum: 4.5, why: 'text on a card' },
  {
    foreground: 'popoverForeground',
    background: 'popover',
    minimum: 4.5,
    why: 'text on a floating surface',
  },
  {
    foreground: 'mutedForeground',
    background: 'background',
    minimum: 4.5,
    why: 'secondary text on the canvas',
  },
  {
    foreground: 'mutedForeground',
    background: 'card',
    minimum: 4.5,
    why: 'secondary text on a card',
  },
  {
    foreground: 'primaryForeground',
    background: 'primary',
    minimum: 4.5,
    why: 'the label on a primary button',
  },
  {
    foreground: 'destructiveForeground',
    background: 'destructive',
    minimum: 4.5,
    why: 'the label on a destructive button',
  },
  {
    foreground: 'sidebarForeground',
    background: 'sidebar',
    minimum: 4.5,
    why: 'a rail destination',
  },
  { foreground: 'ring', background: 'background', minimum: 3, why: 'the focus ring on the canvas' },
]

export function validateTheme(theme: ThemeVariant): ThemeFinding[] {
  const findings: ThemeFinding[] = []

  for (const pairing of REQUIRED_PAIRINGS) {
    const foreground = theme.colors[pairing.foreground]
    const background = theme.colors[pairing.background]
    const ratio = contrastRatio(foreground, background)

    if (ratio === undefined) {
      findings.push({
        themeId: theme.id,
        role: pairing.foreground,
        message: `"${foreground}" or "${background}" is not a six-digit hex colour, so ${pairing.why} cannot be measured.`,
      })
      continue
    }

    if (ratio < pairing.minimum) {
      findings.push({
        themeId: theme.id,
        role: pairing.foreground,
        message: `${pairing.foreground} on ${pairing.background} measures ${ratio.toFixed(2)}:1, below the ${pairing.minimum}:1 floor for ${pairing.why}.`,
      })
    }
  }

  if (theme.chart.length < 6) {
    findings.push({
      themeId: theme.id,
      role: 'chart',
      message: `the chart series has ${theme.chart.length} colours; six are required so a chart cannot fall back to a hue the theme did not choose.`,
    })
  }

  if (!theme.provenance.source || !theme.provenance.license) {
    findings.push({
      themeId: theme.id,
      role: 'provenance',
      message: 'every theme must record where its palette came from and under what licence.',
    })
  }

  return findings
}

export function validateThemeRegistry(
  registry: readonly ThemeVariant[] = builtinThemes
): ThemeFinding[] {
  const findings: ThemeFinding[] = []
  const seen = new Set<string>()

  for (const theme of registry) {
    if (seen.has(theme.id)) {
      findings.push({ themeId: theme.id, role: 'id', message: 'theme id must be unique.' })
    }
    seen.add(theme.id)
    findings.push(...validateTheme(theme))
  }

  return findings
}

/**
 * The two variants a fresh install starts on.
 *
 * `adea-dark` rather than a near-black set, deliberately: a dark theme whose
 * canvas is almost black is the most common way a dark interface is made
 * unpleasant, and the product's own theme is a soft grey.
 */
export const defaultLightThemeId = 'adea-light'
export const defaultDarkThemeId = 'adea-dark'
