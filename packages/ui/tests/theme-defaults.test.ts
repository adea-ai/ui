import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { themeDefaultsData } from '../scripts/theme-defaults-data'
import {
  DEFAULT_FLOOR_EDITOR,
  DEFAULT_PRIMARY_SUBTLE,
  DEFAULT_THEME_ACCENTS,
  DEFAULT_VARIANTS,
  THEME_INDEX,
  catalogueThemeAppearance,
  defaultDarkThemeId,
  defaultLightThemeId,
  defaultVariantFor,
  isCatalogueThemeId,
  isDefaultThemeId,
  resolveVariant,
} from '../src/lib/theme-defaults'
import {
  builtinThemes,
  editorPaletteFor,
  primarySubtleFor,
  themeAccentsFor,
  themeById,
} from '../src/lib/themes'

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('the shipped catalogue facts', () => {
  test('match the live catalogue, so the generated file cannot go stale', () => {
    // The generator's own recomputation, compared with what is committed. A catalogue
    // update that changes any of this fails here until `bun run theme:defaults` is run.
    const live = themeDefaultsData()
    expect(plain([...THEME_INDEX])).toEqual(plain(live.index))
    expect(plain(DEFAULT_VARIANTS)).toEqual(plain(live.variants))
    expect(plain(DEFAULT_THEME_ACCENTS)).toEqual(plain(live.accents))
    expect(plain(DEFAULT_PRIMARY_SUBTLE)).toEqual(plain(live.primarySubtle))
    expect(plain(DEFAULT_FLOOR_EDITOR)).toEqual(plain(live.floorEditor))
  })

  test('the id index is the catalogue in catalogue order', () => {
    expect(THEME_INDEX.map(([id]) => id)).toEqual(builtinThemes.map((theme) => theme.id))
    expect(THEME_INDEX).toHaveLength(34)
    for (const [id, appearance] of THEME_INDEX) {
      expect(themeById(id)?.appearance).toBe(appearance)
      expect(catalogueThemeAppearance(id)).toBe(appearance)
      expect(isCatalogueThemeId(id)).toBe(true)
    }
  })

  test('the default variants are the catalogue variants, value for value', () => {
    for (const id of [defaultLightThemeId, defaultDarkThemeId] as const) {
      const catalogue = themeById(id)!
      const shipped = DEFAULT_VARIANTS[id]
      expect(plain(shipped)).toEqual(plain(catalogue))
      expect(shipped.colors).toEqual(catalogue.colors)
      expect(shipped.terminal).toEqual(catalogue.terminal)
      expect(shipped.editor).toEqual(catalogue.editor)
      expect(shipped.chart).toEqual(catalogue.chart)
      // The derived values the light engine reads instead of measuring.
      expect(DEFAULT_PRIMARY_SUBTLE[id]).toBe(primarySubtleFor(catalogue))
      expect(DEFAULT_FLOOR_EDITOR[id]).toEqual(editorPaletteFor(catalogue, 'floor'))
    }
    expect(DEFAULT_THEME_ACCENTS).toEqual(themeAccentsFor(defaultLightThemeId, defaultDarkThemeId))
  })

  test('id helpers answer for catalogue, default and unknown ids', () => {
    expect(isDefaultThemeId('adea-dark')).toBe(true)
    expect(isDefaultThemeId('nord')).toBe(false)
    expect(isCatalogueThemeId('nord')).toBe(true)
    expect(isCatalogueThemeId('not-a-theme')).toBe(false)
    expect(catalogueThemeAppearance('not-a-theme')).toBeUndefined()
    expect(defaultVariantFor('dark').id).toBe('adea-dark')
    expect(defaultVariantFor('light').id).toBe('adea-light')
  })

  test('resolveVariant keeps its fallback order without the catalogue', () => {
    const registry = [DEFAULT_VARIANTS['adea-light'], DEFAULT_VARIANTS['adea-dark']]
    expect(resolveVariant(registry, 'adea-dark', 'dark').id).toBe('adea-dark')
    expect(resolveVariant(registry, 'gone', 'dark').id).toBe('adea-dark')
    expect(resolveVariant(registry, 'gone', 'light').id).toBe('adea-light')
    expect(resolveVariant([DEFAULT_VARIANTS['adea-dark']], 'gone', 'light').id).toBe('adea-dark')
  })
})

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8')
const staticImports = (source: string) =>
  [...source.matchAll(/^(?:import|export)\s+(?!type\b)[^'"]*?from\s*'([^']+)'/gm)].map(
    (match) => match[1]!
  )

describe('the start-up path stays free of the catalogue', () => {
  test('the modules the lazy provider loads at start-up import no catalogue entry point', () => {
    const startup = [
      'src/components/theme/lazy.ts',
      'src/components/theme/theme-provider-lazy.tsx',
      'src/components/theme/theme-catalogue-source.ts',
      'src/components/theme/theme-provider-core.tsx',
      'src/components/theme/theme-provider-value.ts',
      'src/components/theme/theme-state-core.ts',
      'src/components/theme/theme-document-core.ts',
      'src/components/theme/theme-persistence.ts',
      'src/components/theme/theme-script.ts',
      'src/lib/theme-engine.ts',
      'src/lib/theme-engine-light.ts',
      'src/lib/theme-defaults.ts',
      'src/lib/theme-css.ts',
      'src/lib/accent-presets.ts',
    ]
    for (const file of startup) {
      for (const specifier of staticImports(read(file))) {
        expect(specifier, file).not.toBe('#lib/themes')
        expect(specifier, file).not.toBe('./themes')
        expect(specifier, file).not.toBe('#lib/theme-catalogue')
        expect(specifier, file).not.toBe('#lib/tokens')
        expect(specifier, file).not.toBe('./theme-provider')
        expect(specifier, file).not.toBe('./theme-state')
        expect(specifier, file).not.toBe('./theme-document')
        expect(specifier, file).not.toBe('@adea-ai/themes/catalogue')
        expect(specifier, file).not.toBe('@adea-ai/themes/adapters/shadcn')
      }
    }
  })
})
