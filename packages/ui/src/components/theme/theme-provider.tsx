import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, splitProps, untrack } from 'solid-js'
import { safeScriptStringLiteral } from '#lib/safe-script'
import { fontSettingsBootstrapScript } from '#lib/appearance-font-settings'
import { fontZoomShortcut, type FontZoomIntent } from '#lib/font-zoom'
import { REDUCED_TRANSPARENCY_QUERY, resolveSurfaceState } from '#lib/theme-surface'
import {
  builtinThemes,
  themeAccentsFor,
  type ThemeAppearance,
  type ThemeVariant,
} from '#lib/themes'
import { themeContext } from './theme-context'
import { applyThemeToRoot, applyWithoutTransitions } from './theme-document'
import {
  localStoragePersistence,
  readPersisted,
  writePersisted,
  type ThemePersistence,
} from './theme-persistence'
import {
  accentRolesForState,
  initialThemeSelection,
  mergeRegistry,
  mergeThemeSelection,
  resolveTerminalVariant,
  resolveThemeState,
  zoomedFontSettings,
  type ThemeContextValue,
  type ThemeSelection,
} from './theme-state'

export { useOptionalTheme, useTheme } from './theme-context'
export { localStoragePersistence, type ThemePersistence } from './theme-persistence'
export type { ThemeSurface } from '#lib/theme-surface'
export {
  defaultThemeSelection,
  resolvedDensity,
  type ThemeContextValue,
  type ThemeDensity,
  type ThemeSelection,
} from './theme-state'

/**
 * ThemeProvider.
 *
 * Owns the appearance preference and applies it to the document. One provider near
 * the root; everything below reads it.
 *
 * ## What a preference is
 *
 * Four independent choices (`ThemeSelection`), and keeping them independent is the
 * point: appearance, a theme per appearance, an accent and fonts. They compose: a
 * user who wants Nord with a violet accent and the system font should not need
 * someone to author that combination.
 *
 * ## Where the rules live
 *
 * This component is wiring. What a selection merges to and resolves to is
 * `theme-state.ts`; what lands on `<html>` is `theme-document.ts`; where the
 * preference is kept is `theme-persistence.ts`. Each is plain code a test can call,
 * which is the reason none of it is inlined here.
 *
 * ## Why the variants are applied as inline properties
 *
 * The catalogue is data, and a theme is applied by writing its roles onto
 * `<html>` as custom properties. That is what makes an imported palette work
 * without a hand-written `[data-theme]` block per theme, and it is why a settings
 * UI can show a preview by reading the same object rather than by loading a
 * stylesheet. `theme.css` keeps the default theme's values so the first paint is
 * correct before any script runs.
 */
