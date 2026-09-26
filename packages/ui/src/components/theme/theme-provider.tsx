import type { JSX } from 'solid-js'
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  splitProps,
  useContext,
} from 'solid-js'
import { accentPresets, fontOptions } from '#lib/tokens'
import {
  builtinThemes,
  defaultDarkThemeId,
  defaultLightThemeId,
  themeById,
  themeCssVariables,
  type ThemeAppearance,
  type ThemeVariant,
} from '#lib/themes'

/**
 * ThemeProvider.
 *
 * Owns the appearance preference and applies it to the document. One provider near
 * the root; everything below reads it.
 *
 * ## What a preference is
 *
 * Four independent choices, and keeping them independent is the point:
 *
 *   - **appearance** — light, dark, or follow the system.
 *   - **a theme per appearance** — so a user can run Catppuccin Mocha by night and
 *     Solarized Light by day without re-choosing when the system flips.
 *   - **an accent** — adea's six presets, which re-colour the interactive roles on
 *     top of whichever theme is active.
 *   - **a font** — the interface face.
 *
 * Four axes rather than one list of presets, because they compose: a user who wants
 * Nord with a violet accent and the system font should not need someone to author
 * that combination.
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
export type ThemeSelection = {
  /** `system` follows `prefers-color-scheme` and updates when it changes. */
  appearance: ThemeAppearance | 'system'
  /** The variant to use when the resolved appearance is light. */
  lightThemeId: string
  /** The variant to use when the resolved appearance is dark. */
  darkThemeId: string
  /** An `accentPresets` id, or `theme` for the variant's own primary. */
  accent: string
  /** A `fontOptions` id, or `space-grotesk` for the default. */
  font: string
}

export const defaultThemeSelection: ThemeSelection = {
  appearance: 'system',
  lightThemeId: defaultLightThemeId,
  darkThemeId: defaultDarkThemeId,
  accent: 'theme',
  font: 'space-grotesk',
}

export type ThemeContextValue = {
  /** The preference as stored. */
  selection: () => ThemeSelection
  /** What the preference resolves to right now, after `system`. */
  resolvedAppearance: () => ThemeAppearance
  /** The variant in use. */
  variant: () => ThemeVariant
  /** Update part of the preference. */
  setSelection: (patch: Partial<ThemeSelection>) => void
  /** The catalogue, so a picker does not import it separately. */
  themes: readonly ThemeVariant[]
}

const ThemeContext = createContext<ThemeContextValue>()

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be called inside a <ThemeProvider>.')
  return value
}

/** The stored preference, validated against the catalogue. */
function readSelection(storageKey: string): ThemeSelection {
  if (typeof localStorage === 'undefined') return defaultThemeSelection
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaultThemeSelection
    const parsed = JSON.parse(raw) as Partial<ThemeSelection>
    return {
      appearance:
        parsed.appearance === 'light' ||
        parsed.appearance === 'dark' ||
        parsed.appearance === 'system'
          ? parsed.appearance
          : defaultThemeSelection.appearance,
      // An unknown id would leave the document with no theme at all, so a stale
      // preference from an older catalogue falls back rather than applying nothing.
      lightThemeId:
        themeById(parsed.lightThemeId ?? '')?.appearance === 'light'
          ? (parsed.lightThemeId as string)
          : defaultLightThemeId,
      darkThemeId:
        themeById(parsed.darkThemeId ?? '')?.appearance === 'dark'
          ? (parsed.darkThemeId as string)
          : defaultDarkThemeId,
      accent: accentPresets.some((preset) => preset.id === parsed.accent)
        ? (parsed.accent as string)
        : defaultThemeSelection.accent,
      font: fontOptions.some((option) => option.id === parsed.font)
        ? (parsed.font as string)
        : defaultThemeSelection.font,
    }
  } catch {
    return defaultThemeSelection
  }
}

export type ThemeProviderProps = {
  children?: JSX.Element
  /** Where the preference is persisted. Distinct per application. */
  storageKey?: string
  /** Start from this instead of the stored preference. */
  initial?: Partial<ThemeSelection>
}

export function ThemeProvider(props: ThemeProviderProps) {
  const [local] = splitProps(props, ['children', 'storageKey', 'initial'])
  const storageKey = () => local.storageKey ?? 'adea-appearance'

  const [selection, setSelectionState] = createSignal<ThemeSelection>({
    ...readSelection(storageKey()),
    ...local.initial,
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

  const resolvedAppearance = createMemo<ThemeAppearance>(() => {
    const preference = selection().appearance
    if (preference === 'system') return systemAppearance()
    return preference
  })

  const variant = createMemo<ThemeVariant>(() => {
    const id = resolvedAppearance() === 'dark' ? selection().darkThemeId : selection().lightThemeId
    return themeById(id) ?? builtinThemes[0]!
  })

  createEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const active = variant()

    // The variant's roles, as properties. `--primary` and `--ring` are written here
    // too, and the accent block below overrides them when one is selected — the
    // same precedence the product applies, where an accent selection wins over the
    // variant's own primary.
    for (const [name, value] of Object.entries(themeCssVariables(active))) {
      root.style.setProperty(name, value)
    }

    root.classList.toggle('dark', resolvedAppearance() === 'dark')
    root.dataset['theme'] = active.id
    root.dataset['appearance'] = resolvedAppearance()
    root.style.colorScheme = resolvedAppearance()

    if (selection().accent === 'theme') root.removeAttribute('data-accent')
    else root.dataset['accent'] = selection().accent

    if (selection().font === 'space-grotesk') root.removeAttribute('data-font')
    else root.dataset['font'] = selection().font
  })

  const value: ThemeContextValue = {
    selection,
    resolvedAppearance,
    variant,
    themes: builtinThemes,
    setSelection(patch) {
      const next = { ...selection(), ...patch }
      setSelectionState(next)
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(storageKey(), JSON.stringify(next))
        } catch {
          // A full or unavailable store must not break the switch: the preference
          // simply does not survive the reload.
        }
      }
    },
  }

  return <ThemeContext.Provider value={value}>{local.children}</ThemeContext.Provider>
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
  return JSON.stringify(value).replace(
    /[<>\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
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
  return `(function(){try{var s=localStorage.getItem(${inlineScriptLiteral(storageKey)});var p=s?JSON.parse(s):{};var a=p.appearance||'system';var d=a==='dark'||(a==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';if(p.accent&&p.accent!=='theme')r.dataset.accent=p.accent;if(p.font&&p.font!=='space-grotesk')r.dataset.font=p.font;}catch(e){}})();`
}
