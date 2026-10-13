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
      // Registered before `addEventListener` is wrapped below, so it is not counted as
      // the provider's: a handler that already handled the chord, for the zoom guard.
      window.addEventListener(
        'keydown',
        (event) => {
          if ((window as unknown as { blockKeys?: boolean }).blockKeys) event.preventDefault()
        },
        { capture: true }
      )

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

      // The operating system's Reduce Transparency setting, which no browser lets a
      // test emulate: a controllable stand-in for that one query, every other query
      // passed through. Every query asked for is recorded.
      const reduceQuery = '(prefers-reduced-transparency: reduce)'
      const queries: string[] = []
      const reduceListeners = new Set<(event: { matches: boolean }) => void>()
      let osReduce = (fixture as { osReduce?: boolean }).osReduce === true
      const nativeMatchMedia = window.matchMedia.bind(window)
      window.matchMedia = ((query: string) => {
        queries.push(query)
        if (query !== reduceQuery) return nativeMatchMedia(query)
        return {
          get matches() {
            return osReduce
          },
          media: query,
          addEventListener(type: string, listener: (event: { matches: boolean }) => void) {
            if (type === 'change') reduceListeners.add(listener)
          },
          removeEventListener(type: string, listener: (event: { matches: boolean }) => void) {
            if (type === 'change') reduceListeners.delete(listener)
          },
        } as unknown as MediaQueryList
      }) as typeof window.matchMedia
      Object.assign(window, {
        mediaQueries: queries,
        reduceListenerCount: () => reduceListeners.size,
        setOsReduce(value: boolean) {
          osReduce = value
          for (const listener of reduceListeners) listener({ matches: value })
        },
      })

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

const osReduce = (page: Page, value: boolean) =>
  page.evaluate(
    (v) => (window as unknown as { setOsReduce: (v: boolean) => void }).setOsReduce(v),
    value
  )
