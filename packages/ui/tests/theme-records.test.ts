import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { ACCENTS, getTheme, themes as catalogue } from '@adea-ai/themes'
import * as accentModule from '../src/lib/accent-presets'
import * as recordsModule from '../src/lib/theme-records'
import * as themesModule from '../src/lib/themes'
import { builtinThemes } from '../src/lib/themes'

const LIB = join(import.meta.dir, '..', 'src', 'lib')
const MODULES = readdirSync(LIB).filter((name) => /^(theme-records|accent-presets)\.ts$/.test(name))

/** The runtime import specifiers of a module: `import type` and `export type` are erased. */
function runtimeImports(file: string): string[] {
  const source = readFileSync(join(LIB, file), 'utf8')
  const specifiers = [...source.matchAll(/^(import|export)\s+(type\s+)?[^;]*?from\s+'([^']+)'/gms)]
  return specifiers.filter((match) => !match[2]).map((match) => match[3]!)
}

/**
 * `variantFromRecord` and `accents` are defined outside `lib/themes.ts` so a host that
 * imports either does not ship the 34-theme table: a bundler places a module whole.
 * `lib/themes.ts` re-exports both, so every existing import path is unchanged.
 */
describe('the catalogue-free theme modules', () => {
  test('lib/themes re-exports the same functions and list, not copies', () => {
    expect(themesModule.variantFromRecord).toBe(recordsModule.variantFromRecord)
    expect(themesModule.accents).toBe(accentModule.accents)
    expect(accentModule.accents).toBe(ACCENTS)
  })

  test('accentPresets is the theme entry followed by the same accents, in order', () => {
    expect(accentModule.accentPresets.map((preset) => preset.id)).toEqual([
      'theme',
      ...accentModule.accents.map((accent) => accent.id),
    ])
    expect(accentModule.accentPresets.slice(1)).toEqual([...accentModule.accents])
  })

  test('neither module reaches lib/themes or the catalogue table at runtime', () => {
    expect(MODULES.length).toBe(2)
    for (const file of MODULES) {
      for (const specifier of runtimeImports(file)) {
        expect(specifier, `${file} imports ${specifier}`).not.toMatch(
          /^\.\/(themes|theme-catalogue)$/
        )
      }
    }
  })

  test('the catalogue still builds its variants through the shared lazy form', () => {
    expect(builtinThemes.length).toBe(catalogue.length)
    for (const record of catalogue) {
      const lazy = recordsModule.lazyVariantFromRecord(record)
      const eager = recordsModule.variantFromRecord(record)
      expect({ ...lazy }, record.id).toEqual({ ...eager })
    }
  })

  test('a lazy variant builds each palette once and returns the same object after', () => {
    const variant = recordsModule.lazyVariantFromRecord(getTheme('nord')!)
    expect(variant.colors).toBe(variant.colors)
    expect(variant.terminal).toBe(variant.terminal)
    expect(variant.editor).toBe(variant.editor)
    expect(variant.chart).toBe(variant.chart)
  })

  test('a record the shadcn projection cannot map throws on read and is not cached', () => {
    const broken = { ...getTheme('nord')!, colors: {} } as unknown as Parameters<
      typeof recordsModule.variantFromRecord
    >[0]
    expect(() => recordsModule.variantFromRecord(broken)).toThrow()
    const lazy = recordsModule.lazyVariantFromRecord(broken)
    expect(() => lazy.colors).toThrow()
    expect(() => lazy.colors).toThrow()
  })
})
