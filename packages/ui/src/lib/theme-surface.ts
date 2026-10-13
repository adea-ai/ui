/*
 * Copyright (c) 2026 Wing
 * Licensed under the MIT License.
 *
 * `resolveSurface` is Zeron's `SurfacePreference.resolve` (https://github.com/zeronsh/zeron),
 * extended by Adea's accepted port of it (`packages/ui/src/components/appearance.ts`)
 * with the translucent capability gate and the reduced-transparency policy. Moved
 * here so the shared provider and Adea run one implementation. See NOTICE.
 */

/**
 * The surface axis, and the policy that decides what it paints.
 *
 * A surface is how opaque the window's elevated panels are: `opaque` is the plain
 * canvas, `frosted` is a tokenized translucent fill over a blur (works everywhere,
 * in CSS alone), and `translucent` asks for the host window's own vibrancy, which only
 * a desktop shell can honour.
 *
 * Nothing here touches the document or a signal. The provider reads the operating
 * system and the host's capability, calls {@link resolveSurface}, and
 * `theme-document.ts` writes the answer; the rule itself is a function of its four
 * inputs, which is what makes it testable.
 */
export type ThemeSurface = 'opaque' | 'frosted' | 'translucent'

/** Every surface, in the order a picker offers them. */
export const themeSurfaces: readonly ThemeSurface[] = ['opaque', 'frosted', 'translucent']

/** The media query the operating system's Reduce Transparency setting answers. */
export const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)'

/**
 * What the world says about transparency, as opposed to what the user prefers.
 */
export type SurfaceEnvironment = Readonly<{
  /** The operating system asks for less transparency. */
  osReducedTransparency: boolean
  /** The user turned reduced transparency on inside the application. */
  userReducedTransparency: boolean
  /** The host window can render OS translucency (vibrancy, acrylic). */
  nativeTranslucency: boolean
}>

/**
 * A stored value as a surface, or nothing.
 *
 * `undefined` rather than `opaque` for an unreadable value: the selection field is
 * optional, and an absent field is how a store that never chose a surface stays
 * byte-identical to what it was before the axis existed.
 */
export function normalizeSurface(value: unknown): ThemeSurface | undefined {
  return value === 'opaque' || value === 'frosted' || value === 'translucent' ? value : undefined
}

/**
 * The surface to paint: the preference, after the accessibility override and the
 * host's capability.
 *
 * The OS setting or the user's own flag forces an accessible opaque fallback. A
 * translucent request on a host without native translucency renders the tokenized
 * frosted surface instead of pretending to OS vibrancy.
 */
export function resolveSurface(
  preference: ThemeSurface,
  environment: SurfaceEnvironment
): ThemeSurface {
  if (environment.osReducedTransparency || environment.userReducedTransparency) return 'opaque'
  if (preference === 'translucent' && !environment.nativeTranslucency) return 'frosted'
  return preference
}

/**
 * The fill opacity each surface paints, written as `--surface-alpha`.
 *
 * These are the values `--surface-frost` and `--surface-translucent` declare in
 * `theme.css` (the stylesheet is the readable copy; `tests/theme-surface.test.ts`
 * fails when the two disagree). They are numbers rather than `var()` references so
 * the property reads the same to a script, a test and the stylesheet, whichever
 * wrote it.
 */
export const surfaceAlpha: Readonly<Record<ThemeSurface, string>> = {
  opaque: '1',
  frosted: '0.92',
  translucent: '0.8',
}

/** What a selection paints for the surface axis. */
export type SurfaceState = Readonly<{
  /** The surface after the accessibility override and capability gate. */
  surface: ThemeSurface
  /** True while the OS or the user forces opaque surfaces. */
  reduceTransparencyActive: boolean
}>

/**
 * The surface state for a preference and an environment.
 *
 * A preference of `undefined` is `opaque`: the axis is optional on a selection, and
 * a host that never set it gets the plain canvas.
 */
export function resolveSurfaceState(
  preference: ThemeSurface | undefined,
  environment: SurfaceEnvironment
): SurfaceState {
  return {
    surface: resolveSurface(preference ?? 'opaque', environment),
    reduceTransparencyActive:
      environment.osReducedTransparency || environment.userReducedTransparency,
  }
}
