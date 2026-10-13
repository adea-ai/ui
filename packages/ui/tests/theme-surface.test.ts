import { describe, expect, test } from 'bun:test'
import { contrastRatio, parseColor as parseCatalogueColor } from '@adea-ai/themes'
import { oklchToHex } from '@adea-ai/themes/oklch'
import {
  REDUCED_TRANSPARENCY_QUERY,
  normalizeSurface,
  resolveSurface,
  resolveSurfaceState,
  surfaceAlpha,
  themeSurfaces,
} from '../src/lib/theme-surface'
import { THEME_CSS, valueOf } from './helpers/theme-css'

describe('surface resolution', () => {
  const environment = {
    osReducedTransparency: false,
    userReducedTransparency: false,
    nativeTranslucency: true,
  }

  test('surface preference resolves independently from the capability', () => {
    expect(resolveSurface('frosted', environment)).toBe('frosted')
    expect(resolveSurface('translucent', environment)).toBe('translucent')
    expect(resolveSurface('opaque', environment)).toBe('opaque')
  })

  test('translucent degrades to the tokenized frost without native translucency', () => {
    expect(resolveSurface('translucent', { ...environment, nativeTranslucency: false })).toBe(
      'frosted'
    )
    expect(resolveSurface('frosted', { ...environment, nativeTranslucency: false })).toBe('frosted')
  })

  test('OS and user reduced transparency force opaque', () => {
    expect(resolveSurface('translucent', { ...environment, osReducedTransparency: true })).toBe(
      'opaque'
    )
    expect(resolveSurface('frosted', { ...environment, userReducedTransparency: true })).toBe(
      'opaque'
    )
  })

  test('reduced transparency wins over every preference and every capability', () => {
    for (const preference of themeSurfaces) {
      for (const nativeTranslucency of [true, false]) {
        for (const which of ['osReducedTransparency', 'userReducedTransparency'] as const) {
          expect(
            resolveSurface(preference, { ...environment, nativeTranslucency, [which]: true })
          ).toBe('opaque')
        }
      }
    }
  })
})

describe('resolveSurfaceState', () => {
  const environment = {
    osReducedTransparency: false,
    userReducedTransparency: false,
    nativeTranslucency: false,
  }

  test('an absent preference is the plain canvas', () => {
    expect(resolveSurfaceState(undefined, environment)).toEqual({
      surface: 'opaque',
      reduceTransparencyActive: false,
    })
  })

  test('reports why a surface is opaque: the OS, or the user', () => {
    expect(resolveSurfaceState('frosted', { ...environment, osReducedTransparency: true })).toEqual(
      { surface: 'opaque', reduceTransparencyActive: true }
    )
    expect(
      resolveSurfaceState('translucent', { ...environment, userReducedTransparency: true })
    ).toEqual({ surface: 'opaque', reduceTransparencyActive: true })
  })

  test('a translucent request without the capability is frosted and not "reduced"', () => {
    expect(resolveSurfaceState('translucent', environment)).toEqual({
      surface: 'frosted',
      reduceTransparencyActive: false,
    })
  })
})

describe('normalizeSurface', () => {
  test('keeps the three surfaces and drops everything else to undefined', () => {
    for (const surface of themeSurfaces) expect(normalizeSurface(surface)).toBe(surface)
    for (const garbage of ['glass', '', 1, null, undefined, {}, ['frosted']]) {
      expect(normalizeSurface(garbage)).toBeUndefined()
    }
  })
})

describe('the stylesheet and the policy agree', () => {
  test('theme.css declares the amounts the provider writes', () => {
    expect(valueOf('surface-alpha', 'root')).toBe(surfaceAlpha.opaque)
    expect(valueOf('surface-frost', 'root')).toBe(surfaceAlpha.frosted)
    expect(valueOf('surface-translucent', 'root')).toBe(surfaceAlpha.translucent)
  })

  test('the OS backstop media query is the one the provider listens to', () => {
    expect(REDUCED_TRANSPARENCY_QUERY).toBe('(prefers-reduced-transparency: reduce)')
    expect(THEME_CSS).toContain(`@media ${REDUCED_TRANSPARENCY_QUERY}`)
  })

  test('frost applies to modal dialogs only, and only under the frosted surface', () => {
    const rule = /(\[data-surface='frosted'\][^{]*)\{([^}]*)\}/.exec(THEME_CSS)
    expect(rule?.[1]?.trim()).toBe("[data-surface='frosted'] [role='dialog']:not([data-variant])")
    expect(rule?.[2]).toContain('var(--surface-alpha)')
    expect(rule?.[2]).toContain('backdrop-filter')
  })
})

const toRgb = (colour: string): [number, number, number] => {
  const parsed = parseCatalogueColor(colour)
  if (!parsed) throw new Error(`unreadable colour ${colour}`)
  const hex = oklchToHex(parsed)
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [
    number,
    number,
    number,
  ]
}
const hexOf = (rgb: number[]) =>
  `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`

describe('a frosted dialog stays legible over any backdrop', () => {
  // `color-mix(in srgb, var(--background) A%, transparent)` over a backdrop is the
  // plain sRGB blend. The blur only spreads the backdrop, so the extremes (black and
  // white) bound what can sit behind the fill.
  for (const [scope, label] of [
    ['root', 'light'],
    ['dark', 'dark'],
  ] as const) {
    for (const [surface, alpha] of Object.entries(surfaceAlpha)) {
      test(`${label} theme, ${surface}: text keeps its floor over black and over white`, () => {
        const background = toRgb(valueOf('background', scope)!)
        for (const [name, backdrop] of [
          ['black', [0, 0, 0]],
          ['white', [255, 255, 255]],
        ] as const) {
          const fill = background.map(
            (channel, index) => channel * Number(alpha) + backdrop[index]! * (1 - Number(alpha))
          )
          // Secondary text on the translucent fill is held to the 3:1 floor only: the
          // 0.8 fill is the native-vibrancy placeholder (a host without the
          // capability paints the frosted one), and against a pure black or white
          // backdrop, which no real window sits on, muted text cannot clear 4.5:1.
          const floors: [string, number][] = [
            ['foreground', 4.5],
            ['muted-foreground', surface === 'translucent' ? 3 : 4.5],
          ]
          for (const [token, floor] of floors) {
            const text = parseCatalogueColor(valueOf(token, scope)!)!
            const measured = contrastRatio(text, parseCatalogueColor(hexOf(fill))!)
            expect(
              measured,
              `${token} on a ${surface} ${label} dialog over ${name} is ${measured.toFixed(2)}:1`
            ).toBeGreaterThanOrEqual(floor)
          }
        }
      })
    }
  }
})