export type ThemeProviderProps = {
  children?: JSX.Element
  /** Where the preference is persisted. Distinct per application. */
  storageKey?: string
  /** Start from this instead of the stored preference. */
  initial?: Partial<ThemeSelection>
  /**
   * The selection, owned by the caller.
   *
   * For a consumer that keeps the state itself — a settings store, or a workshop
   * whose selection lives in Storybook globals — rather than handing it to this
   * provider's signal. Each change lands here and the document follows; nothing is
   * written to the store, because the caller is the one who persists. A picker
   * below the provider still works, and its change is the caller's to read back.
   *
   * Absent, the provider is the whole owner: it reads `storageKey` on mount,
   * seeds from `initial`, and persists every `setSelection`.
   */
  selection?: Partial<ThemeSelection>
  /**
   * Where the preference is kept, in place of `localStorage` under `storageKey`.
   *
   * Read once when the provider is created, so changing the prop later does not
   * move the store. `storageKey` is ignored when this is given.
   */
  persistence?: ThemePersistence
  /**
   * Variants the host adds to the built-in catalogue — themes a user imported.
   *
   * A function is read inside the provider's reactive scope, so one that reads a
   * signal keeps the picker and the document current when the set changes. A
   * stored id that names no variant, built in or added, paints the default of its
   * appearance and stays in the selection untouched.
   */
  themes?: readonly ThemeVariant[] | (() => readonly ThemeVariant[])
  /**
   * Rewrites the custom properties of each pass before they are written to
   * `<html>`: the variant's roles with the accent over them. `tokensAsHex` from
   * `lib/themes` is the one the system ships.
   */
  transformTokens?: (tokens: Record<string, string>) => Record<string, string>
  /**
   * Switch CSS transitions off for the frame that carries a change, so a theme
   * switch cannot animate the whole page. Off by default: it adds a `<style>`
   * element to `<head>` for two frames on every change.
   */
  disableTransitionOnChange?: boolean
  /**
   * The contrast ratio an accent is held to against the variant's background,
   * repaired to the nearest passing colour when it falls short. Absent, presets
   * are painted verbatim — the catalogue measured them for its own themes — and
   * only a custom `#rrggbb` is held to 3:1. A host that adds themes the catalogue
   * never measured passes 3 to hold the presets to it as well; for the catalogue's
   * own themes the floor changes no preset.
   */
  accentContrastFloor?: number
  /**
   * Turns the surface axis on: `selection.surface` and `selection.reduceTransparency`
   * are resolved against the operating system's Reduce Transparency setting and the
   * host's capability, and `data-surface`, `data-reduce-transparency` and
   * `--surface-alpha` are written to `<html>` (the frost rule in `theme.css` reads
   * them). Off by default: a provider that never opts in writes none of them, adds no
   * media-query listener, and stores nothing new.
   *
   * An object also states the host's capability. `nativeTranslucency` is whether the
   * window can render the OS's own translucency; without it a `translucent`
   * preference paints the tokenized `frosted` surface instead of pretending to
   * vibrancy. A function is read inside the provider's reactive scope, for a
   * capability that is learned after mount.
   *
   * A selection that already carries a `surface` turns the axis on for itself, so a
   * host that stores the field gets the same document without the prop.
   */
  surface?: boolean | { nativeTranslucency?: boolean | (() => boolean) }
  /**
   * Where a catalogue variant's palette comes from. `inline` (the default) writes
   * every role onto `<html>`. `stylesheet` leaves a catalogue variant to the host's
   * `[data-theme]` stylesheet and writes inline only what no stylesheet can know: a
   * host's own `themes`, the accent, the pinned terminal palette, the surface alpha
   * and the fonts. Switching from a host variant back to a catalogue one removes the
   * properties the host variant wrote.
   */
  palette?: 'inline' | 'stylesheet'
  /**
   * Bind the platform zoom chords (Cmd or Ctrl with `=`, `+`, `-`, `0`) to the three
   * text sizes instead of the browser's page zoom: stepping them together is zoom
   * inside the persisted type system. Off by default: it adds a capturing `keydown`
   * listener to `window`, and an event already handled elsewhere is left alone.
   * `zoomFonts` on the context does the same from a menu or a host's own binding.
   */
  fontZoom?: boolean
}

/** The operating system's Reduce Transparency query, where there is a window to ask. */
function reducedTransparencyMedia(): MediaQueryList | undefined {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_TRANSPARENCY_QUERY)
    : undefined
}