const frost = (page: Page, testId = 'dialog-probe') =>
  page.getByTestId(testId).evaluate((element) => {
    const style = getComputedStyle(element)
    return { filter: style.backdropFilter, background: style.backgroundColor }
  })

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

  test('the surface axis stays off: no media query is read and no listener is attached', async ({
    page,
  }) => {
    await open(page, cortana)
    await page.getByRole('button', { name: 'Pick nord' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'nord')
    const queries = await page.evaluate(
      () => (window as unknown as { mediaQueries: string[] }).mediaQueries
    )
    expect(queries).not.toContain('(prefers-reduced-transparency: reduce)')
    expect(
      await page.evaluate(() =>
        (window as unknown as { reduceListenerCount: () => number }).reduceListenerCount()
      )
    ).toBe(0)
    await expect(html(page)).not.toHaveAttribute('data-surface')
    await expect(html(page)).not.toHaveAttribute('data-reduce-transparency')
    expect(await rootProperty(page, '--surface-alpha')).toBe('')
    expect(await stored(page, 'cortana.appearance')).not.toMatch(
      /surface|terminalThemeId|reduceTransparency/
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

test.describe('superset profile: surface, terminal pin, stylesheet palette, font zoom', () => {
  let superset: Bundle
  test.beforeAll(async () => {
    superset = await bundle('tests/fixtures/theme-provider-superset.tsx', 'SupersetSurface')
  })

  test('without the prop the axis writes nothing, and a stored surface turns it on by itself', async ({
    page,
  }) => {
    await open(page, superset, { fixture: { stored: { mode: 'dark' } } })
    await expect(html(page)).toHaveAttribute('data-theme', 'adea-dark')
    await expect(html(page)).not.toHaveAttribute('data-surface')
    await expect(page.getByTestId('effective-surface')).toHaveText('opaque')
    expect((await frost(page)).filter).toBe('none')

    const seeded = await page.context().newPage()
    await open(seeded, superset, { fixture: { stored: { mode: 'dark', surface: 'frosted' } } })
    await expect(html(seeded)).toHaveAttribute('data-surface', 'frosted')
    await expect(html(seeded)).toHaveAttribute('data-reduce-transparency', 'false')
    expect(await rootProperty(seeded, '--surface-alpha')).toBe('0.92')
    await seeded.close()
  })

  test('opaque, frosted and translucent each write their attribute and alpha; frost needs `frosted`', async ({
    page,
  }) => {
    await open(page, superset, {
      fixture: {
        surface: { nativeTranslucency: true },
        recordSelection: true,
        stored: { mode: 'dark' },
      },
    })
    await expect(html(page)).toHaveAttribute('data-surface', 'opaque')
    expect(await rootProperty(page, '--surface-alpha')).toBe('1')
    expect((await frost(page)).filter).toBe('none')

    await page.getByRole('button', { name: 'Frosted' }).click()
    await expect(html(page)).toHaveAttribute('data-surface', 'frosted')
    await expect(page.getByTestId('effective-surface')).toHaveText('frosted')
    expect(await rootProperty(page, '--surface-alpha')).toBe('0.92')
    const frosted = await frost(page)
    expect(frosted.filter).toContain('blur')
    expect(frosted.background).not.toBe((await frost(page, 'sheet-probe')).background)
    // A sheet carries `data-variant` and keeps its own bands.
    expect((await frost(page, 'sheet-probe')).filter).toBe('none')

    await page.getByRole('button', { name: 'Translucent' }).click()
    await expect(html(page)).toHaveAttribute('data-surface', 'translucent')
    await expect(page.getByTestId('effective-surface')).toHaveText('translucent')
    expect(await rootProperty(page, '--surface-alpha')).toBe('0.8')

    expect((await writes(page))!.at(-1)).toMatchObject({ surface: 'translucent' })
  })

  test('translucent is frosted until the host can render it', async ({ page }) => {
    await open(page, superset, { fixture: { surface: true, stored: { mode: 'dark' } } })
    await page.getByRole('button', { name: 'Translucent' }).click()
    await expect(html(page)).toHaveAttribute('data-surface', 'frosted')
    await expect(page.getByTestId('effective-surface')).toHaveText('frosted')
    expect(await rootProperty(page, '--surface-alpha')).toBe('0.92')
  })

  test('the OS setting forces opaque and is followed live through one listener', async ({
    page,
  }) => {
    await open(page, superset, {
      fixture: { surface: true, osReduce: true, stored: { mode: 'dark', surface: 'frosted' } },
    })
    await expect(html(page)).toHaveAttribute('data-surface', 'opaque')
    await expect(html(page)).toHaveAttribute('data-reduce-transparency', 'true')
    await expect(page.getByTestId('reduce-active')).toHaveText('true')
    expect(await rootProperty(page, '--surface-alpha')).toBe('1')
    expect((await frost(page)).filter).toBe('none')

    await osReduce(page, false)
    await expect(html(page)).toHaveAttribute('data-surface', 'frosted')
    await expect(html(page)).toHaveAttribute('data-reduce-transparency', 'false')
    expect((await frost(page)).filter).toContain('blur')

    await osReduce(page, true)
    await expect(html(page)).toHaveAttribute('data-surface', 'opaque')
    expect(
      await page.evaluate(() =>
        (window as unknown as { reduceListenerCount: () => number }).reduceListenerCount()
      )
    ).toBe(1)
  })

  test('the user flag forces opaque without the OS, and is stored', async ({ page }) => {
    await open(page, superset, {
      fixture: {
        surface: true,
        recordSelection: true,
        stored: { mode: 'dark', surface: 'frosted' },
      },
    })
    await expect(html(page)).toHaveAttribute('data-surface', 'frosted')
    await page.getByRole('button', { name: 'Reduce on' }).click()
    await expect(html(page)).toHaveAttribute('data-surface', 'opaque')
    await expect(html(page)).toHaveAttribute('data-reduce-transparency', 'true')
    await expect(page.getByTestId('reduce-active')).toHaveText('true')
    await page.getByRole('button', { name: 'Reduce off' }).click()
    await expect(html(page)).toHaveAttribute('data-surface', 'frosted')
    expect((await writes(page))!.at(-1)).toMatchObject({
      surface: 'frosted',
      reduceTransparency: false,
    })
  })

  test('a pinned terminal palette overlays the interface variant, and unpinning gives it back', async ({
    page,
  }) => {
    await open(page, superset, { fixture: { stored: { mode: 'dark', darkThemeId: 'nord' } } })
    const own = await rootProperty(page, '--terminal-background')
    const ownRed = await rootProperty(page, '--terminal-ansi-red')

    await page.getByRole('button', { name: 'Pin dracula' }).click()
    await expect.poll(() => rootProperty(page, '--terminal-background')).not.toBe(own)
    expect(await rootProperty(page, '--terminal-ansi-red')).not.toBe(ownRed)
    // Only the terminal moved.
    await expect(html(page)).toHaveAttribute('data-theme', 'nord')

    // An id that holds no palette is the interface palette, not a blank terminal.
    await page.getByRole('button', { name: 'Pin missing' }).click()
    await expect.poll(() => rootProperty(page, '--terminal-background')).toBe(own)

    await page.getByRole('button', { name: 'Pin dracula' }).click()
    await expect.poll(() => rootProperty(page, '--terminal-background')).not.toBe(own)
    await page.getByRole('button', { name: 'Unpin terminal' }).click()
    await expect.poll(() => rootProperty(page, '--terminal-background')).toBe(own)
    expect(await rootProperty(page, '--terminal-ansi-red')).toBe(ownRed)
  })

  test("palette 'stylesheet' writes no catalogue palette inline, sweeps an imported theme, keeps the pin", async ({
    page,
  }) => {
    await open(page, superset, {
      fixture: {
        palette: 'stylesheet',
        withCustom: true,
        stored: { mode: 'dark', darkThemeId: 'custom-nord' },
      },
    })
    await expect(html(page)).toHaveAttribute('data-theme', 'custom-nord')
    expect(await rootProperty(page, '--background')).toBe('#102030')
    expect(await rootProperty(page, '--custom-extra')).toBe('1')

    await page.getByRole('button', { name: 'Remove custom' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'adea-dark')
    for (const name of ['--background', '--custom-extra', '--terminal-background', '--primary']) {
      expect(await rootProperty(page, name), `${name} left inline`).toBe('')
    }

    await page.getByRole('button', { name: 'Commit nord' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'nord')
    expect(await rootProperty(page, '--background')).toBe('')

    await page.getByRole('button', { name: 'Pin dracula' }).click()
    await expect.poll(() => rootProperty(page, '--terminal-background')).toMatch(/^oklch\(/)
    expect(await rootProperty(page, '--background')).toBe('')
    await page.getByRole('button', { name: 'Unpin terminal' }).click()
    await expect.poll(() => rootProperty(page, '--terminal-background')).toBe('')
  })

  test('fontZoom steps the three sizes with the chords, persists, and leaves handled events alone', async ({
    page,
  }) => {
    await open(page, superset, { fixture: { fontZoom: true, recordSelection: true } })
    const size = () => page.getByTestId('ui-size')
    await expect(size()).toHaveText('14')
    await expect(page.getByTestId('code-size')).toHaveText('12')

    await page.keyboard.press('Control+=')
    await expect(size()).toHaveText('15')
    await expect(page.getByTestId('code-size')).toHaveText('13')
    await page.keyboard.press('Control+-')
    await page.keyboard.press('Control+-')
    await expect(size()).toHaveText('13')
    expect(await rootProperty(page, '--font-ui-size')).toBe('13px')
    expect((await writes(page))!.at(-1)).toMatchObject({ fonts: { ui: { size: 13 } } })

    // Something earlier already handled the chord: it is not stepped twice.
    await page.evaluate(() => ((window as unknown as { blockKeys: boolean }).blockKeys = true))
    await page.keyboard.press('Control+=')
    await expect(size()).toHaveText('13')
    await page.evaluate(() => ((window as unknown as { blockKeys: boolean }).blockKeys = false))

    // An unmodified key is typing, not zoom.
    await page.keyboard.press('=')
    await expect(size()).toHaveText('13')

    await page.keyboard.press('Control+0')
    await expect(size()).toHaveText('14')
    await expect(page.getByTestId('code-size')).toHaveText('12')
  })

  test('without fontZoom the chords do nothing, and zoomFonts still works from a menu', async ({
    page,
  }) => {
    await open(page, superset, {})
    await page.keyboard.press('Control+=')
    await expect(page.getByTestId('ui-size')).toHaveText('14')
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect(page.getByTestId('ui-size')).toHaveText('15')
    await page.getByRole('button', { name: 'Zoom reset' }).click()
    await expect(page.getByTestId('ui-size')).toHaveText('14')
  })
})
