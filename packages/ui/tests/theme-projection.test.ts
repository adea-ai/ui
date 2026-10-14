import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  ACCENTS,
  editorRolesHex,
  getTheme,
  oklchToHex,
  parseColor,
  shadcnDestructiveProjection,
  shadcnVariables,
  syntaxRolesHex,
  toXtermTheme,
} from '@adea-ai/themes'
import { accents, getAccent } from '../src/lib/accent-presets'
import * as projection from '../src/lib/theme-projection'
import { themeAccentsFor } from '../src/lib/themes'

const LIB = join(import.meta.dir, '..', 'src', 'lib')

describe('getAccent', () => {
  test('resolves a preset id to the catalogue entry, not a copy', () => {
    expect(getAccent('blue')).toBe(accents.find((accent) => accent.id === 'blue')!)
    expect(getAccent('blue')).toBe(ACCENTS.find((accent) => accent.id === 'blue')!)
  })

  test('answers undefined for the theme entry, a theme-carried accent and an unknown id', () => {
    expect(getAccent('theme')).toBeUndefined()
    expect(getAccent('ansi-blue')).toBeUndefined()
    expect(getAccent('#2563eb')).toBeUndefined()
    expect(getAccent('')).toBeUndefined()
  })
})

describe('the theme projection module', () => {
  test('re-exports the catalogue helpers, not copies, so the host cannot drift from them', () => {
    expect(projection.shadcnVariables).toBe(shadcnVariables)
    expect(projection.shadcnDestructiveProjection).toBe(shadcnDestructiveProjection)
    expect(projection.toXtermTheme).toBe(toXtermTheme)
    expect(projection.editorRolesHex).toBe(editorRolesHex)
    expect(projection.syntaxRolesHex).toBe(syntaxRolesHex)
    expect(projection.oklchToHex).toBe(oklchToHex)
    expect(projection.parseOklchColor).toBe(parseColor)
  })

  test('the default record of an appearance is the catalogue default of that appearance', () => {
    expect(projection.defaultThemeRecord('light')).toBe(getTheme('adea-light')!)
    expect(projection.defaultThemeRecord('dark')).toBe(getTheme('adea-dark')!)
    expect(projection.defaultThemeRecord('light').appearance).toBe('light')
    expect(projection.defaultThemeRecord('dark').appearance).toBe('dark')
  })

  test('offers the same theme accents for a pair of records as for the same pair by id', () => {
    for (const [light, dark] of [
      ['adea-light', 'adea-dark'],
      ['catppuccin-latte', 'catppuccin-mocha'],
      ['gruvbox-light', 'dracula'],
    ] as const) {
      expect(projection.themeAccentsForRecords(getTheme(light)!, getTheme(dark)!)).toEqual(
        themeAccentsFor(light, dark)
      )
    }
  })

  test('answers for a record the catalogue does not hold', () => {
    const imported = { ...getTheme('adea-dark')!, id: 'imported-one', name: 'Imported one' }
    expect(
      projection.themeAccentsForRecords(projection.defaultThemeRecord('light'), imported).length
    ).toBeGreaterThan(0)
  })

  test('imports nothing from lib/themes, so it never carries the 34-theme table', () => {
    const source = readFileSync(join(LIB, 'theme-projection.ts'), 'utf8')
    const runtime = [...source.matchAll(/^(import|export)\s+(type\s+)?[^;]*?from\s+'([^']+)'/gms)]
      .filter((match) => !match[2])
      .map((match) => match[3]!)
    expect(runtime.length).toBeGreaterThan(0)
    for (const specifier of runtime) {
      expect(specifier).not.toMatch(/^\.\/(themes|theme-catalogue)$/)
      expect(specifier).not.toBe('@adea-ai/themes/catalogue')
    }
  })
})
