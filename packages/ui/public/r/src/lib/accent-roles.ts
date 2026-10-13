/*
 * Copyright (c) 2026 Wing
 * SPDX-License-Identifier: MIT
 *
 * The colour helpers, the contrast gate and the custom-accent grammar are
 * substantially translated from Zeron's `Color` and `AccentRoles`
 * (https://github.com/zeronsh/zeron), as Adea's accepted port of them in
 * `packages/ui/src/components/appearance.ts` expresses it. Extracted here so the
 * shared provider and Adea run one implementation; `@adea-ai/themes` owns the
 * colour engine (parsing, contrast, repair, the preset values and their roles).
 * See NOTICE.
 */

import {
  ACCENTS,
  accentRoles,
  accentValue,
  primarySubtleCss,
  type AccentPreset,
  type AccentRoles as CatalogueAccentRoles,
} from '@adea-ai/themes'
import {
  contrastRatio as canonicalContrastRatio,
  oklchToHex,
  parseColor as parseCanonicalColor,
  repairContrast,
  type Oklch,
} from '@adea-ai/themes/oklch'
import type { ThemeAppearance } from './themes'

/**
 * Accent colour maths and the roles an accent paints.
 *
 * Three questions live here, and none of them touches the document or a signal:
 *
 *   - **What colour is this?** `parseColor`, `colorToHex`, `contrastRatio` and
 *     `ensureContrast` are the hex helpers a host needs around an accent (an
 *     imported theme's colours, a colour field). Hex is the host preference format;
 *     the catalogue's colour engine does the maths.
 *   - **Is this accent readable on this surface?** The *contrast floor*. A preset is
 *     curated, so the catalogue already measured it against its own themes and the
 *     floor is the identity for it; a custom `#rrggbb` is anyone's choice, so it is
 *     raised until it clears the floor and can never ship unreadable. A host that
 *     imports themes (whose backgrounds the catalogue never saw) turns the floor on
 *     for presets too.
 *   - **Which custom properties does an accent own?** `AccentRoles`, written on
 *     `<html>` by the provider and onto one element by {@link paintAccentRoles}.
 */

/* Hex is the host preference format; the shared Themes package owns colour maths. */

export type RgbColor = Readonly<{ r: number; g: number; b: number; a: number }>

const HEX = /^#([0-9a-fA-F]+)$/

/** Parse a hex colour (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`). `undefined` for anything else. */
export function parseColor(value: string): RgbColor | undefined {
  const match = HEX.exec(value.trim())
  const digits = match?.[1]
  if (!digits) return undefined
  if (digits.length === 3 || digits.length === 4) {
    // Each nibble is doubled: `#abc` is `#aabbcc`.
    const [r, g, b, a] = [...digits].map((digit) => Number.parseInt(digit + digit, 16))
    return { r: r!, g: g!, b: b!, a: a ?? 255 }
  }
  if (digits.length === 6 || digits.length === 8) {
    const byte = (index: number) => Number.parseInt(digits.slice(index, index + 2), 16)
    return { r: byte(0), g: byte(2), b: byte(4), a: digits.length === 8 ? byte(6) : 255 }
  }
  return undefined
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, '0')
}

/** `#rrggbb`, or `#rrggbbaa` when the colour is not opaque. */
export function colorToHex(color: RgbColor): string {
  const opaque = `#${toHexByte(color.r)}${toHexByte(color.g)}${toHexByte(color.b)}`
  return color.a === 255 ? opaque : `${opaque}${toHexByte(color.a)}`
}

function blendOver(foreground: RgbColor, background: RgbColor): RgbColor {
  const alpha = foreground.a / 255
  const blend = (front: number, back: number) => Math.round(front * alpha + back * (1 - alpha))
  return {
    r: blend(foreground.r, background.r),
    g: blend(foreground.g, background.g),
    b: blend(foreground.b, background.b),
    a: 255,
  }
}

function toCanonicalColor(color: RgbColor): Oklch | undefined {
  return parseCanonicalColor(colorToHex({ ...color, a: 255 }))
}

/** WCAG contrast ratio between two colours. Alpha composites over the background first. */
export function contrastRatio(
  foreground: RgbColor | string,
  background: RgbColor | string
): number {
  const front = typeof foreground === 'string' ? parseColor(foreground) : foreground
  const back = typeof background === 'string' ? parseColor(background) : background
  if (!front || !back) return 0
  const opaqueFront = front.a === 255 ? front : blendOver(front, back)
  const foregroundColor = toCanonicalColor(opaqueFront)
  const backgroundColor = toCanonicalColor(back)
  if (!foregroundColor || !backgroundColor) return 0
  return canonicalContrastRatio(foregroundColor, backgroundColor)
}

