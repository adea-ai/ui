import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createRoot } from 'solid-js'
import { catalogueThemeEngine } from '../src/lib/theme-catalogue'
import { lightThemeEngine } from '../src/lib/theme-engine-light'
import { builtinThemes } from '../src/lib/themes'
import {
  createThemeContextValue,
  type ThemeCatalogueSource,
  type ThemeProviderProps,
} from '../src/components/theme/theme-provider-value'
import type { ThemeContextValue, ThemeSelection } from '../src/components/theme/theme-state-core'
import { fakeRoot } from './helpers/fake-root'

type Stored = Partial<ThemeSelection>

/**
 * A fresh copy of the lazy-catalogue module, so each test starts with the catalogue
 * "not loaded yet" — the module remembers a completed load for the whole page.
 */
let copy = 0
async function freshSource() {
  const specifier = `../src/components/theme/theme-catalogue-source.ts?fresh-${(copy += 1)}`
  return (await import(
    specifier
  )) as typeof import('../src/components/theme/theme-catalogue-source')
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

let page: ReturnType<typeof fakeRoot>
beforeEach(() => {
  page = fakeRoot()
  ;(globalThis as { document?: unknown }).document = { documentElement: page.root }
})
afterEach(() => {
  delete (globalThis as { document?: unknown }).document
})

/** Mount a provider's value in a root the test disposes. */
function mount(
  catalogue: ThemeCatalogueSource,
  stored: Stored | undefined,
  props: Partial<ThemeProviderProps> = {}
) {
  const writes: ThemeSelection[] = []
  let context!: ThemeContextValue
  const dispose = createRoot((disposeRoot) => {
    context = createThemeContextValue({
      persistence: { read: () => stored, write: (next) => void writes.push(next) },
      ...(stored?.appearance ? {} : { initial: { appearance: 'dark' as const } }),
      palette: 'stylesheet',
      catalogue,
      ...props,
    })
    return disposeRoot
  })
  return { context, writes, dispose }
}

describe('the lazy provider on the default pair', () => {
  test('paints the default theme and never asks for the catalogue', async () => {
    const { createLazyCatalogue } = await freshSource()
    const source = createLazyCatalogue()
    let loads = 0
    const counting: ThemeCatalogueSource = { ...source, load: () => ((loads += 1), source.load()) }
    const { context, dispose } = mount(counting, undefined, { accentContrastFloor: 3 })

    expect(page.root.dataset['theme']).toBe('adea-dark')
    expect(context.variant().id).toBe('adea-dark')
    expect(context.catalogueReady?.()).toBe(false)
    expect(context.allThemes().map((theme) => theme.id)).toEqual(['adea-light', 'adea-dark'])
    expect(context.themes).toHaveLength(2)
    expect(context.themeAccents().length).toBeGreaterThan(0)
    await tick()
    expect(loads).toBe(0)
    expect(source.loaded()).toBe(false)
    dispose()
  })

  test('with palette="stylesheet" it writes no palette, only what a stylesheet cannot know', () => {
    const { dispose } = mount(
      lightOnly(),
      { accent: 'violet', terminalThemeId: 'adea-light' },
      { editorRoles: 'floor' }
    )
    const written = [...page.properties.keys()]
    expect(written).toContain('--primary')
    expect(written).toContain('--terminal-background')
    expect(written.filter((name) => name.startsWith('--editor-'))).toHaveLength(16)
    expect(written).not.toContain('--background')
    expect(written).not.toContain('--card')
    dispose()
  })

  test('writes exactly the document the eager provider writes', async () => {
    const cases: [string, Stored | undefined, Partial<ThemeProviderProps>][] = [
      ['plain', undefined, {}],
      ['accent', { accent: 'cyan' }, { accentContrastFloor: 3 }],
      ['custom accent', { accent: '#7a9cff' }, { accentContrastFloor: 7 }],
      ['ansi accent', { accent: 'ansi-blue' }, {}],
      ['light', { appearance: 'light', accent: 'rose' }, {}],
      ['floor editor', undefined, { editorRoles: 'floor' }],
      ['inline palette', undefined, { palette: 'inline' }],
      ['pinned terminal', { terminalThemeId: 'adea-light' }, {}],
      ['surface', { surface: 'frosted' }, { surface: true }],
      ['compact', { density: 'compact' }, {}],
    ]
    for (const [name, stored, props] of cases) {
      const eagerPage = fakeRoot()
      ;(globalThis as { document?: unknown }).document = { documentElement: eagerPage.root }
      const eager = mount(eagerSource(), stored, props)
      const lazyPage = fakeRoot()
      ;(globalThis as { document?: unknown }).document = { documentElement: lazyPage.root }
      const { createLazyCatalogue } = await freshSource()
      const lazy = mount(createLazyCatalogue(), stored, props)

      expect(Object.fromEntries(lazyPage.properties), name).toEqual(
        Object.fromEntries(eagerPage.properties)
      )
      expect(Object.fromEntries(lazyPage.attributes), name).toEqual(
        Object.fromEntries(eagerPage.attributes)
      )
      expect([...lazyPage.classes], name).toEqual([...eagerPage.classes])
      expect(lazy.context.variant().id, name).toBe(eager.context.variant().id)
      expect(lazy.context.accentRolesFor('violet')?.primary, name).toBe(
        eager.context.accentRolesFor('violet')?.primary
      )
      eager.dispose()
      lazy.dispose()
    }
  })
})

describe('a saved theme beyond the defaults, selected at boot', () => {
  const saved: Stored = { appearance: 'dark', darkThemeId: 'dracula', accent: 'violet' }

  test('keeps what the stylesheet painted until the catalogue arrives, then paints it', async () => {
    // What themeScript wrote before first paint.
    page.root.dataset['theme'] = 'dracula'
    page.root.setAttribute('data-accent', 'violet')
    const { createLazyCatalogue } = await freshSource()
    const source = createLazyCatalogue()
    const { context, dispose } = mount(source, saved)

    // Before: nothing is written over the stylesheet's theme, the variant is the default
    // of the appearance, the catalogue has been asked for.
    expect(page.root.dataset['theme']).toBe('dracula')
    expect(page.properties.size).toBe(0)
    expect(context.variant().id).toBe('adea-dark')
    expect(context.catalogueReady?.()).toBe(false)
    expect(context.selection().darkThemeId).toBe('dracula')

    await context.loadCatalogue?.()
    await tick()

    // After: the stored id resolves, the document is written, the full list is there.
    expect(source.loaded()).toBe(true)
    expect(context.catalogueReady?.()).toBe(true)
    expect(context.variant().id).toBe('dracula')
    expect(context.variant().label).toBeDefined()
    expect(page.root.dataset['theme']).toBe('dracula')
    expect(page.properties.has('--primary')).toBe(true)
    expect(context.allThemes()).toHaveLength(builtinThemes.length)
    expect(context.themes).toBe(builtinThemes)
    dispose()
  })

  test('asks for the catalogue by itself, without anyone calling loadCatalogue', async () => {
    const { createLazyCatalogue } = await freshSource()
    const source = createLazyCatalogue()
    const { context, dispose } = mount(source, saved)
    expect(source.loaded()).toBe(false)
    await tick()
    await tick()
    expect(source.loaded()).toBe(true)
    expect(context.variant().id).toBe('dracula')
    dispose()
  })

  test('a persistence-validated id for the other appearance does not need it', () => {
    const { context, dispose } = mount(lightOnly(), { ...saved, appearance: 'light' })
    // The light theme is the default; the dark pick waits unseen.
    expect(context.variant().id).toBe('adea-light')
    expect(page.root.dataset['theme']).toBe('adea-light')
    dispose()
  })

  test('a theme-derived accent over such a pair waits for it as well', async () => {
    const { createLazyCatalogue } = await freshSource()
    const source = createLazyCatalogue()
    const { dispose } = mount(source, {
      appearance: 'light',
      darkThemeId: 'dracula',
      accent: 'ansi-blue',
    })
    expect(page.properties.size).toBe(0)
    await tick()
    await tick()
    expect(source.loaded()).toBe(true)
    expect(page.root.dataset['theme']).toBe('adea-light')
    dispose()
  })

  test('a catalogue that cannot be loaded leaves the document alone and keeps the selection', async () => {
    page.root.dataset['theme'] = 'dracula'
    let attempts = 0
    const failing: ThemeCatalogueSource = {
      engine: () => lightThemeEngine,
      loaded: () => false,
      failed: () => attempts > 0,
      load: () => ((attempts += 1), Promise.resolve()),
    }
    const { context, dispose } = mount(failing, saved)
    expect(attempts).toBeGreaterThan(0)
    expect(context.selection().darkThemeId).toBe('dracula')
    dispose()
  })
})

describe('preview of a theme that has not loaded', () => {
  test('starts the load, shows when it arrives, and the committed theme never moves', async () => {
    const { createLazyCatalogue } = await freshSource()
    const source = createLazyCatalogue()
    const { context, writes, dispose } = mount(source, undefined)
    expect(page.root.dataset['theme']).toBe('adea-dark')

    context.preview({ darkThemeId: 'dracula' })
    // The draft is open, the document still shows the committed theme, a load is on its way.
    expect(context.previewing()).toBe(true)
    expect(page.root.dataset['theme']).toBe('adea-dark')

    await tick()
    await tick()
    expect(source.loaded()).toBe(true)
    expect(page.root.dataset['theme']).toBe('dracula')
    expect(context.variant().id).toBe('adea-dark')
    expect(context.selection().darkThemeId).toBe('adea-dark')
    expect(writes).toHaveLength(0)

    context.preview(undefined)
    expect(page.root.dataset['theme']).toBe('adea-dark')
    dispose()
  })

  test('committing a theme that has not loaded persists it at once and paints it on arrival', async () => {
    const { createLazyCatalogue } = await freshSource()
    const source = createLazyCatalogue()
    const { context, writes, dispose } = mount(source, undefined)

    context.setSelection({ darkThemeId: 'nord' })
    expect(writes.at(-1)?.darkThemeId).toBe('nord')
    expect(page.root.dataset['theme']).toBe('adea-dark')

    await tick()
    await tick()
    expect(context.variant().id).toBe('nord')
    expect(page.root.dataset['theme']).toBe('nord')
    dispose()
  })

  test('loadCatalogue is idempotent and resolves once the catalogue is available', async () => {
    const { createLazyCatalogue, loadThemeCatalogue } = await freshSource()
    const source = createLazyCatalogue()
    const { context, dispose } = mount(source, undefined)
    const first = context.loadCatalogue?.()
    const second = context.loadCatalogue?.()
    await Promise.all([first, second])
    expect(context.catalogueReady?.()).toBe(true)
    expect(await loadThemeCatalogue()).toBe(catalogueThemeEngine)
    // A provider created after the load starts with it.
    expect(createLazyCatalogue().loaded()).toBe(true)
    dispose()
  })
})

describe('accentRolesFor before the catalogue', () => {
  test('is exact for the default pair and does not load anything', async () => {
    const { createLazyCatalogue } = await freshSource()
    const source = createLazyCatalogue()
    const { context, dispose } = mount(source, undefined)
    const roles = context.accentRolesFor('violet')
    expect(roles).toEqual(mountEager().accentRolesFor('violet'))
    await tick()
    expect(source.loaded()).toBe(false)
    dispose()
  })

  test('for a repaired accent asks for the catalogue and answers provisionally meanwhile', async () => {
    const { createLazyCatalogue } = await freshSource()
    const source = createLazyCatalogue()
    const { context, dispose } = mount(source, undefined, { accentContrastFloor: 12 })
    const provisional = context.accentRolesFor('#101010')
    expect(provisional?.primary).toBeDefined()
    await tick()
    await tick()
    expect(source.loaded()).toBe(true)
    // The same four colours; the tint is now measured against the theme.
    const exact = context.accentRolesFor('#101010')
    expect(exact?.primary).toBe(provisional?.primary)
    expect(exact?.primarySubtle).toBeDefined()
    dispose()
  })
})

describe('the eager provider is unchanged', () => {
  test('reports a loaded catalogue, hands out the same plain array, and has nothing to load', async () => {
    const { context, dispose } = mount(eagerSource(), undefined)
    expect(context.catalogueReady?.()).toBe(true)
    expect(context.themes).toBe(builtinThemes)
    expect(Array.isArray(context.themes)).toBe(true)
    expect(context.allThemes()).toBe(builtinThemes)
    await context.loadCatalogue?.()
    dispose()
  })

  test('paints a catalogue theme at boot with no wait', () => {
    const { context, dispose } = mount(eagerSource(), { appearance: 'dark', darkThemeId: 'nord' })
    expect(context.variant().id).toBe('nord')
    expect(page.root.dataset['theme']).toBe('nord')
    dispose()
  })
})

function eagerSource(): ThemeCatalogueSource {
  return {
    engine: () => catalogueThemeEngine,
    loaded: () => true,
    failed: () => false,
    load: () => Promise.resolve(),
  }
}

/** A source that is the light engine for good, to assert what the default pair needs. */
function lightOnly(): ThemeCatalogueSource {
  return {
    engine: () => lightThemeEngine,
    loaded: () => false,
    failed: () => false,
    load: () => {
      throw new Error('the default pair must not ask for the catalogue')
    },
  }
}

function mountEager(): ThemeContextValue {
  return createRoot(() =>
    createThemeContextValue({
      persistence: { read: () => undefined, write() {} },
      initial: { appearance: 'dark' },
      palette: 'stylesheet',
      catalogue: eagerSource(),
    })
  )
}
