import { createHash } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { getTheme, themes as catalogue } from '@adea-ai/themes'
import { oklchToHex, parseColor } from '@adea-ai/themes/oklch'
import {
  builtinThemes,
  defaultDarkThemeId,
  defaultLightThemeId,
  resolveVariant,
  themeById,
  themeCssVariables,
  tokensAsHex,
  variantFromRecord,
  type ThemeVariant,
} from '../src/lib/themes'
import { themeScript } from '../src/components/theme'

/**
 * The catalogue is projected onto the shadcn vocabulary on demand. Everything that
 * made `builtinThemes` an array of finished objects must still hold, because
 * Cortana, Storybook and every picker read it that way.
 */
describe('lazy catalogue variants', () => {
  test('builtinThemes is still a plain array of every catalogue entry, in order', () => {
    expect(Array.isArray(builtinThemes)).toBe(true)
    expect(builtinThemes.length).toBe(34)
    expect(builtinThemes.length).toBe(catalogue.length)
    expect(builtinThemes.map((theme) => theme.id)).toEqual(catalogue.map((theme) => theme.id))
  })

  test('every variant equals the one built eagerly from its record, role for role', () => {
    for (const record of catalogue) {
      const lazy = themeById(record.id)!
      const eager = variantFromRecord(record)
      expect(lazy.colors, `${record.id} colors`).toEqual(eager.colors)
      expect(lazy.terminal, `${record.id} terminal`).toEqual(eager.terminal)
      expect(lazy.editor, `${record.id} editor`).toEqual(eager.editor)
      expect(lazy.chart, `${record.id} chart`).toEqual(eager.chart)
      expect({ ...lazy }).toEqual({ ...eager })
      expect(themeCssVariables(lazy), `${record.id} css`).toEqual(themeCssVariables(eager))
    }
  })

  test('the derived palettes are enumerable accessors that build once', () => {
    const untouched = builtinThemes.at(-1)!
    for (const key of ['colors', 'terminal', 'editor', 'chart'] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(untouched, key)!
      expect(typeof descriptor.get, `${key} is lazy`).toBe('function')
      expect(descriptor.enumerable).toBe(true)
    }
    expect(untouched.colors).toBe(untouched.colors)
    expect(untouched.terminal).toBe(untouched.terminal)
    expect(untouched.editor).toBe(untouched.editor)
    expect(untouched.chart).toBe(untouched.chart)
  })

  test('module evaluation costs a fraction of building every variant', () => {
    // The catalogue used to be projected in full when the module loaded: ~155 ms
    // under Bun, on the hydration path of every consumer. Measured in a fresh process
    // against the already-loaded catalogue package so only this module's own work
    // counts, and as a ratio so a slow runner moves both sides.
    const script = `
      const dir = ${JSON.stringify(import.meta.dir)}
      await import('@adea-ai/themes')
      await import('@adea-ai/themes/adapters/shadcn')
      const t0 = performance.now()
      const m = await import(dir + '/../src/lib/themes.ts')
      const evalMs = performance.now() - t0
      const t1 = performance.now()
      for (const theme of m.builtinThemes) { void theme.colors; void theme.terminal; void theme.editor; void theme.chart }
      const buildAllMs = performance.now() - t1
      console.log(JSON.stringify({ evalMs, buildAllMs, count: m.builtinThemes.length }))
    `
    const run = Bun.spawnSync(['bun', '--conditions=browser', '-e', script], {
      cwd: import.meta.dir + '/..',
    })
    expect(run.exitCode, run.stderr.toString()).toBe(0)
    const { evalMs, buildAllMs, count } = JSON.parse(run.stdout.toString().trim()) as {
      evalMs: number
      buildAllMs: number
      count: number
    }
    expect(count).toBe(34)
    expect(evalMs).toBeLessThan(buildAllMs / 3)
    expect(evalMs).toBeLessThan(60)
  })
})