export function ThemeProvider(props: ThemeProviderProps) {
  const [local] = splitProps(props, [
    'children',
    'storageKey',
    'initial',
    'selection',
    'persistence',
    'themes',
    'transformTokens',
    'disableTransitionOnChange',
    'accentContrastFloor',
    'surface',
    'palette',
    'fontZoom',
  ])
  const storageKey = () => local.storageKey ?? 'adea-appearance'
  const persistence = local.persistence ?? localStoragePersistence(storageKey)

  // Read before the first resolution and before the store is, so a persistence whose
  // answer depends on the extras (an id it only accepts if the theme exists) sees
  // them.
  const extraThemes = createMemo(() =>
    typeof local.themes === 'function' ? local.themes() : (local.themes ?? [])
  )
  const registry = createMemo(() => mergeRegistry(builtinThemes, extraThemes()))

  const [selection, setSelectionState] = createSignal<ThemeSelection>(
    initialThemeSelection(readPersisted(persistence), local.initial)
  )

  // The controlled half of the contract. A patch from the owner replaces the
  // matching axes; the stored preference is untouched, since the owner is the one
  // that persists. Reading `local.selection` — a prop getter, not a destructured
  // value — is what keeps this subscribed for the provider's lifetime.
  createEffect(() => {
    const incoming = local.selection
    if (incoming) setSelectionState((current) => mergeThemeSelection(current, incoming))
  })

  const [systemAppearance, setSystemAppearance] = createSignal<ThemeAppearance>('light')

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemAppearance(query.matches ? 'dark' : 'light')
    const onChange = (event: MediaQueryListEvent) =>
      setSystemAppearance(event.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    onCleanup(() => query.removeEventListener('change', onChange))
  }

  // What the stored preference resolves to. `selection()`, `variant()` and
  // `resolvedAppearance()` answer from this and never from a preview, so a picker
  // that previews a draft still reads back what is committed.
  const committed = createMemo(() => resolveThemeState(selection(), systemAppearance(), registry()))
  const resolvedAppearance = createMemo<ThemeAppearance>(() => committed().appearance)
  const variant = createMemo<ThemeVariant>(() => committed().variant)

  const [draft, setDraft] = createSignal<Partial<ThemeSelection> | undefined>()
  const shownSelection = createMemo(() => {
    const preview = draft()
    return preview ? mergeThemeSelection(selection(), preview) : selection()
  })
  const shown = createMemo(() =>
    draft() ? resolveThemeState(shownSelection(), systemAppearance(), registry()) : committed()
  )

  // The surface axis. Off, none of this reads the operating system: the media query
  // is subscribed only while the axis is on, so a provider that never opts in adds no
  // listener and no repaint.
  const surfaceOn = (candidate: ThemeSelection) =>
    local.surface === true || typeof local.surface === 'object' || candidate.surface !== undefined
  const nativeTranslucency = () => {
    const capability = typeof local.surface === 'object' ? local.surface.nativeTranslucency : false
    return (typeof capability === 'function' ? capability() : capability) === true
  }
  const [osReducedTransparency, setOsReducedTransparency] = createSignal(
    surfaceOn(untrack(shownSelection)) ? (reducedTransparencyMedia()?.matches ?? false) : false
  )
  const axisOn = createMemo(() => surfaceOn(shownSelection()))
  createEffect(() => {
    const query = axisOn() ? reducedTransparencyMedia() : undefined
    setOsReducedTransparency(query?.matches ?? false)
    if (!query) return
    const onChange = (event: MediaQueryListEvent) => setOsReducedTransparency(event.matches)
    query.addEventListener('change', onChange)
    onCleanup(() => query.removeEventListener('change', onChange))
  })
  const surfaceStateOf = (candidate: ThemeSelection) =>
    resolveSurfaceState(candidate.surface, {
      osReducedTransparency: osReducedTransparency(),
      userReducedTransparency: candidate.reduceTransparency === true,
      nativeTranslucency: nativeTranslucency(),
    })
  const committedSurface = createMemo(() =>
    surfaceOn(selection()) ? surfaceStateOf(selection()) : undefined
  )

  let written: ReadonlySet<string> | undefined
  let restoreTransitions: (() => void) | undefined
  createEffect(() => {
    if (typeof document === 'undefined') return
    const state = {
      selection: shownSelection(),
      appearance: shown().appearance,
      variant: shown().variant,
      terminalVariant: resolveTerminalVariant(shownSelection().terminalThemeId, registry()),
      surface: axisOn() ? surfaceStateOf(shownSelection()) : undefined,
    }
    const options = {
      transformTokens: local.transformTokens,
      accentContrastFloor: local.accentContrastFloor,
      palette: local.palette,
    }
    const apply = () => {
      written = applyThemeToRoot(document.documentElement, state, options, written)
    }
    if (local.disableTransitionOnChange) {
      restoreTransitions?.()
      restoreTransitions = applyWithoutTransitions(document, apply)
    } else {
      apply()
    }
  })
  onCleanup(() => restoreTransitions?.())

  const themeAccents = createMemo(() =>
    themeAccentsFor(selection().lightThemeId, selection().darkThemeId)
  )

  const zoomFonts = (intent: FontZoomIntent) =>
    value.setSelection({ fonts: zoomedFontSettings(selection(), intent) })

  // The platform zoom chords drive the three text sizes, captured like the other
  // global chords; an event something else already handled never double-steps.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    const intent = fontZoomShortcut(event)
    if (!intent) return
    event.preventDefault()
    zoomFonts(intent)
  }
  createEffect(() => {
    if (!local.fontZoom || typeof window === 'undefined') return
    window.addEventListener('keydown', onKeyDown, { capture: true })
    onCleanup(() => window.removeEventListener('keydown', onKeyDown, { capture: true }))
  })

  const value: ThemeContextValue = {
    selection,
    resolvedAppearance,
    variant,
    themes: builtinThemes,
    themeAccents,
    allThemes: registry,
    preview(next) {
      setDraft(next ? { ...next } : undefined)
    },
    previewing: () => draft() !== undefined,
    accentRolesFor: (accent, variantId) =>
      accentRolesForState(accent, variantId, {
        selection: selection(),
        variant: variant(),
        registry: registry(),
        accentContrastFloor: local.accentContrastFloor,
      }),
    effectiveSurface: () => committedSurface()?.surface ?? 'opaque',
    reduceTransparencyActive: () => committedSurface()?.reduceTransparencyActive ?? false,
    zoomFonts,
    setSelection(patch) {
      const next = mergeThemeSelection(selection(), patch)
      setSelectionState(next)
      // The committed selection is now what should be showing.
      setDraft(undefined)
      writePersisted(persistence, next)
    },
  }

  const Context = themeContext()
  return <Context.Provider value={value}>{local.children}</Context.Provider>
}

