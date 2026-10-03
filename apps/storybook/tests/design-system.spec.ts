import { expect, test, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Renders every design-system card the way the published page does: tokens.css,
 * the fonts, bundle.css and bundle.js preloaded, `data-theme` on <html>, then the
 * card's preview.html. A card that throws, logs an error, or renders nothing fails.
 *
 * Previews come from `packages/ui/design-system/components/`; tokens, fonts and the
 * bundle from `packages/ui/design-system/out/project`, so run
 * `bun run --cwd packages/ui design-system:build` first (`--partial` while cards are
 * missing). Filter with `--grep`. Set DESIGN_SYSTEM_SHOTS=1 to
 * keep a screenshot of each card per theme under `test-results/design-system/`.
 */

const PROJECT = resolve(import.meta.dirname, '../../../packages/ui/design-system/out/project')
// Previews are read from source, so a card can be edited and re-checked without a rebuild.
const SOURCE = resolve(import.meta.dirname, '../../../packages/ui/design-system/components')
const SHOTS = process.env['DESIGN_SYSTEM_SHOTS'] === '1'
const THEMES = (process.env['DESIGN_SYSTEM_THEMES'] ?? 'light,dark').split(',')

type Token = { name: string; value: string | Record<string, string> }
type Family = { tokens: Token[] }
type Tokens = {
  color: { themes: { id: string }[]; tokens: Token[] }
  type: {
    fonts: { family: string; file: string; weight: string }[]
    families: Record<string, string>
  }
} & Record<string, unknown>

/** A token value as CSS: a `{name}` alias becomes `var(--name)`. */
function value(raw: string): string {
  return raw.replace(/^\{(.+)\}$/, 'var(--$1)')
}

/** The page's tokens.css, compiled the way the Design System type documents it. */
function tokensCss(tokens: Tokens): string {
  const themes = tokens.color.themes.map((theme) => theme.id)
  const first = themes[0] ?? 'light'
  const blocks = new Map<string, string[]>(themes.map((theme) => [theme, []]))
  const themed = [
    ...tokens.color.tokens,
    ...((tokens['shadow'] as Family | undefined)?.tokens ?? []),
  ]
  for (const token of themed) {
    for (const theme of themes) {
      const raw =
        typeof token.value === 'string' ? token.value : (token.value[theme] ?? token.value[first])
      if (raw) blocks.get(theme)?.push(`--${token.name}:${value(raw)}`)
    }
  }
  let css = `:root,[data-theme="${first}"]{${(blocks.get(first) ?? []).join(';')}}\n`
  for (const theme of themes.slice(1)) {
    css += `[data-theme="${theme}"]{${(blocks.get(theme) ?? []).join(';')}}\n`
  }
  const root: string[] = []
  for (const [key, family] of Object.entries(tokens)) {
    if (['color', 'shadow', 'type'].includes(key) || typeof family !== 'object' || !family) continue
    for (const token of (family as Family).tokens ?? []) {
      if (typeof token.value === 'string') root.push(`--${token.name}:${token.value}`)
    }
  }
  for (const [key, stack] of Object.entries(tokens.type.families))
    root.push(`--font-${key}:${stack}`)
  css += `:root{${root.join(';')}}\n`
  for (const font of tokens.type.fonts) {
    const data = readFileSync(join(PROJECT, font.file)).toString('base64')
    css += `@font-face{font-family:"${font.family}";src:url(data:font/woff2;base64,${data}) format("woff2");font-weight:${font.weight};font-display:block}\n`
  }
  return `${css}body{margin:0;background:var(--background);color:var(--foreground);font-family:var(--font-sans)}\n`
}

const built = existsSync(join(PROJECT, 'tokens.json'))
const cards = readdirSync(SOURCE, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(SOURCE, entry.name, 'preview.html')))
  .map((entry) => entry.name)
  .toSorted()

let css = ''
let script = ''
test.beforeAll(() => {
  test.skip(!built, 'run `bun run --cwd packages/ui design-system:build` first')
  const tokens = JSON.parse(readFileSync(join(PROJECT, 'tokens.json'), 'utf8')) as Tokens
  css = tokensCss(tokens) + readFileSync(join(PROJECT, 'components/bundle.css'), 'utf8')
  script = readFileSync(join(PROJECT, 'components/bundle.js'), 'utf8')
})

async function mount(page: Page, card: string, theme: string): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const preview = readFileSync(join(SOURCE, card, 'preview.html'), 'utf8')
  const marker = /height=(\d+)/.exec(preview.split('\n')[0] ?? '')
  await page.setViewportSize({ width: 960, height: Math.max(120, Number(marker?.[1] ?? 240)) })
  await page.setContent(
    `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><title>${card}</title></head><body></body></html>`
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  await page.evaluate((markup) => {
    const template = document.createElement('template')
    template.innerHTML = markup
    // Appending moves each node out of the template, so take the first until none remain.
    for (let node = template.content.firstChild; node; node = template.content.firstChild) {
      if (node instanceof HTMLScriptElement) {
        const live = document.createElement('script')
        live.textContent = node.textContent
        node.remove()
        document.body.append(live)
      } else {
        document.body.append(node)
      }
    }
  }, preview)
  await page.waitForTimeout(250)
  return errors
}

for (const card of cards) {
  for (const theme of THEMES) {
    test(`${card} renders in ${theme}`, async ({ page }) => {
      const errors = await mount(page, card, theme)
      expect(errors, errors.join('\n')).toEqual([])
      const rendered = await page.evaluate(
        () => document.body.querySelectorAll('*:not(script):not(style)').length
      )
      expect(rendered).toBeGreaterThan(2)
      if (SHOTS) {
        const folder = resolve(import.meta.dirname, '../test-results/design-system')
        mkdirSync(folder, { recursive: true })
        await page.screenshot({ path: join(folder, `${card}-${theme}.png`), fullPage: true })
      }
    })
  }
}
