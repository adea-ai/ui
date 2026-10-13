import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { expect, test, type Page } from '@playwright/test'

type Bundle = { script: string; css: string }

/** Bundle a fixture into one script and one stylesheet, as the shell-theming lane does. */
async function bundle(entry: string, name: string): Promise<Bundle> {
  const root = resolve(import.meta.dirname, '../../../packages/ui')
  const result = await build({
    root,
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      target: 'esnext',
      lib: { entry: resolve(root, entry), formats: ['iife'], name },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((output) =>
    'output' in output ? output.output : []
  )
  return {
    script: outputs
      .filter((output) => output.type === 'chunk')
      .map((output) => output.code)
      .join('\n'),
    css: outputs
      .flatMap((output) =>
        output.type === 'asset' && output.fileName.endsWith('.css') ? [String(output.source)] : []
      )
      .join('\n'),
  }
}

/**
 * A blank page with an in-memory `localStorage` (a blank page has an opaque origin,
 * where the real one throws), optionally seeded, and a recorder for every
 * `addEventListener` made on `window`.
 */
async function open(
  page: Page,
  { script, css }: Bundle,
  options: { storage?: Record<string, string>; fixture?: object } = {}
) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Theme provider</title></head><body></body></html>'
  )
  await page.evaluate(
    ({ entries, fixture }) => {
      const backing = new Map<string, string>(Object.entries(entries))
      const store = {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => void backing.set(key, String(value)),
        removeItem: (key: string) => void backing.delete(key),
        clear: () => backing.clear(),
        key: (index: number) => [...backing.keys()][index] ?? null,
        get length() {
          return backing.size
        },
      }
      Object.defineProperty(window, 'localStorage', { configurable: true, value: store })
      ;(window as unknown as { themeFixture: unknown }).themeFixture = fixture

      const windowListeners: string[] = []
      const add = window.addEventListener.bind(window)
      window.addEventListener = ((type: string, ...rest: unknown[]) => {
        windowListeners.push(type)
        return (add as (...args: unknown[]) => void)(type, ...rest)
      }) as typeof window.addEventListener
      ;(window as unknown as { windowListeners: string[] }).windowListeners = windowListeners

      // Every inline rule that switches transitions off, even briefly.
      ;(window as unknown as { sawTransitionRule: boolean }).sawTransitionRule = false
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLStyleElement && node.textContent?.includes('transition:none')) {
              ;(window as unknown as { sawTransitionRule: boolean }).sawTransitionRule = true
            }
          }
        }
      }).observe(document.head, { childList: true })
    },
    { entries: options.storage ?? {}, fixture: options.fixture ?? {} }
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
}

const writes = (page: Page) =>
  page.evaluate(() => (window as unknown as { fixtureWrites: unknown[] }).fixtureWrites)

const html = (page: Page) => page.locator('html')
const stored = (page: Page, key: string) =>
  page.evaluate((k) => window.localStorage.getItem(k), key)
const rootProperty = (page: Page, name: string) =>
  page.evaluate((n) => document.documentElement.style.getPropertyValue(n).trim(), name)

