/**
 * Build the design-system artifact's files from this repository.
 *
 * Run: bun run design-system:build   (after `bun run build`, which writes the
 * declarations this reads)
 *
 * The artifact is a published Design System page whose content is a folder of
 * files — `tokens.json`, a brand book, one live preview and one guideline page
 * per component, a bundle of the real components, the fonts. Everything here is
 * derived from the same sources the package ships, so a refresh is this command
 * plus one publish, and the page cannot drift from the code by hand-copying:
 *
 *   - colours come from `themeCssVariables` for the six Adea themes, with the
 *     aliases and `color-mix()` derivations `theme.css` declares resolved per
 *     theme, and each token's usage from `src/lib/tokens.ts`;
 *   - every other scale is read from `theme.css`;
 *   - the bundle is the package entry built once more as a single classic script
 *     (`window.AdeaUI`), with `theme.css`'s colour declarations stripped so the
 *     page's own theme switcher is what paints it;
 *   - each component's guideline page is its source doc comment, its variants and
 *     its parts, plus an optional hand-written `notes.md` beside its preview.
 *
 * Hand-written inputs live in `design-system/`: the brand book (`README.md`), the
 * inventory, the type weights, and one `components/<Card>/preview.html` per card.
 * Output goes to `design-system/out/project/`, which is ignored by git.
 */

import tailwindcss from '@tailwindcss/vite'
import {
  contrastRatio,
  formatOklch,
  parseColor,
  primaryHover,
  shiftLightness,
} from '@adea-ai/themes'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import solid from 'vite-plugin-solid'

import { allTokens } from '../../src/lib/tokens'
import { themeById, themeCssVariables, type ThemeVariant } from '../../src/lib/themes'

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const SOURCE = join(PACKAGE, 'design-system')
const OUT = join(SOURCE, 'out', 'project')
const WORK = join(SOURCE, 'out', '.work')
const THEME_CSS = readFileSync(join(PACKAGE, 'src/styles/theme.css'), 'utf8')

/** The six Adea variants, primary first: a theme missing a value inherits the first's. */
const THEMES = [
  { id: 'light', source: 'adea-light', name: 'Adea Light' },
  { id: 'dark', source: 'adea-dark', name: 'Adea Dark' },
  { id: 'light-colorblind', source: 'adea-light-colorblind', name: 'Adea Light Colorblind' },
  { id: 'dark-colorblind', source: 'adea-dark-colorblind', name: 'Adea Dark Colorblind' },
  {
    id: 'light-high-contrast',
    source: 'adea-light-high-contrast',
    name: 'Adea Light High Contrast',
  },
  { id: 'dark-high-contrast', source: 'adea-dark-high-contrast', name: 'Adea Dark High Contrast' },
] as const

type Card = { card: string; group: string; source?: string }
type Inventory = { items: Record<string, Card[]> }
type TypeStyle = {
  name?: string
  token: string
  weight: number
  sample: string
  usage?: string
  lineHeight?: string
}
type TypeConfig = {
  families: Record<string, string>
  fonts: { family: string; package: string }[]
  groups: { name: string; family: string; styles: TypeStyle[] }[]
}
type Token = { name: string; value: string | Record<string, string>; usage: string }

const inventory = JSON.parse(readFileSync(join(SOURCE, 'inventory.json'), 'utf8')) as Inventory
const typeConfig = JSON.parse(readFileSync(join(SOURCE, 'type.json'), 'utf8')) as TypeConfig
/** `--partial` builds with the cards that have previews, for work in progress. */
const PARTIAL = process.argv.includes('--partial')
const report: { skipped: string[]; notes: string[] } = { skipped: [], notes: [] }

// --- theme.css -------------------------------------------------------------

/** Every `--name: value;` in a CSS block body, last declaration winning. */
function declarations(body: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const match of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    if (match[1] && match[2]) found.set(match[1], match[2].trim())
  }
  return found
}

/** The body of the first block whose opening line is exactly `selector {` and that contains `marker`. */
function block(selector: string, marker = ''): string {
  let from = 0
  for (;;) {
    const start = THEME_CSS.indexOf(`\n${selector} {`, from)
    if (start < 0) throw new Error(`theme.css has no ${selector} block containing ${marker}`)
    const end = THEME_CSS.indexOf('\n}', start)
    const body = THEME_CSS.slice(start, end)
    if (body.includes(marker)) return body
    from = end
  }
}