/**
 * A string as a JavaScript literal that is also safe inside an inline `<script>`.
 *
 * `JSON.stringify` produces a correct JavaScript literal, and it is **not** safe
 * here: it leaves `<` and `>` alone, so a value containing `</script>` ends the tag
 * early and everything after it is parsed as HTML. That is the classic inline-script
 * injection, and it is a real one even though the value is a developer-supplied prop
 * rather than user input — a prop can come from configuration, and a key that happens
 * to contain a closing tag should not be able to execute.
 *
 * The escape is also correct JavaScript: `\u003c` is `<` to the parser, so the value
 * is byte-identical at runtime and inert to the HTML tokenizer. `\u2028` and `\u2029`
 * are escaped for the neighbouring reason — they are legal inside a JSON string and
 * were, before ES2019, line terminators to a JavaScript parser.
 *
 * CodeQL flags the unescaped form as `js/bad-code-sanitization`, which is how this
 * was found; `tests/theme-script.test.ts` pins it so it cannot come back.
 */
export function inlineScriptLiteral(value: string): string {
  return safeScriptStringLiteral(value)
}

/**
 * The no-flash script.
 *
 * Rendered inline in `<head>` before any stylesheet that matters. Without it a dark
 * preference paints the light theme first and then swaps, which is the flash every
 * themed application has to solve and the one thing a provider cannot do from
 * inside the body.
 *
 * Deliberately tiny and dependency-free: it reads the stored preference, resolves
 * `system`, and sets the class. It does not apply the variant's roles — the default
 * theme in `theme.css` covers the first paint, and the provider writes the rest on
 * mount.
 *
 * The script reads two values out of `localStorage` and writes them to `dataset`,
 * which is a *property* assignment rather than code: a stored accent or font id can
 * set an attribute and cannot execute. The one value that reaches the source as text
 * is `storageKey`, and it goes through {@link inlineScriptLiteral} for the reason
 * documented there.
 */
export function themeScript(storageKey = 'adea-appearance'): string {
  const script = `(function(){try{var s=localStorage.getItem(${inlineScriptLiteral(storageKey)});var p=s?JSON.parse(s):{};var a=p.appearance||'system';var d=a==='dark'||(a==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';if(p.accent&&p.accent!=='theme')r.dataset.accent=p.accent;if(p.density==='compact')r.dataset.density='compact';}catch(e){}})();`
  return `${script}${fontSettingsBootstrapScript(storageKey)}`
}
