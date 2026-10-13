/*
 * Copyright (c) 2026 Wing
 * SPDX-License-Identifier: MIT
 *
 * The colour-math and accent-role cases are translated from Adea's
 * `packages/ui/tests/appearance.test.ts`, which tests the module this one was
 * extracted from. See NOTICE.
 */
import { describe, expect, test } from 'bun:test'
import {
  ACCENTS,
  accentRoles,
  contrastRatio as ratioOf,
  getAccent,
  getTheme,
  parseColor as oklch,
} from '@adea-ai/themes'
import { oklchToHex } from '@adea-ai/themes/oklch'
import {
  ACCENT_PAINT_PROPERTIES,
  DEFAULT_ACCENT_CONTRAST_FLOOR,
  accentOverrideVariables,
  accentRolesForPreset,
  colorToHex,
  contrastRatio,
  ensureContrast,
  isCustomAccent,
  normalizeAccentValue,
  normalizeCustomAccent,
  paintAccentRoles,
  parseColor,
  resolveAccentRoles,
} from '../src/lib/accent-roles'
import { builtinThemes, themeAccentsFor, themeById } from '../src/lib/themes'

/** Contrast between two CSS colours in any format the catalogue parses. */
function ratio(foreground: string, background: string): number {
  return ratioOf(oklch(foreground)!, oklch(background)!)
}

describe('color math (Zeron Color translation)', () => {
  test('colors round-trip through every supported CSS hex length', () => {
    for (const source of ['#abc', '#abcd', '#102030', '#10203040']) {
      const color = parseColor(source)
      expect(color).toBeDefined()
      expect(parseColor(colorToHex(color!))).toEqual(color)
    }
  })

  test('short forms double each nibble and alpha defaults to opaque', () => {
    expect(parseColor('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 255 })
    expect(parseColor('#abcd')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 0xdd })
    expect(parseColor('  #102030 ')).toEqual({ r: 0x10, g: 0x20, b: 0x30, a: 255 })
    expect(parseColor('#10203040')).toEqual({ r: 0x10, g: 0x20, b: 0x30, a: 0x40 })
    expect(colorToHex({ r: 1, g: 2, b: 3, a: 255 })).toBe('#010203')
    expect(colorToHex({ r: 1, g: 2, b: 3, a: 4 })).toBe('#01020304')
  })

  test('unsupported colors are rejected', () => {
    expect(parseColor('')).toBeUndefined()
    expect(parseColor('2563eb')).toBeUndefined()
    expect(parseColor('#12345')).toBeUndefined()
    expect(parseColor('#1234567')).toBeUndefined()
    expect(parseColor('#zzzzzz')).toBeUndefined()
    expect(parseColor('#')).toBeUndefined()
  })

  test('identical colors have a contrast ratio of 1 and opposites are far apart', () => {
    expect(contrastRatio('#000000', '#000000')).toBeCloseTo(1, 5)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0)
  })

  test('an unparseable colour has no contrast', () => {
    expect(contrastRatio('red', '#ffffff')).toBe(0)
    expect(contrastRatio('#ffffff', 'red')).toBe(0)
  })

  test('a translucent foreground is measured as composited over the background', () => {
    const half = contrastRatio('#00000080', '#ffffff')
    expect(half).toBeGreaterThan(1)
    expect(half).toBeLessThan(contrastRatio('#000000', '#ffffff'))
  })
})

describe('ensureContrast and normalizeAccentValue', () => {
  const white = parseColor('#ffffff')!

  test('a colour that already clears the floor is returned as it is', () => {
    const color = parseColor('#0b57d0')!
    expect(ensureContrast(color, white, 3)).toBe(color)
  })

  test('a weak colour is lifted past the floor, in hex', () => {
    const lifted = ensureContrast(parseColor('#dddddd')!, white, 3)
    expect(contrastRatio(lifted, white)).toBeGreaterThanOrEqual(3)
    expect(lifted.a).toBe(255)
  })

  test('a translucent colour is repaired as the colour it renders', () => {
    const lifted = ensureContrast(parseColor('#ffffff10')!, white, 3)
    expect(lifted.a).toBe(255)
    expect(contrastRatio(lifted, white)).toBeGreaterThanOrEqual(3)
  })

  test('a floor no colour reaches ends at black or white', () => {
    const lifted = ensureContrast(parseColor('#777777')!, parseColor('#777777')!, 21)
    expect(['#000000', '#ffffff']).toContain(colorToHex(lifted))
  })

  test('normalizeAccentValue rejects unparseable input and lifts weak colors', () => {
    expect(normalizeAccentValue('blue', '#ffffff')).toBeUndefined()
    expect(normalizeAccentValue('#dddddd', '#ffffff')).not.toBe('#dddddd')
    expect(
      contrastRatio(normalizeAccentValue('#dddddd', '#ffffff')!, '#ffffff')
    ).toBeGreaterThanOrEqual(3)
    expect(normalizeAccentValue('#0b57d0', '#ffffff')).toBe('#0b57d0')
  })

  test('normalizeAccentValue takes the floor as an argument and falls back to a white surface', () => {
    const strict = normalizeAccentValue('#0b57d0', '#ffffff', 10)!
    expect(contrastRatio(strict, '#ffffff')).toBeGreaterThanOrEqual(10)
    expect(normalizeAccentValue('#dddddd', 'not-a-color')).toBe(
      normalizeAccentValue('#dddddd', '#ffffff')
    )
  })
})