const rootColours = declarations(block(':root', '@generated theme:root'))
const darkColours = declarations(block('.dark', '@generated theme:dark'))
const scales = declarations(block(':root', '--radius-lg'))
const darkShadows = declarations(block('.dark', '--shadow-md'))

// --- colour ----------------------------------------------------------------

function isDark(id: string): boolean {
  return id.startsWith('dark')
}

/** The variables one theme resolves to, with the system's derived tokens added. */
function themeVariables(theme: ThemeVariant): Record<string, string> {
  const variables = { ...themeCssVariables(theme) }
  const background = parseColor(theme.colors.background)
  variables['--primary-hover'] = primaryHover(theme.colors.primary, theme.appearance)
  variables['--surface-sunken'] = background
    ? formatOklch(shiftLightness(background, -0.02))
    : theme.colors.background
  return variables
}

const ALIAS = /^var\(--([a-z0-9-]+)\)$/
const MIX = /^color-mix\(in oklch, var\(--([a-z0-9-]+)\) (\d+(?:\.\d+)?)%, transparent\)$/

/** A colour as the page reads it: an `oklch()` literal or a `{token}` alias. */
function resolveColour(
  name: string,
  themeId: string,
  variables: Record<string, string>,
  depth = 0
): string | undefined {
  if (depth > 8) return undefined
  const declared = (isDark(themeId) ? darkColours : rootColours).get(name) ?? rootColours.get(name)
  const raw =
    declared && (ALIAS.test(declared) || MIX.test(declared))
      ? declared
      : (variables[`--${name}`] ?? declared)
  if (!raw) return undefined
  const alias = ALIAS.exec(raw)
  if (alias?.[1]) return `{${alias[1]}}`
  const mix = MIX.exec(raw)
  if (mix?.[1] && mix[2]) {
    const base = resolveColour(mix[1], themeId, variables, depth + 1)
    const literal = base?.startsWith('{')
      ? resolveColour(base.slice(1, -1), themeId, variables, depth + 1)
      : base
    if (!literal?.startsWith('oklch(')) return undefined
    return literal.replace(/\)$/, ` / ${Number(mix[2]) / 100})`)
  }
  return parseColor(raw) ? raw : undefined
}

function colourTokens(): Token[] {
  const variables = Object.fromEntries(
    THEMES.map((theme) => {
      const variant = themeById(theme.source)
      if (!variant) throw new Error(`@adea-ai/themes has no ${theme.source}`)
      return [theme.id, themeVariables(variant)]
    })
  ) as Record<string, Record<string, string>>

  const described = allTokens.filter((token) => token.kind === 'color')
  const extra = Object.keys(variables['dark'] ?? {})
    .filter((key) => /^--(editor|terminal)-/.test(key))
    .map((key) => key.slice(2))
  const tokens: Token[] = []

  const emit = (name: string, usage: string): void => {
    const values: Record<string, string> = {}
    for (const theme of THEMES) {
      const value = resolveColour(name, theme.id, variables[theme.id] ?? {})
      if (value) values[theme.id] = value
    }
    const distinct = new Set(Object.values(values))
    if (distinct.size === 0) {
      report.skipped.push(`${name}: no colour value in any theme`)
      return
    }
    const only = [...distinct][0]
    tokens.push({
      name,
      value:
        distinct.size === 1 && only && Object.keys(values).length === THEMES.length ? only : values,
      usage,
    })
  }

  for (const token of described) emit(token.name, token.description)
  for (const name of extra) {
    const role = name.replace(/^(editor|terminal)-/, '').replaceAll('-', ' ')
    emit(
      name,
      name.startsWith('editor-')
        ? `Syntax highlighting in CodeBlock and editors: ${role}.`
        : `Terminal palette (xterm): ${role}.`
    )
  }

  // The accent presets, as theme.css's generated `[data-accent]` blocks set them.
  for (const match of THEME_CSS.matchAll(
    /^\[data-accent='([a-z]+)'\] \{([^}]*)\}\n\.dark\[data-accent='\1'\] \{([^}]*)\}/gm
  )) {
    const [, id, lightBody, darkBody] = match
    if (!id || !lightBody || !darkBody) continue
    const light = declarations(lightBody)
    const dark = declarations(darkBody)
    for (const [suffix, role, usage] of [
      [
        '',
        'primary',
        `The ${id} accent preset (\`data-accent="${id}"\`): replaces \`primary\` and \`ring\`.`,
      ],
      ['-hover', 'primary-hover', `Hover rung of \`accent-${id}\`.`],
      [
        '-foreground',
        'primary-foreground',
        `Label on \`accent-${id}\`; chosen by measured contrast, so it flips between appearances.`,
      ],
    ] as const) {
      const value: Record<string, string> = {}
      for (const theme of THEMES) {
        const found = (isDark(theme.id) ? dark : light).get(role)
        if (found) value[theme.id] = found
      }
      tokens.push({ name: `accent-${id}${suffix}`, value, usage })
    }
  }
  return tokens
}