const WHITE: RgbColor = { r: 255, g: 255, b: 255, a: 255 }
const WHITE_OKLCH: Oklch = { l: 1, c: 0, h: 0 }

/**
 * The nearest colour to `source` that reaches `minimum` against `canvas`, as hex.
 *
 * The catalogue's `repairContrast` is asked for a little more than the floor, in
 * 0.001 steps up to 0.05, because the result is rounded to 8-bit hex and the
 * rounded colour is what is measured: asking for exactly the floor can land a hair
 * under it after rounding. If nothing in that range survives the rounding, white or
 * black stands in, whichever clears the floor.
 */
function repairedHex(source: Oklch, canvas: Oklch, minimum: number): string {
  for (let margin = 0; margin <= 0.05; margin = Number((margin + 0.001).toFixed(3))) {
    const repaired = repairContrast(source, canvas, minimum + margin)
    if (!repaired.satisfied) continue
    const hex = oklchToHex(repaired.color)
    const rounded = parseCanonicalColor(hex)
    if (rounded && canonicalContrastRatio(rounded, canvas) >= minimum) return hex
  }
  return canonicalContrastRatio(WHITE_OKLCH, canvas) >= minimum ? '#ffffff' : '#000000'
}

/** Preserve the host hex shape while delegating contrast repair to the catalogue. */
export function ensureContrast(color: RgbColor, background: RgbColor, minimum: number): RgbColor {
  if (contrastRatio(color, background) >= minimum) return color

  const renderedColor = color.a === 255 ? color : blendOver(color, background)
  const source = toCanonicalColor(renderedColor)
  const canvas = toCanonicalColor(background)
  if (!source || !canvas) return color
  return parseColor(repairedHex(source, canvas, minimum))!
}

/** The contrast an accent is held to against its surface unless the host sets another. */
export const DEFAULT_ACCENT_CONTRAST_FLOOR = 3

/**
 * Normalise a custom accent against a surface: unparseable input is rejected
 * (`undefined`), and any accepted colour is raised to `minimum` so an accent can
 * never ship unreadable. Accepts every CSS hex length; for the stored grammar use
 * {@link normalizeCustomAccent}.
 */
export function normalizeAccentValue(
  value: string,
  background: string,
  minimum: number = DEFAULT_ACCENT_CONTRAST_FLOOR
): string | undefined {
  const parsed = parseColor(value)
  if (!parsed) return undefined
  const backdrop = parseColor(background) ?? WHITE
  return colorToHex(ensureContrast(parsed, backdrop, minimum))
}

/**
 * The stored form of a custom accent: `#rrggbb`, six digits, opaque, lower case.
 *
 * Deliberately narrower than {@link parseColor}. A stored accent is compared,
 * deduplicated and used as an attribute, so it has one spelling; a host that
 * accepts `#abc` in a field expands it before storing. Anything else — a name, an
 * `rgb()`, a short or alpha form, a non-string — is not an accent and returns
 * `undefined`.
 */
export function normalizeCustomAccent(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toLowerCase()
    : undefined
}

/** Whether a selection's accent is the custom `#rrggbb` form (any letter case). */
export function isCustomAccent(value: unknown): boolean {
  return normalizeCustomAccent(value) !== undefined
}

/**
 * The roles an accent paints, as CSS values: the catalogue's `AccentRoles`, so the
 * provider, the generated stylesheet and a host's own paint cannot disagree about
 * what a role is. `primarySubtle` is an expression over `var(--primary)`; the
 * document writer never sets it (see {@link accentOverrideVariables}), an element
 * paint must.
 */
export type AccentRoles = CatalogueAccentRoles

/** What an accent resolves against: the surface it sits on and the theme it sits in. */
export type AccentTarget = {
  /** The theme, or only its appearance. A theme gives the tint its measured strength. */
  target: Parameters<typeof accentRoles>[1]
  /** The surface the accent must read on. Without it nothing can be measured or repaired. */
  background: string | undefined
  /**
   * The contrast to hold the accent to against `background`. Absent, a preset is
   * painted verbatim and a custom colour is held to {@link DEFAULT_ACCENT_CONTRAST_FLOOR}.
   */
  floor?: number
  /**
   * The accents the selected theme pair carries (`ansi-blue`…), for an id that is
   * neither a preset nor a colour.
   */
  themeAccents?: readonly AccentPreset[]
}

function appearanceOf(target: AccentTarget['target']): ThemeAppearance {
  return typeof target === 'string' ? target : target.appearance
}