test.describe('Cortana profile: a consumer that adopts no new prop sees no change', () => {
  let cortana: Bundle
  test.beforeAll(async () => {
    cortana = await bundle('tests/fixtures/theme-provider-cortana.tsx', 'CortanaProfile')
  })

  test('mount writes nothing, and <html> carries exactly the original attributes', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await open(page, cortana)

    await expect(page.getByTestId('appearance')).toHaveText('dark')
    expect(await stored(page, 'cortana.appearance')).toBeNull()

    expect(await html(page).evaluate((root) => root.getAttributeNames().toSorted())).toEqual([
      'class',
      'data-appearance',
      'data-font-settings',
      'data-theme',
      'data-ui-font',
      'lang',
      'style',
    ])
    await expect(html(page)).toHaveClass(/\bdark\b/)
    await expect(html(page)).toHaveAttribute('data-theme', 'adea-dark')
    await expect(html(page)).toHaveAttribute('data-appearance', 'dark')
    await expect(html(page)).toHaveAttribute('data-ui-font', 'geist')
    await expect(html(page)).not.toHaveAttribute('data-accent')
    await expect(html(page)).not.toHaveAttribute('data-density')
    await expect(html(page)).not.toHaveAttribute('data-surface')
    await expect(html(page)).not.toHaveAttribute('data-reduce-transparency')
    expect(await html(page).evaluate((root) => root.style.colorScheme)).toBe('dark')
    expect(errors).toEqual([])
  })

  test('the stored document is byte-identical to what the original provider wrote', async ({
    page,
  }) => {
    await open(page, cortana)
    await page.getByRole('button', { name: 'Pick nord' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'nord')
    expect(await stored(page, 'cortana.appearance')).toBe(
      '{"appearance":"dark","lightThemeId":"adea-light","darkThemeId":"nord","accent":"theme","font":"geist","fonts":{"ui":{"family":"geist","size":14},"content":{"family":"system","size":14},"code":{"family":"system","size":12}},"density":"comfortable"}'
    )
  })

  test('`initial` wins over a stored preference on every mount, and storage is left alone', async ({
    page,
  }) => {
    const seeded = JSON.stringify({ appearance: 'light', accent: 'violet', font: 'system' })
    await open(page, cortana, { storage: { 'cortana.appearance': seeded } })

    await expect(page.getByTestId('appearance')).toHaveText('dark')
    await expect(html(page)).toHaveClass(/\bdark\b/)
    await expect(html(page)).not.toHaveAttribute('data-accent')
    await expect(html(page)).toHaveAttribute('data-ui-font', 'geist')
    expect(await stored(page, 'cortana.appearance')).toBe(seeded)
  })

  test('a preset accent is painted verbatim, with the original attributes and bytes', async ({
    page,
  }) => {
    await open(page, cortana)
    const subtleBefore = await rootProperty(page, '--primary-subtle')
    const primaryBefore = await rootProperty(page, '--primary')
    await page.getByRole('button', { name: 'Pick violet' }).click()
    await expect(html(page)).toHaveAttribute('data-accent', 'violet')

    expect(await rootProperty(page, '--primary')).not.toBe(primaryBefore)
    for (const name of ['--primary-foreground', '--primary-hover', '--ring']) {
      expect(await rootProperty(page, name)).toMatch(/^oklch\(/)
    }
    // The tint is the theme's own, measured for it; an accent never rewrites it.
    expect(await rootProperty(page, '--primary-subtle')).toBe(subtleBefore)
    expect(await html(page).evaluate((root) => root.getAttributeNames().toSorted())).toEqual([
      'class',
      'data-accent',
      'data-appearance',
      'data-font-settings',
      'data-theme',
      'data-ui-font',
      'lang',
      'style',
    ])
    expect(await stored(page, 'cortana.appearance')).toBe(
      '{"appearance":"dark","lightThemeId":"adea-light","darkThemeId":"adea-dark","accent":"violet","font":"geist","fonts":{"ui":{"family":"geist","size":14},"content":{"family":"system","size":14},"code":{"family":"system","size":12}},"density":"comfortable"}'
    )
  })

  test('`themes` is a plain array of the whole catalogue', async ({ page }) => {
    await open(page, cortana)
    await expect(page.getByTestId('themes-is-array')).toHaveText('true')
    await expect(page.getByTestId('themes-count')).toHaveText('34')
  })

  test('a change adds no window listener, no <style> element and no transition rule', async ({
    page,
  }) => {
    await open(page, cortana)
    const styleCount = () => page.evaluate(() => document.head.querySelectorAll('style').length)
    const before = await styleCount()
    await page.getByRole('button', { name: 'Pick nord' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'nord')
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done()))
        )
    )

    expect(await styleCount()).toBe(before)
    expect(
      await page.evaluate(
        () => (window as unknown as { sawTransitionRule: boolean }).sawTransitionRule
      )
    ).toBe(false)
    expect(
      await page.evaluate(
        () => (window as unknown as { windowListeners: string[] }).windowListeners
      )
    ).not.toContain('keydown')
  })
})