// --- scales ----------------------------------------------------------------

function describe(name: string): string {
  return allTokens.find((token) => token.name === name)?.description ?? ''
}

function scale(names: string[]): Token[] {
  return names.flatMap((name) => {
    const value = scales.get(name)
    if (!value) {
      report.skipped.push(`${name}: not declared in theme.css`)
      return []
    }
    return [{ name, value, usage: describe(name) }]
  })
}

function namesMatching(pattern: RegExp): string[] {
  return [...scales.keys()].filter((name) => pattern.test(name))
}

function shadowTokens(): Token[] {
  return namesMatching(/^shadow-/).map((name) => ({
    name,
    value: Object.fromEntries(
      THEMES.map((theme) => [
        theme.id,
        (isDark(theme.id) ? darkShadows.get(name) : undefined) ?? scales.get(name) ?? '',
      ])
    ),
    usage: describe(name),
  }))
}

function typography(): Record<string, unknown> {
  const families = Object.fromEntries(
    Object.entries(typeConfig.families).map(([key, variable]) => {
      const stack = scales.get(variable)
      if (!stack) throw new Error(`theme.css declares no --${variable}`)
      return [key, stack.replaceAll("'", '"')]
    })
  )
  const fonts = typeConfig.fonts.map(({ family, package: name }) => {
    const css = readFileSync(
      join(PACKAGE, `node_modules/@fontsource-variable/${name}/index.css`),
      'utf8'
    )
    const weight = /font-weight:\s*([0-9 ]+);/.exec(css)?.[1]?.trim() ?? '400'
    return { family, file: `fonts/${name}-latin-wght-normal.woff2`, weight, style: 'normal' }
  })
  const groups = typeConfig.groups.map((group) => ({
    name: group.name,
    family: group.family,
    styles: group.styles.map((style) => {
      const size = scales.get(style.token)
      const leading = scales.get(`${style.token}--line-height`)
      if (!size || !leading) throw new Error(`theme.css declares no ${style.token}`)
      return {
        name: style.name ?? style.token,
        fontSize: size,
        lineHeight: style.lineHeight ?? Number(leading),
        fontWeight: style.weight,
        sample: style.sample,
        usage: style.usage ?? describe(style.token),
      }
    }),
  }))
  return { fonts, families, groups }
}

function writeTokens(): void {
  const colours = colourTokens()
  const tokens = {
    name: 'Adea UI',
    version: 1,
    color: { themes: THEMES.map(({ id, name }) => ({ id, name })), tokens: colours },
    type: typography(),
    spacing: {
      note: 'The control and row ladders. `data-density="compact"` shifts both one rung (4px) tighter; `control-height-2xl`, the 48px touch target, never moves.',
      tokens: scale(namesMatching(/^(control-height|control-padding|row-height)-/)),
    },
    radius: { tokens: scale(namesMatching(/^radius-/)) },
    shadow: {
      note: 'A spread that reads as elevation, plus a hairline in light so a card stays visible on a same-colour canvas.',
      tokens: shadowTokens(),
    },
    shell: {
      note: 'Window geometry: one place to change how wide a rail or sidebar is, so the two applications cannot disagree.',
      tokens: scale([
        'rail-width',
        'rail-width-expanded',
        'rail-item-height',
        'sidebar-width',
        'sidebar-width-compact',
        'panel-width',
        'topbar-height',
        'statusbar-height',
        'tooltip-max-width',
      ]),
    },
    opacity: {
      tokens: [
        {
          name: 'chrome-alpha',
          value: rootColours.get('chrome-alpha') ?? '0.9',
          usage: describe('chrome-alpha'),
        },
      ],
    },
    zIndex: {
      note: 'Every overlay names a rung; no one-off z-index exists.',
      tokens: scale(namesMatching(/^z-/)),
    },
  }
  writeFileSync(join(OUT, 'tokens.json'), `${JSON.stringify(tokens, null, 1)}\n`)
  report.notes.push(`${colours.length} colour tokens across ${THEMES.length} themes`)
  report.notes.push(
    'Motion (duration-*, ease-*) and the mono width compensation (ui-tracking, ui-word-spacing) are described in the brand book: the page has no family for them.'
  )
  checkContrast(colours)
}