describe('variantFromRecord', () => {
  test('is the design system view of a record the catalogue does not hold', () => {
    const record = { ...getTheme('nord')!, id: 'imported-nord', label: 'Imported Nord' }
    const variant = variantFromRecord(record)
    expect(variant).toMatchObject({
      id: 'imported-nord',
      label: 'Imported Nord',
      appearance: 'dark',
      family: record.family,
    })
    expect(variant.colors.background).toBe(themeById('nord')!.colors.background)
  })

  test('builds in full at once, so a record it cannot map fails here', () => {
    const built = variantFromRecord(getTheme('nord')!)
    expect('value' in Object.getOwnPropertyDescriptor(built, 'colors')!).toBe(true)
  })

  test('a variant’s `tokens` land over its derived roles, last', () => {
    const variant: ThemeVariant = {
      ...variantFromRecord(getTheme('nord')!),
      tokens: { '--background': '#abcdef', '--only-here': 'x' },
    }
    const css = themeCssVariables(variant)
    expect(css['--background']).toBe('#abcdef')
    expect(css['--only-here']).toBe('x')
    expect(css['--foreground']).toBe(themeById('nord')!.colors.foreground)
    // Not mutated into the catalogue's own variant.
    expect(themeCssVariables(themeById('nord')!)['--only-here']).toBeUndefined()
  })
})

describe('resolveVariant', () => {
  test('a known id wins', () => {
    expect(resolveVariant(builtinThemes, 'nord', 'dark').id).toBe('nord')
  })

  test('an unknown id falls back to the default of the same appearance', () => {
    expect(resolveVariant(builtinThemes, 'nope', 'light').id).toBe(defaultLightThemeId)
    expect(resolveVariant(builtinThemes, 'nope', 'dark').id).toBe(defaultDarkThemeId)
  })

  test('with the default absent, any variant of that appearance', () => {
    const registry = builtinThemes.filter(
      (theme) => theme.id !== defaultLightThemeId && theme.id !== defaultDarkThemeId
    )
    expect(resolveVariant(registry, 'nope', 'light').appearance).toBe('light')
    expect(resolveVariant(registry, 'nope', 'dark').appearance).toBe('dark')
  })

  test('with nothing of that appearance, the first entry rather than nothing', () => {
    const onlyDark = builtinThemes.filter((theme) => theme.appearance === 'dark')
    expect(resolveVariant(onlyDark, 'nope', 'light')).toBe(onlyDark[0]!)
  })

  test('an extra is found by id, after the catalogue', () => {
    const registry = [...builtinThemes, { ...themeById(defaultLightThemeId)!, id: 'custom-1' }]
    expect(resolveVariant(registry, 'custom-1', 'light').id).toBe('custom-1')
  })
})

describe('tokensAsHex', () => {
  test('writes every opaque oklch() role of every theme as lower-case #rrggbb', () => {
    for (const theme of builtinThemes) {
      const input = themeCssVariables(theme)
      const output = tokensAsHex(input)
      expect(Object.keys(output)).toEqual(Object.keys(input))
      for (const [name, value] of Object.entries(input)) {
        if (value.startsWith('oklch(') && !value.includes('/')) {
          expect(output[name], `${theme.id} ${name}`).toMatch(/^#[0-9a-f]{6}$/)
          expect(output[name]).toBe(oklchToHex(parseColor(value)!))
        }
      }
    }
  })

  test('leaves alpha, mixes, references and hex exactly as written', () => {
    const kept = {
      '--border': 'rgba(255, 255, 255, 0.12)',
      '--primary-subtle': 'color-mix(in oklch, var(--primary) 12%, transparent)',
      '--ref': 'var(--background)',
      '--hex': '#2e3440',
      '--translucent': 'oklch(0.5 0.1 200 / 0.4)',
      '--name': 'Inter',
    }
    expect(tokensAsHex(kept)).toEqual(kept)
  })

  test('converts a plain oklch value and does not mutate its input', () => {
    const input = { '--x': 'oklch(0.5 0.1 200)' }
    expect(tokensAsHex(input)['--x']).toMatch(/^#[0-9a-f]{6}$/)
    expect(input['--x']).toBe('oklch(0.5 0.1 200)')
  })
})

const sha = (text: string) => createHash('sha256').update(text).digest('hex')

describe('themeScript is unchanged by the provider split', () => {
  // sha256 of the scripts 0.123.1 emitted. The pre-paint script is part of what a
  // consumer's document contains, so a byte of drift here is a visible change.
  test('the default key', () => {
    const script = themeScript()
    expect(script.length).toBe(3582)
    expect(sha(script)).toBe('02fb28d83af5a0f2349d59aa9d95f41e1deaa0de7a7a4d8653d66915a59c25ef')
  })

  test('the Cortana key', () => {
    const script = themeScript('cortana.appearance')
    expect(script.length).toBe(3588)
    expect(sha(script)).toBe('0b536fce294e552cc47c5134de65ecaf0f19d8c55f472092a4668005784a1586')
  })
})
