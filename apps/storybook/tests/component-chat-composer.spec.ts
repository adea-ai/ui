import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
        entry: resolve(
          import.meta.dirname,
          '../../../packages/ui/tests/fixtures/chat-composer.tsx'
        ),
        formats: ['iife'],
        name: 'ChatComposerFixture',
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
    '<!doctype html><html lang="en"><head><title>Composer</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('collapse retains the host draft, unmounts input and shelf, and restores focused input', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await field.fill('First line of unsent draft\nSecond line')
  const changes = await page.getByLabel('Draft changes').textContent()
  await page.getByRole('button', { name: 'Message input options' }).press('ArrowDown')
  await page.getByRole('menuitem', { name: /Collapse the message input/ }).click()
  const bar = page.getByRole('button', { name: 'Show the message input', exact: true })
  await expect(bar).toBeFocused()
  await expect(field).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Model context' })).toHaveCount(0)
  await expect(bar).toContainText('First line of unsent draft')
  await expect(bar).not.toContainText('Second line')
  await expect(page.getByLabel('Draft changes')).toHaveText(changes!)
  await bar.click()
  await expect(field).toBeFocused()
  await expect(field).toHaveValue('First line of unsent draft\nSecond line')
  await expect(page.getByRole('button', { name: 'Model context' })).toBeVisible()
})
test('typing intent expands this instance without focusing a different conversation', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Message input options' }).click()
  await page.getByRole('menuitem', { name: /Collapse the message input/ }).click()
  await page.getByRole('textbox', { name: 'Other conversation' }).fill('Separate draft')
  await page.getByRole('button', { name: 'Compose here' }).click()
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Other conversation' })).toHaveValue(
    'Separate draft'
  )
})
test('failed delivery leaves the draft and exposes recovery through the composed input', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await field.fill('Keep this draft')
  await field.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Message not sent')
  await expect(field).toHaveValue('Keep this draft')
  await page.getByRole('button', { name: 'Recover delivery' }).click()
  await field.press('Enter')
  await expect(page.getByLabel('Sent')).toHaveText('1')
  await expect(field).toHaveValue('')
})

test('collapse keeps the caret selection and options remain available at phone width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 })
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await field.fill('Keep selected words')
  await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(5, 13, 'backward')
  })
  await page.getByRole('button', { name: 'Message input options' }).click()
  await page.getByRole('menuitem', { name: /Collapse the message input/ }).click()
  await page.getByRole('button', { name: 'Show the message input', exact: true }).click()
  await expect(field).toBeFocused()
  expect(
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      return [element.selectionStart, element.selectionEnd, element.selectionDirection]
    })
  ).toEqual([5, 13, 'backward'])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('the knowledge, follow-ups and adjacent band preserve their source order above staged content', async ({
  page,
}) => {
  const order = await page
    .locator('[data-slot="chat-composer"]')
    .evaluate((element) =>
      Array.from(element.querySelectorAll('[data-slot]')).map((child) =>
        child.getAttribute('data-slot')
      )
    )
  expect(order.indexOf('composer-knowledge')).toBeLessThan(order.indexOf('composer-follow-ups'))
  expect(order.indexOf('composer-follow-ups')).toBeLessThan(order.indexOf('composer-band'))
  expect(order.indexOf('composer-band')).toBeLessThan(order.indexOf('composer-staged-content'))
  expect(order.indexOf('composer-staged-content')).toBeLessThan(order.indexOf('composer-input'))
  expect(order.indexOf('composer-input')).toBeLessThan(order.indexOf('composer-action-row'))
  expect(order.indexOf('composer-action-row')).toBeLessThan(order.indexOf('composer-context'))
})

test('busy keyboard and picker share controlled mode and alternate gesture without firing on selection', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await page.getByRole('button', { name: 'Recover delivery' }).click()
  await page.getByRole('button', { name: 'Run busy' }).click()
  await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Send options' }).click()
  await page.getByRole('menuitemradio', { name: /Queue/ }).click()
  await expect(page.getByLabel('Submitted action')).toHaveText('none')
  await field.fill('A queued message')
  await field.press('Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('queue')
  await field.fill('Act now instead')
  await field.press('Control+Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('steer')
  await field.fill('Native candidate')
  const prevented = await field.evaluate((element) => {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    })
    element.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(prevented).toBe(false)
  await expect(field).toHaveValue('Native candidate')
  await expect(page.getByLabel('Sent')).toHaveText('2')
})

test('connectivity and approval focus remain truthful and retain the host draft', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await field.fill('A draft kept during review')
  await page.getByRole('button', { name: 'Disconnect' }).click()
  await expect(page.locator('[data-slot="chat-composer"]').getByRole('status')).toContainText(
    'Reconnect before delivery'
  )
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled()
  await field.press('Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('none')
  await page.getByRole('button', { name: 'Focus approval' }).click()
  await expect(field).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Model context' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Return to input' }).click()
  await expect(field).toHaveValue('A draft kept during review')
})

test('late refusal from an older host scope cannot repaint feedback in the current one', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await page.getByRole('button', { name: 'Delay delivery' }).click()
  await field.fill('Originating draft')
  await field.press('Enter')
  await expect(field).toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: 'Change scope' }).click()
  await expect(field).not.toHaveAttribute('readonly', '')
  await expect(field).toHaveValue('New scope draft')
  await page.getByRole('button', { name: 'Refuse old delivery' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(field).toHaveValue('New scope draft')
})