/** The floors tests/tokens.test.ts holds the defaults to, measured on all six themes. */
function checkContrast(colours: Token[]): void {
  const value = (name: string, theme: string): string | undefined => {
    const token = colours.find((candidate) => candidate.name === name)
    if (!token) return undefined
    const raw =
      typeof token.value === 'string' ? token.value : (token.value[theme] ?? token.value['light'])
    if (raw?.startsWith('{')) return value(raw.slice(1, -1), theme)
    return raw
  }
  const pairs: [string, string, number][] = [
    ['foreground', 'background', 7],
    ['foreground', 'card', 7],
    ['muted-foreground', 'background', 4.5],
    ['muted-foreground', 'card', 4.5],
    ['primary-foreground', 'primary', 4.5],
  ]
  for (const theme of THEMES) {
    for (const [text, ground, floor] of pairs) {
      const a = parseColor(value(text, theme.id) ?? '')
      const b = parseColor(value(ground, theme.id) ?? '')
      if (!a || !b) continue
      const ratio = contrastRatio(a, b)
      if (ratio < floor)
        report.notes.push(
          `${theme.name}: ${text} on ${ground} is ${ratio.toFixed(2)}:1 (floor ${floor}:1)`
        )
    }
  }
}

// --- fonts -------------------------------------------------------------------

function writeFonts(): void {
  mkdirSync(join(OUT, 'fonts'), { recursive: true })
  for (const { package: name } of typeConfig.fonts) {
    const file = `${name}-latin-wght-normal.woff2`
    copyFileSync(
      join(PACKAGE, `node_modules/@fontsource-variable/${name}/files/${file}`),
      join(OUT, 'fonts', file)
    )
  }
}

// --- bundle ------------------------------------------------------------------

/** theme.css with every colour declaration removed: the page's tokens.css owns those. */
function colourlessThemeCss(): string {
  let css = THEME_CSS.replace(
    / {2}\/\* @generated theme:(root|dark)[\s\S]*?\/\* @end generated theme:\1 \*\/\n/g,
    ''
  )
    .replace(/\/\* @generated accents[\s\S]*?\/\* @end generated accents \*\/\n/, '')
    .replace(/\n {2}--shadow-(2xs|xs|sm|md|lg|xl): [^;]+;/g, '')
    .replace(/(:root|\.dark) \{\s*\}/g, '')
  css += `
/* Values theme.css derives with color-mix() or keeps outside the colour blocks. The
   page's tokens.css carries resolved copies; these keep the component CSS whole. */
:root { --chrome-alpha: 0.9; color-scheme: light; }
[data-theme^='dark'] { color-scheme: dark; }
`
  return css
}

const ICONS = [
  'AlignCenter',
  'AlignLeft',
  'AlignRight',
  'ArrowUpRight',
  'Bell',
  'Bold',
  'Calendar',
  'Check',
  'ChevronDown',
  'ChevronRight',
  'CircleHelp',
  'Copy',
  'Download',
  'File',
  'FileText',
  'Folder',
  'GitBranch',
  'House',
  'Inbox',
  'Info',
  'Italic',
  'Layers',
  'LayoutGrid',
  'LogOut',
  'Mail',
  'MessageSquare',
  'Mic',
  'Moon',
  'Paperclip',
  'Pencil',
  'Play',
  'Plus',
  'RefreshCw',
  'Search',
  'Settings',
  'Share2',
  'Sparkles',
  'Square',
  'Star',
  'Sun',
  'Terminal',
  'Trash2',
  'Underline',
  'Upload',
  'User',
  'Users',
  'X',
  'Zap',
]

