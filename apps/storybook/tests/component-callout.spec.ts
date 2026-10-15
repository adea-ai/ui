import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

let script: string
let css: string

test.beforeAll(async () => {
  const result = await build({
    root: resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/callout.tsx'),
        formats: ['iife'],
        name: 'CalloutFixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  script = assets
    .filter((asset) => asset.type === 'chunk')
    .map((asset) => asset.code)
    .join('\n')
  css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\n')
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Callouts</title></head><body></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

/**
 * Cortana's three local answer-view callouts, copied verbatim from
 * apps/web/src/shadcn.css (`.answer-copy`, `.answer-memory`, `.answer-note`), keeping only
 * the properties that make the callout itself: the box, the rule and the surface. Their
 * margins and flex gap are layout around the callout and stay with the consumer.
 */
const cortanaCss = `
  .answer-copy { padding: 22px 24px; border-left: 3px solid var(--primary); background: var(--card); }
  .answer-memory { padding: 18px 20px; border-left: 3px solid var(--primary); background: var(--card); }
  .answer-note { padding: 12px 14px; border-left: 2px solid var(--primary); background: var(--card); }
`

const props = [
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderLeftWidth',
  'borderLeftStyle',
  'borderLeftColor',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'backgroundColor',
  'boxSizing',
] as const

const pairs = [
  { size: 'lg', cortana: 'answer-copy' },
  { size: 'md', cortana: 'answer-memory' },
  { size: 'sm', cortana: 'answer-note' },
] as const

const computed = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((element, names) => {
    const style = getComputedStyle(element)
    return Object.fromEntries(names.map((name) => [name, style[name]]))
  }, props)

test('role="note" by default, no live region, and a caller role replaces it', async ({ page }) => {
  const note = page.getByTestId('default')
  await expect(note).toHaveAttribute('role', 'note')
  await expect(note).toHaveAttribute('data-slot', 'callout')
  await expect(note).not.toHaveAttribute('aria-live', /.*/)
  expect(await note.evaluate((element) => element.tagName)).toBe('DIV')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByTestId('role')).toHaveAttribute('role', 'region')
  await expect(page.getByRole('region', { name: 'Release summary' })).toBeVisible()
  await expect(page.getByRole('note')).not.toHaveCount(0)
})

test('ref and class pass through to the element', async ({ page }) => {
  const same = await page.evaluate(
    () =>
      (window as unknown as { calloutRef?: Element }).calloutRef ===
      document.querySelector('[data-testid="ref"]')
  )
  expect(same).toBe(true)
  await expect(page.getByTestId('ref')).toHaveClass(/\bmt-4\b/)
  await expect(page.getByTestId('title')).toHaveAttribute('data-slot', 'callout-title')
})

test('sizes match the three Cortana answer-view callouts: padding, rule, surface', async ({
  page,
}, testInfo) => {
  await page.addStyleTag({ content: cortanaCss })
  await page.evaluate((entries) => {
    const host = document.createElement('div')
    host.dataset['testid'] = 'cortana-host'
    for (const { cortana } of entries) {
      const el = document.createElement('div')
      el.className = cortana
      el.dataset['testid'] = `cortana-${cortana}`
      el.textContent = cortana
      host.append(el)
    }
    document.body.append(host)
  }, pairs)

  const comparison: Record<string, unknown> = {}
  for (const { size, cortana } of pairs) {
    const ours = await computed(page, `default-${size}`)
    const theirs = await computed(page, `cortana-${cortana}`)
    comparison[size] = { cortana, library: ours, cortanaCss: theirs }
    // Same padding, rule width/style/colour, other edges and surface.
    for (const name of props.filter(
      (n) => n !== 'borderTopLeftRadius' && n !== 'borderTopRightRadius'
    )) {
      expect(ours[name], `${size} ${name}`).toBe(theirs[name])
    }
    // Cortana's boxes are square, and so is the callout.
    expect(ours.borderTopLeftRadius).toBe('0px')
    expect(ours.borderTopRightRadius).toBe('0px')
    expect(theirs.borderTopLeftRadius).toBe('0px')
  }

  expect(await computed(page, 'default-lg')).toMatchObject({
    paddingTop: '22px',
    paddingRight: '24px',
    paddingBottom: '22px',
    paddingLeft: '24px',
    borderLeftWidth: '3px',
  })
  expect(await computed(page, 'default-md')).toMatchObject({
    paddingTop: '18px',
    paddingLeft: '20px',
    borderLeftWidth: '3px',
  })
  expect(await computed(page, 'default-sm')).toMatchObject({
    paddingTop: '12px',
    paddingLeft: '14px',
    borderLeftWidth: '2px',
  })

  const out = process.env['CALLOUT_PROOF_DIR']
  if (out) {
    mkdirSync(out, { recursive: true })
    writeFileSync(
      resolve(out, `sizing-parity-${testInfo.project.name}.json`),
      JSON.stringify(comparison, null, 2) + '\n'
    )
  }
})

test('every variant paints its rule in its own token colour and only the start edge', async ({
  page,
}) => {
  const rule: Record<string, string> = {}
  for (const variant of ['default', 'destructive', 'success', 'warning', 'info']) {
    const s = await computed(page, `${variant}-md`)
    rule[variant] = s.borderLeftColor ?? ''
    expect(s.borderTopWidth).toBe('0px')
    expect(s.borderRightWidth).toBe('0px')
    expect(s.borderBottomWidth).toBe('0px')
  }
  const tokens = await page.evaluate(() => {
    const probe = document.createElement('span')
    document.body.append(probe)
    const resolved: Record<string, string> = {}
    for (const name of ['primary', 'destructive', 'success', 'warning', 'info']) {
      probe.style.color = `var(--${name})`
      resolved[name === 'primary' ? 'default' : name] = getComputedStyle(probe).color
    }
    probe.remove()
    return resolved
  })
  expect(rule).toEqual(tokens)
  expect(new Set(Object.values(rule)).size).toBe(5)
})

test('the rule is on the start edge: left in LTR, right in RTL', async ({ page }) => {
  const ltr = await computed(page, 'default-md')
  expect(ltr.borderLeftWidth).toBe('3px')
  const rtl = await page.getByTestId('rtl').evaluate((element) => {
    const style = getComputedStyle(element)
    return { left: style.borderLeftWidth, right: style.borderRightWidth }
  })
  expect(rtl).toEqual({ left: '0px', right: '3px' })
})

test('narrow containers wrap the text, fill the width and keep the rule full height', async ({
  page,
}) => {
  const wrap = await page.getByTestId('narrow-wrap').boundingBox()
  const box = await page.getByTestId('narrow').boundingBox()
  expect(wrap && box).toBeTruthy()
  expect(Math.round(box!.width)).toBe(Math.round(wrap!.width))
  expect(box!.height).toBeGreaterThan(60)
  const overflow = await page
    .getByTestId('narrow')
    .evaluate((element) => element.scrollWidth - element.clientWidth)
  expect(overflow).toBe(0)
})