describe('custom accent grammar', () => {
  test('is exactly #rrggbb, stored lower case', () => {
    expect(normalizeCustomAccent('#0B57D0')).toBe('#0b57d0')
    expect(normalizeCustomAccent('#0b57d0')).toBe('#0b57d0')
    expect(isCustomAccent('#ABCDEF')).toBe(true)
  })

  test.each([
    '#abc',
    '#abcd',
    '#0b57d0ff',
    '0b57d0',
    ' #0b57d0',
    '#0b57d0 ',
    '#0b57dg',
    'rgb(1,2,3)',
    'blue',
    'theme',
    'ansi-blue',
    '',
  ])('%p is not a custom accent', (value) => {
    expect(normalizeCustomAccent(value)).toBeUndefined()
    expect(isCustomAccent(value)).toBe(false)
  })

  test('a non-string is not a custom accent', () => {
    expect(normalizeCustomAccent(undefined)).toBeUndefined()
    expect(normalizeCustomAccent(0x0b57d0)).toBeUndefined()
    expect(normalizeCustomAccent(null)).toBeUndefined()
  })
})

describe('accent roles (Zeron AccentRoles derivation with Adea presets)', () => {
  const dark = themeById('adea-dark')!
  const light = themeById('adea-light')!
  const contextFor = (variant: typeof dark, floor?: number) => ({
    target: variant.appearance,
    background: variant.colors.background,
    floor,
  })

  test('theme, unknown ids and unparseable colours override nothing', () => {
    for (const accent of ['theme', 'chartreuse', '', '#zzzzzz', '#abc', 'ansi-blue']) {
      expect(resolveAccentRoles(accent, contextFor(dark, 3))).toBeUndefined()
    }
  })

  test('every preset meets interaction contrast on both appearances, and its label reads on it', () => {
    for (const variant of [light, dark]) {
      for (const preset of ACCENTS) {
        const roles = resolveAccentRoles(preset.id, contextFor(variant, 3))!
        expect(ratio(roles.primary, variant.colors.background)).toBeGreaterThanOrEqual(3)
        expect(ratio(roles.primaryForeground, roles.primary)).toBeGreaterThanOrEqual(4.5)
        expect(roles.ring).toBe(roles.primary)
      }
    }
  })

  test('a custom accent that already passes contrast is kept verbatim', () => {
    const variant = themeById('nord-light')!
    const roles = resolveAccentRoles('#0b57d0', contextFor(variant))!
    expect(oklchToHex(oklch(roles.primary)!)).toBe('#0b57d0')
  })

  test('a custom accent is held to the default floor even when the host sets none', () => {
    expect(DEFAULT_ACCENT_CONTRAST_FLOOR).toBe(3)
    const roles = resolveAccentRoles('#e8e8e8', contextFor(light))!
    expect(ratio(roles.primary, light.colors.background)).toBeGreaterThanOrEqual(3)
    expect(ratio(roles.primaryForeground, roles.primary)).toBeGreaterThanOrEqual(4.5)
  })

  test('a custom accent honours a stricter floor and the hover follows the repaired colour', () => {
    const roles = resolveAccentRoles('#0b57d0', contextFor(light, 9))!
    expect(ratio(roles.primary, light.colors.background)).toBeGreaterThanOrEqual(9)
    const unrepaired = resolveAccentRoles('#0b57d0', contextFor(light))!
    expect(roles.primaryHover).not.toBe(unrepaired.primaryHover)
  })

  test('without a surface nothing can be measured, so a custom colour is painted as given', () => {
    const roles = resolveAccentRoles('#e8e8e8', { target: 'light', background: undefined })!
    expect(oklchToHex(oklch(roles.primary)!)).toBe('#e8e8e8')
  })

  test('a preset below a stricter floor is repaired and every role follows it', () => {
    const preset = ACCENTS[0]!
    const verbatim = resolveAccentRoles(preset.id, contextFor(dark))!
    const roles = resolveAccentRoles(preset.id, contextFor(dark, 12))!
    expect(roles.primary).not.toBe(verbatim.primary)
    expect(ratio(roles.primary, dark.colors.background)).toBeGreaterThanOrEqual(12)
    expect(ratio(roles.primaryForeground, roles.primary)).toBeGreaterThanOrEqual(4.5)
    expect(roles.ring).toBe(roles.primary)
    expect(roles.primaryHover).not.toBe(verbatim.primaryHover)
    // The tint is a share of the primary on screen, whatever the primary became.
    expect(roles.primarySubtle).toContain('var(--primary)')
  })

  test('an unparseable background skips the gate instead of guessing a surface', () => {
    const preset = ACCENTS[0]!
    expect(accentRolesForPreset(preset, { target: 'dark', background: 'nope', floor: 21 })).toEqual(
      accentRolesForPreset(preset, { target: 'dark', background: 'nope' })
    )
  })

  test('a preset with an unparseable value resolves to nothing', () => {
    expect(
      accentRolesForPreset(
        { id: 'x', label: 'X', description: '', light: 'nope', dark: 'nope' },
        { target: 'light', background: '#ffffff', floor: 3 }
      )
    ).toBeUndefined()
  })

  test('a theme-carried accent resolves only from the offered accents, and is gated like a preset', () => {
    const themeAccents = themeAccentsFor('adea-light', 'adea-dark')
    const slot = themeAccents[0]
    expect(slot).toBeDefined()
    expect(resolveAccentRoles(slot!.id, contextFor(dark, 3))).toBeUndefined()

    const roles = resolveAccentRoles(slot!.id, { ...contextFor(dark, 3), themeAccents })!
    expect(ratio(roles.primary, dark.colors.background)).toBeGreaterThanOrEqual(3)
    expect(ratio(roles.primaryForeground, roles.primary)).toBeGreaterThanOrEqual(4.5)
    expect(
      resolveAccentRoles('ansi-not-offered', { ...contextFor(dark, 3), themeAccents })
    ).toBeUndefined()
  })

  test('the gate is the identity for presets: 204 preset x theme combinations', () => {
    // The floor exists for custom colours and imported themes. For the catalogue the
    // presets were measured against the catalogue's own backgrounds, so holding them
    // to 3:1 must change no role at all; if a preset or a theme is ever added that
    // does not clear it, this names the pair rather than letting the gate repaint it.
    expect(ACCENTS.length * builtinThemes.length).toBe(204)
    const changed: string[] = []
    for (const variant of builtinThemes) {
      const target = getTheme(variant.id)!
      for (const preset of ACCENTS) {
        const base = { target, background: variant.colors.background }
        const ungated = resolveAccentRoles(preset.id, base)
        const gated = resolveAccentRoles(preset.id, { ...base, floor: 3 })
        if (JSON.stringify(ungated) !== JSON.stringify(gated)) {
          changed.push(`${preset.id} on ${variant.id}`)
        }
      }
    }
    expect(changed).toEqual([])
  })

  test('a preset resolves to the catalogue roles, the ones the stylesheet is generated from', () => {
    const roles = resolveAccentRoles('violet', contextFor(dark))!
    expect(roles).toEqual(accentRoles(getAccent('violet')!, 'dark'))
  })
})