async function writeBundle(cards: { name: string }[]): Promise<void> {
  mkdirSync(WORK, { recursive: true })
  writeFileSync(join(WORK, 'theme.css'), colourlessThemeCss())
  writeFileSync(
    join(WORK, 'globals.css'),
    `@import 'tailwindcss';\n@import '${join(PACKAGE, 'src/styles/base.css')}';\n@import './theme.css';\n@source '${join(PACKAGE, 'src')}';\n@source '${join(SOURCE, 'components')}';\n`
  )
  writeFileSync(
    join(WORK, 'entry.ts'),
    `import './globals.css'
import * as UI from '${join(PACKAGE, 'src/index')}'
import * as Chart from '${join(PACKAGE, 'src/components/ui/chart')}'
import * as Carousel from '${join(PACKAGE, 'src/components/ui/carousel')}'
import * as Themes from '@adea-ai/themes'
import { render } from 'solid-js/web'
import html from 'solid-js/html'
import h from 'solid-js/h'
import { createSignal, createMemo, For, Index, Show } from 'solid-js'
import { ${ICONS.join(', ')} } from 'lucide-solid'
const Icons = { ${ICONS.join(', ')} }
;(window as unknown as Record<string, unknown>)['AdeaUI'] = { ...UI, ...Chart, ...Carousel, Themes, Icons, render, html, h, createSignal, createMemo, For, Index, Show }
`
  )
  await build({
    configFile: false,
    logLevel: 'warn',
    root: PACKAGE,
    plugins: [solid(), tailwindcss()],
    define: { 'process.env.NODE_ENV': '"production"' },
    resolve: { conditions: ['solid', 'browser', 'module', 'import'] },
    build: {
      outDir: join(WORK, 'dist'),
      emptyOutDir: true,
      cssCodeSplit: false,
      minify: true,
      target: 'es2022',
      lib: {
        entry: join(WORK, 'entry.ts'),
        formats: ['iife'],
        name: '__AdeaUIBundle',
        fileName: () => 'bundle.js',
        cssFileName: 'bundle',
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  })
  // The page inlines the bundle in a <script>, so neither sequence may appear.
  const script = readFileSync(join(WORK, 'dist/bundle.js'), 'utf8')
    .replaceAll('<!--', '<\\x21--')
    .replaceAll('</script', '<\\/script')
  const header = { format: 4, namespace: 'AdeaUI', components: cards.map(({ name }) => ({ name })) }
  writeFileSync(
    join(OUT, 'components/bundle.js'),
    `/* @ds-bundle: ${JSON.stringify(header)} */\n${script}`
  )
  copyFileSync(join(WORK, 'dist/bundle.css'), join(OUT, 'components/bundle.css'))
}

// --- component pages -----------------------------------------------------------

/** The source file a card documents. */
function sourceFor(item: string, card: Card): string {
  const components = join(PACKAGE, 'src/components')
  if (card.source) return join(components, card.source)
  for (const layer of ['ui', 'layout', 'composites']) {
    const folder = join(components, layer, item)
    if (!existsSync(folder)) continue
    const named = join(folder, `${item}.tsx`)
    if (existsSync(named)) return named
    const first = readdirSync(folder).find(
      (file) => file.endsWith('.tsx') && !file.includes('.stories.')
    )
    if (first) return join(folder, first)
  }
  throw new Error(`no source for ${card.card} (${item})`)
}

/** The doc comment above `export function <name>`, else the file's first doc comment. */
function docComment(source: string, name: string): string {
  const exported = new RegExp(
    `/\\*\\*((?:(?!\\*/)[\\s\\S])*)\\*/\\s*export (?:function|const) ${name}\\b`
  ).exec(source)
  const first = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\//.exec(source)
  const body = (exported ?? first)?.[1] ?? ''
  return body
    .replace(/^\s*\* ?/gm, '')
    .trim()
    .replace(new RegExp(`^${name}\\.\\s*\\n+`), '')
}

function variants(source: string): string[] {
  const lines: string[] = []
  for (const group of source.matchAll(/variants:\s*\{([\s\S]*?)\n {4}\},?\n/g)) {
    for (const variant of (group[1] ?? '').matchAll(/\n {6}(\w+): \{([\s\S]*?)\n {6}\}/g)) {
      const keys = [...(variant[2] ?? '').matchAll(/\n {8}'?([\w-]+)'?:/g)].map(
        (key) => `\`${key[1]}\``
      )
      if (variant[1] && keys.length) lines.push(`- \`${variant[1]}\`: ${keys.join(', ')}`)
    }
  }
  return lines
}

function componentReadme(item: string, card: Card): string {
  const path = sourceFor(item, card)
  const source = readFileSync(path, 'utf8')
  const folder = dirname(path)
  const parts = new Set<string>()
  for (const file of readdirSync(folder)) {
    if (!file.endsWith('.tsx') || file.includes('.stories.')) continue
    for (const match of readFileSync(join(folder, file), 'utf8').matchAll(
      /^export function ([A-Z]\w*)/gm
    )) {
      if (match[1]) parts.add(match[1])
    }
  }
  const doc = docComment(source, card.card)
  const lines = [`# ${card.card}`, '', doc || `${card.card} from \`@adea-ai/ui\`.`, '']
  const variantLines = variants(source)
  if (variantLines.length) lines.push('## Variants', '', ...variantLines, '')
  if (parts.size) lines.push('## Parts', '', [...parts].map((part) => `\`${part}\``).join(', '), '')
  const notes = join(SOURCE, 'components', card.card, 'notes.md')
  if (existsSync(notes)) lines.push(readFileSync(notes, 'utf8').trim(), '')
  lines.push(
    '## Using it',
    '',
    `- Import from \`@adea-ai/ui\`; the source is \`packages/ui/${path.slice(PACKAGE.length + 1)}\`.`,
    `- Copy only this module: \`bunx shadcn@latest add https://adea-ai.github.io/ui/r/${item}.json\`.`,
    '- Appearance comes from `variant` and `size`; `class` is for layout only (margin, width, placement).',
    ''
  )
  return lines.join('\n')
}

function declarationsFor(item: string, card: Card): string {
  const path = sourceFor(item, card)
  const relativePath = path.slice(join(PACKAGE, 'src').length + 1).replace(/\.tsx$/, '.d.ts')
  const declared = join(PACKAGE, 'dist', relativePath)
  if (!existsSync(declared)) throw new Error(`${declared} is missing — run \`bun run build\` first`)
  const text = readFileSync(declared, 'utf8')
    .replace(/^import [\s\S]*?;\n/gm, '')
    .replace(/\/\/# sourceMappingURL.*\n?/, '')
    .trim()
  return `// ---- ${card.card} — packages/ui/src/${relativePath.replace(/\.d\.ts$/, '.tsx')}\n${text}\n`
}

function writeComponents(): { name: string }[] {
  const cards: { name: string }[] = []
  const typeDeclarations: string[] = []
  const seen = new Set<string>()
  for (const [item, entries] of Object.entries(inventory.items)) {
    for (const card of entries) {
      const preview = join(SOURCE, 'components', card.card, 'preview.html')
      if (!existsSync(preview)) {
        if (!PARTIAL)
          throw new Error(`design-system/components/${card.card}/preview.html is missing`)
        report.skipped.push(`${card.card}: no preview yet (--partial)`)
        continue
      }
      const folder = join(OUT, 'components', card.card)
      mkdirSync(folder, { recursive: true })
      copyFileSync(preview, join(folder, 'preview.html'))
      writeFileSync(join(folder, 'README.md'), componentReadme(item, card))
      const path = sourceFor(item, card)
      if (!seen.has(path)) {
        seen.add(path)
        typeDeclarations.push(declarationsFor(item, card))
      }
      cards.push({ name: card.card })
    }
  }
  const cover = join(OUT, 'components/Cover')
  mkdirSync(cover, { recursive: true })
  copyFileSync(join(SOURCE, 'components/Cover/preview.html'), join(cover, 'preview.html'))
  writeFileSync(
    join(OUT, 'components/index.d.ts'),
    `/**\n * Adea UI — declarations for every component in this system, from @adea-ai/ui's build.\n * Documentation only: import from '@adea-ai/ui'. The bundle exposes them on\n * window.AdeaUI, with Solid's render, html, h, createSignal, createMemo, For, Index,\n * Show and a set of lucide-solid glyphs as Icons.\n */\n\n${typeDeclarations.join('\n')}`
  )
  return cards
}

// --- run -----------------------------------------------------------------------

rmSync(join(SOURCE, 'out'), { recursive: true, force: true })
mkdirSync(join(OUT, 'components'), { recursive: true })
copyFileSync(join(SOURCE, 'README.md'), join(OUT, 'README.md'))
writeTokens()
writeFonts()
const cards = writeComponents()
await writeBundle(cards)
rmSync(WORK, { recursive: true, force: true })
writeFileSync(join(SOURCE, 'out', 'report.json'), `${JSON.stringify(report, null, 2)}\n`)

console.log(`design system: ${cards.length} component cards, tokens, fonts and bundle → ${OUT}`)
for (const line of [...report.skipped, ...report.notes]) console.log(`  ${line}`)