test.describe('superset profile: persistence, extra themes, preview', () => {
  let superset: Bundle
  test.beforeAll(async () => {
    superset = await bundle('tests/fixtures/theme-provider-superset.tsx', 'SupersetProfile')
  })

  test('a context is found from outside the tree as undefined, and inside as the same object', async ({
    page,
  }) => {
    await open(page, superset, { fixture: { stored: { mode: 'dark' } } })
    await expect(page.getByTestId('outside')).toHaveText('true')
    await expect(page.getByTestId('same-context')).toHaveText('true')
    expect(await page.evaluate(() => Symbol.for('adea.ui.theme') in globalThis)).toBe(true)
  })

  test('an unknown stored LIGHT id paints the light default and stays in the selection', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await open(page, superset, {
      fixture: { stored: { mode: 'light', lightThemeId: 'custom-gone' } },
    })

    await expect(page.getByTestId('committed-appearance')).toHaveText('light')
    await expect(html(page)).toHaveAttribute('data-theme', 'adea-light')
    await expect(html(page)).not.toHaveClass(/\bdark\b/)
    expect(await html(page).evaluate((root) => root.style.colorScheme)).toBe('light')
    // Resolved, not rewritten: the id the host stored is still the id it holds.
    await expect(page.getByTestId('light-id')).toHaveText('custom-gone')
    expect(await writes(page)).toEqual([])
    expect(errors).toEqual([])
  })

  test('preview paints a draft without persisting it; a commit ends it', async ({ page }) => {
    await open(page, superset, { fixture: { stored: { mode: 'dark' } } })
    await expect(html(page)).toHaveAttribute('data-theme', 'adea-dark')
    await expect(page.getByTestId('previewing')).toHaveText('false')
    const committedBackground = await rootProperty(page, '--background')

    await page.getByRole('button', { name: 'Preview nord' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'nord')
    await expect(page.getByTestId('previewing')).toHaveText('true')
    // What is committed has not moved, and nothing was written.
    await expect(page.getByTestId('committed-variant')).toHaveText('adea-dark')
    await expect(page.getByTestId('dark-id')).toHaveText('adea-dark')
    expect(await rootProperty(page, '--background')).not.toBe(committedBackground)
    expect(await writes(page)).toEqual([])

    await page.getByRole('button', { name: 'End preview' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'adea-dark')
    await expect(page.getByTestId('previewing')).toHaveText('false')
    expect(await rootProperty(page, '--background')).toBe(committedBackground)

    await page.getByRole('button', { name: 'Preview nord' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'nord')
    await page.getByRole('button', { name: 'Commit nord' }).click()
    await expect(page.getByTestId('previewing')).toHaveText('false')
    await expect(page.getByTestId('committed-variant')).toHaveText('nord')
    await expect(html(page)).toHaveAttribute('data-theme', 'nord')
    expect(await writes(page)).toEqual([
      {
        version: 2,
        mode: 'dark',
        lightThemeId: 'adea-light',
        darkThemeId: 'nord',
        accent: 'theme',
      },
    ])
  })

  test('extra themes resolve a stored id, paint verbatim, and are swept when removed', async ({
    page,
  }) => {
    await open(page, superset, {
      fixture: { withCustom: true, stored: { mode: 'dark', darkThemeId: 'custom-nord' } },
    })

    await expect(html(page)).toHaveAttribute('data-theme', 'custom-nord')
    await expect(page.getByTestId('all-count')).toHaveText('35')
    await expect(page.getByTestId('themes-count')).toHaveText('34')
    expect(await rootProperty(page, '--background')).toBe('#102030')
    expect(await rootProperty(page, '--custom-extra')).toBe('1')

    await page.getByRole('button', { name: 'Remove custom' }).click()
    // The id is still stored; the theme is gone, so the dark default paints and the
    // property only the imported theme owned is not left behind to beat the stylesheet.
    await expect(html(page)).toHaveAttribute('data-theme', 'adea-dark')
    await expect(page.getByTestId('dark-id')).toHaveText('custom-nord')
    await expect(page.getByTestId('all-count')).toHaveText('34')
    expect(await rootProperty(page, '--custom-extra')).toBe('')
    expect(await rootProperty(page, '--background')).not.toBe('#102030')
  })

  test('transformTokens rewrites what reaches the document', async ({ page }) => {
    await open(page, superset, { fixture: { hex: true, stored: { mode: 'dark' } } })
    await expect(html(page)).toHaveAttribute('data-theme', 'adea-dark')
    expect(await rootProperty(page, '--background')).toMatch(/^#[0-9a-f]{6}$/)
    expect(await rootProperty(page, '--terminal-ansi-red')).toMatch(/^#[0-9a-f]{6}$/)
  })

  test('without transformTokens the roles are written as the catalogue spells them', async ({
    page,
  }) => {
    await open(page, superset, { fixture: { stored: { mode: 'dark' } } })
    await expect(html(page)).toHaveAttribute('data-theme', 'adea-dark')
    expect(await rootProperty(page, '--background')).toMatch(/^oklch\(/)
  })

  test('disableTransitionOnChange holds a rule over the change and removes it after', async ({
    page,
  }) => {
    await open(page, superset, { fixture: { transitions: true, stored: { mode: 'dark' } } })
    await page.getByRole('button', { name: 'Commit nord' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'nord')
    expect(
      await page.evaluate(
        () => (window as unknown as { sawTransitionRule: boolean }).sawTransitionRule
      )
    ).toBe(true)
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.head.querySelectorAll('style')].some((style) =>
            style.textContent?.includes('transition:none')
          )
        )
      )
      .toBe(false)
  })

  test('a custom colour is painted as roles, named `custom`, raised to the floor, and stored as chosen', async ({
    page,
  }) => {
    await open(page, superset, { fixture: { stored: { mode: 'light' } } })
    await page.getByRole('button', { name: 'Custom blue' }).click()
    await expect(html(page)).toHaveAttribute('data-accent', 'custom')
    expect(await rootProperty(page, '--primary')).toMatch(/^oklch\(/)
    expect(await writes(page)).toEqual([
      {
        version: 2,
        mode: 'light',
        lightThemeId: 'adea-light',
        darkThemeId: 'adea-dark',
        accent: '#0b57d0',
      },
    ])

    // Too pale to read on a light surface: the roles are repaired, the choice is not.
    await page.getByRole('button', { name: 'Custom pale' }).click()
    const pale = await rootProperty(page, '--primary')
    const requested = await page.evaluate(() => {
      const probe = document.createElement('i')
      probe.style.color = '#f4f4f4'
      document.body.append(probe)
      return getComputedStyle(probe).color
    })
    expect(pale).not.toBe(requested)
    expect(await writes(page)).toHaveLength(2)
    expect((await writes(page))![1]).toMatchObject({ accent: '#f4f4f4' })
  })

  test('accentContrastFloor repairs a preset the catalogue measured, and only when asked', async ({
    page,
  }) => {
    const primaryWith = async (accentFloor?: number) => {
      // A page per run: a second `setContent` would leave the first run's <html> behind.
      const run = await page.context().newPage()
      await open(run, superset, {
        fixture: { stored: { mode: 'dark', accent: 'violet' }, accentFloor },
      })
      await expect(html(run)).toHaveAttribute('data-accent', 'violet')
      const primary = await rootProperty(run, '--primary')
      await run.close()
      return primary
    }

    const verbatim = await primaryWith()
    expect(verbatim).toMatch(/^oklch\(/)
    expect(await primaryWith(3)).toBe(verbatim)
    expect(await primaryWith(12)).not.toBe(verbatim)
  })

  test('accentRolesFor paints one element, tint included, without touching the document', async ({
    page,
  }) => {
    await open(page, superset, { fixture: { stored: { mode: 'dark', accent: 'violet' } } })
    await expect(page.getByTestId('unknown-roles')).toHaveText('true')

    const scoped = page.getByTestId('scoped')
    const read = (name: string) =>
      scoped.evaluate(
        (element, property) => getComputedStyle(element).getPropertyValue(property).trim(),
        name
      )
    const own = await scoped.evaluate((element) => element.style.getPropertyValue('--primary'))
    expect(own).toMatch(/^oklch\(/)
    expect(own).not.toBe(await rootProperty(page, '--primary'))

    // `--primary-subtle` is a var() resolved where it is declared: the element's
    // tint must be a mix over the element's primary, not the document's.
    const tint = await read('--primary-subtle')
    expect(tint).toContain(own)
    expect(tint).not.toContain(await rootProperty(page, '--primary'))
    expect(await rootProperty(page, '--primary-subtle')).not.toContain(own)
  })

  test('a persistence that throws on read starts from the defaults', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await open(page, superset, { fixture: { throwOnRead: true } })
    await expect(html(page)).toHaveAttribute('data-theme', 'adea-light')
    expect(errors).toEqual([])
  })

  test('a persistence that throws on write costs the preference, not the switch', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await open(page, superset, { fixture: { throwOnWrite: true, stored: { mode: 'dark' } } })
    await page.getByRole('button', { name: 'Commit nord' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'nord')
    await expect(page.getByTestId('dark-id')).toHaveText('nord')
    expect(errors).toEqual([])
  })
})