describe('accentOverrideVariables', () => {
  test('writes the four roles an override owns and never the tint', () => {
    const roles = resolveAccentRoles('violet', { target: 'dark', background: undefined })!
    const variables = accentOverrideVariables(roles)
    expect(Object.keys(variables).toSorted()).toEqual([
      '--primary',
      '--primary-foreground',
      '--primary-hover',
      '--ring',
    ])
    expect('--primary-subtle' in variables).toBe(false)
  })
})

const fakeElement = () => {
  const properties = new Map<string, string>()
  return {
    properties,
    style: {
      setProperty: (name: string, value: string) => void properties.set(name, value),
      removeProperty: (name: string) => {
        properties.delete(name)
        return ''
      },
    },
  }
}

describe('paintAccentRoles', () => {
  test('scopes all five roles to the element, the tint included', () => {
    const element = fakeElement()
    const roles = resolveAccentRoles('violet', { target: 'dark', background: undefined })!
    paintAccentRoles(element, roles)
    expect([...element.properties.keys()].toSorted()).toEqual(
      [...ACCENT_PAINT_PROPERTIES].toSorted()
    )
    expect(element.properties.get('--primary')).toBe(roles.primary)
    expect(element.properties.get('--primary-foreground')).toBe(roles.primaryForeground)
    expect(element.properties.get('--primary-hover')).toBe(roles.primaryHover)
    expect(element.properties.get('--ring')).toBe(roles.ring)
    // Resolved where it is declared, so it must be declared on the element.
    expect(element.properties.get('--primary-subtle')).toBe(roles.primarySubtle)
  })

  test('undefined clears every role, so the element inherits the document accent again', () => {
    const element = fakeElement()
    paintAccentRoles(
      element,
      resolveAccentRoles('violet', { target: 'dark', background: undefined })
    )
    paintAccentRoles(element, undefined)
    expect(element.properties.size).toBe(0)
  })
})