for (const density of ['comfortable', 'compact']) {
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 768, 1024, 1440]) {
      test(`composition stays usable at ${width}px in ${theme}/${density}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 800 })
        await page.evaluate(
          ({ selectedDensity, selectedTheme }) => {
            document.documentElement.classList.toggle('dark', selectedTheme === 'dark')
            document.documentElement.setAttribute('data-density', selectedDensity)
          },
          { selectedDensity: density, selectedTheme: theme }
        )
        const field = page.getByRole('textbox', { name: 'Message', exact: true })
        await field.fill('A draft while changing appearance')
        await field.focus()
        await expect(field).toHaveValue('A draft while changing appearance')
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true
        )
        const result = await new AxeBuilder({ page })
          .include('[data-slot="chat-composer"]')
          .analyze()
        expect(
          result.violations.filter((violation) =>
            ['serious', 'critical'].includes(violation.impact ?? '')
          )
        ).toEqual([])
        await page
          .locator('[data-slot="chat-composer"]')
          .screenshot({ path: testInfo.outputPath(`composer-${theme}-${density}-${width}.png`) })
      })
    }
  }
}

test('clean native Node server rendering supports expanded and collapsed compositions', async () => {
  const result = await build({
    root: resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [solid({ ssr: true })],
    ssr: { noExternal: true },
    build: {
      write: false,
      minify: false,
      ssr: resolve(
        import.meta.dirname,
        '../../../packages/ui/tests/fixtures/chat-composer-ssr.tsx'
      ),
    },
  })
  const chunks = (Array.isArray(result) ? result : [result])
    .flatMap((output) => ('output' in output ? output.output : []))
    .filter((asset) => asset.type === 'chunk')
  expect(chunks).toHaveLength(1)
  const directory = await mkdtemp(resolve(tmpdir(), 'adea-chat-composer-ssr-'))
  try {
    const chunk = chunks[0]
    if (!chunk) throw new Error('Missing SSR chunk')
    await writeFile(resolve(directory, 'fixture.mjs'), chunk.code)
    await writeFile(
      resolve(directory, 'render.mjs'),
      "import { renderComposer } from './fixture.mjs'; process.stdout.write(JSON.stringify([renderComposer(false),renderComposer(true)]));"
    )
    const [expanded, collapsed] = JSON.parse(
      execFileSync(process.execPath, [resolve(directory, 'render.mjs')], { encoding: 'utf8' })
    )
    expect(expanded).toContain('data-slot="composer-input"')
    expect(expanded).toContain('data-slot="composer-context"')
    expect(collapsed).not.toContain('data-slot="composer-input"')
    expect(collapsed).not.toContain('data-slot="composer-context"')
    expect(collapsed).toContain('Show the message input')
    expect(collapsed).toContain('A server-side draft')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('native content sizing grows multiline drafts, caps long ones and responds to width', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  expect(await page.evaluate(() => CSS.supports('field-sizing', 'content'))).toBe(true)
  const initial = (await field.boundingBox())!.height
  await field.fill('First line\nSecond line\nThird line')
  expect((await field.boundingBox())!.height).toBeGreaterThan(initial)
  await field.fill('Long draft line\n'.repeat(40))
  const geometry = await field.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    max: Number.parseFloat(getComputedStyle(element).maxHeight),
    overflow: element.scrollHeight > element.clientHeight,
  }))
  expect(geometry.height).toBeLessThanOrEqual(geometry.max + 1)
  expect(geometry.overflow).toBe(true)
  await field.fill('A draft that wraps only when the composer becomes a narrow phone width.')
  await page.setViewportSize({ width: 1440, height: 800 })
  const wide = (await field.boundingBox())!.height
  await page.setViewportSize({ width: 320, height: 800 })
  expect((await field.boundingBox())!.height).toBeGreaterThan(wide)
})

test('reference-only drafts queue without allowing a steer gesture', async ({ page }) => {
  await page.getByRole('button', { name: 'Recover delivery' }).click()
  await page.getByRole('button', { name: 'Stage references' }).click()
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Run busy' }).click()
  await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Send options' }).click()
  await page.getByRole('menuitemradio', { name: /Queue/ }).click()
  await expect(page.getByLabel('Submitted action')).toHaveText('none')
  await expect(page.getByRole('button', { name: 'Queue message', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Send options' }).click()
  await expect(page.getByText('Ctrl/Cmd+Enter uses the other action', { exact: true })).toHaveCount(
    0
  )
  await page.keyboard.press('Escape')
  await page.getByRole('textbox', { name: 'Message', exact: true }).press('Control+Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('none')
  await page.getByRole('button', { name: 'Queue message', exact: true }).click()
  await expect(page.getByLabel('Submitted action')).toHaveText('queue')
  await expect(page.getByLabel('Sent')).toHaveText('1')
})

test('host payload eligibility can refuse steering even when a draft contains text', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await page.getByRole('button', { name: 'Recover delivery' }).click()
  await field.fill('Context that cannot be steered')
  await page.getByRole('button', { name: 'Stage references' }).click()
  await page.getByRole('button', { name: 'Run busy' }).click()
  await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeDisabled()
  await field.press('Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('none')
  await expect(field).toHaveValue('Context that cannot be steered')
  await field.press('Control+Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('queue')
  await expect(page.getByLabel('Sent')).toHaveText('1')
})