/**
 * `value` raised to `floor` against `background` as hex, or `value` itself when it
 * already clears the floor, is not a colour, or there is no surface to measure it on.
 *
 * Returning the argument itself is what makes the floor the identity for a preset
 * that already reads: the caller compares and keeps the catalogue's own roles.
 */
function gateColor(value: string, background: string | undefined, floor: number): string {
  const source = parseCanonicalColor(value)
  const canvas = background ? parseCanonicalColor(background) : undefined
  if (!source || !canvas) return value
  if (canonicalContrastRatio(source, canvas) >= floor) return value
  return repairedHex(source, canvas, floor)
}

/**
 * The roles for a preset (or a custom colour made into one), held to the floor.
 *
 * A preset that clears the floor keeps the catalogue's roles untouched. One that
 * does not is repaired to the nearest passing colour and the whole role set is
 * rebuilt from the repaired value, so the label, hover and ring follow it instead
 * of describing a colour that is no longer on screen.
 */
export function accentRolesForPreset(
  preset: AccentPreset,
  context: AccentTarget
): AccentRoles | undefined {
  const appearance = appearanceOf(context.target)
  const requested = accentValue(preset, appearance)
  if (!parseCanonicalColor(requested)) return undefined

  const floor = context.floor
  if (floor === undefined) return accentRoles(preset, context.target)

  const gated = gateColor(requested, context.background, floor)
  if (gated === requested) return accentRoles(preset, context.target)

  const roles = accentRoles({ ...preset, light: gated, dark: gated }, context.target)
  // The tint's strength is measured against the primary it will sit over, and the
  // repaired primary is not one the theme's own measurement saw.
  return { ...roles, primarySubtle: primarySubtleCss(context.target, '--primary', [gated]) }
}

/**
 * Resolve an accent selection to its roles, or `undefined` when it overrides nothing.
 *
 * `undefined` is "use the theme's own primary": the literal `theme`, an id that is
 * neither a preset, an offered theme accent nor a colour, and a colour that does not
 * parse. A host that wants one of those to mean something else decides before
 * asking (Adea's codec maps a stored `theme` to its default preset when it reads).
 */
export function resolveAccentRoles(accent: string, context: AccentTarget): AccentRoles | undefined {
  if (accent === 'theme') return undefined

  const custom = normalizeCustomAccent(accent)
  if (custom) {
    const floor = context.floor ?? DEFAULT_ACCENT_CONTRAST_FLOOR
    return accentRolesForPreset(
      { id: 'custom', label: 'Custom', description: '', light: custom, dark: custom },
      { ...context, floor }
    )
  }

  const preset =
    ACCENTS.find((candidate) => candidate.id === accent) ??
    context.themeAccents?.find((candidate) => candidate.id === accent)
  return preset ? accentRolesForPreset(preset, context) : undefined
}

/**
 * The custom properties an accent override owns on `<html>`.
 *
 * `--primary-subtle` is deliberately not among them. It is a `color-mix()` over
 * `var(--primary)`, so on the same element it follows an accent by itself, and its
 * strength is the theme's, measured to keep body text at 4.5:1 on the tint.
 * Writing one here would replace that measurement with the argument's.
 */
export function accentOverrideVariables(roles: AccentRoles): Record<string, string> {
  return {
    '--primary': roles.primary,
    '--primary-foreground': roles.primaryForeground,
    '--primary-hover': roles.primaryHover,
    '--ring': roles.ring,
  }
}

/** The custom properties {@link paintAccentRoles} writes and clears. */
export const ACCENT_PAINT_PROPERTIES = [
  '--primary',
  '--primary-foreground',
  '--primary-hover',
  '--primary-subtle',
  '--ring',
] as const

/**
 * Scope an accent to one element and its descendants.
 *
 * Unlike the document, an element must write `--primary-subtle` too. A custom
 * property that uses `var()` is resolved where it is declared, so the tint inherited
 * from `<html>` is already a mix over *`<html>`'s* primary and an element that only
 * overrides `--primary` would keep the old tint. Declared here, the same expression
 * resolves against this element's primary.
 *
 * `undefined` clears every property, and the element inherits the document's accent
 * again.
 */
export function paintAccentRoles(
  element: { style: Pick<CSSStyleDeclaration, 'setProperty' | 'removeProperty'> },
  roles: AccentRoles | undefined
): void {
  if (!roles) {
    for (const property of ACCENT_PAINT_PROPERTIES) element.style.removeProperty(property)
    return
  }
  element.style.setProperty('--primary', roles.primary)
  element.style.setProperty('--primary-foreground', roles.primaryForeground)
  element.style.setProperty('--primary-hover', roles.primaryHover)
  element.style.setProperty('--primary-subtle', roles.primarySubtle)
  element.style.setProperty('--ring', roles.ring)
}
