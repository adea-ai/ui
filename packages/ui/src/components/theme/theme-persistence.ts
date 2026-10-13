import { accentPresets } from '#lib/tokens'
import { normalizeAppearanceEditorFontSettings } from '#lib/appearance-font-settings'
import { defaultDarkThemeId, defaultLightThemeId, isThemeAccentId, themeById } from '#lib/themes'
import { defaultThemeSelection, resolvedDensity, type ThemeSelection } from './theme-state'

/**
 * Where a selection is kept between sessions.
 *
 * The provider never touches storage itself; it asks a `ThemePersistence`. The
 * default is {@link localStoragePersistence}, which is what the provider always did.
 * A host that stores the preference in a different shape, under a versioned
 * envelope, or somewhere that is not `localStorage` supplies its own and the
 * resolution and application rules stay the shared ones.
 *
 * The contract is deliberately narrow, so that an implementation cannot make the
 * provider less safe than it was:
 *
 *   - `read` is synchronous and runs once, when the provider is created. It may
 *     repair or quarantine what it finds, and it must not throw: the provider
 *     treats a throw as "nothing stored" and starts from the defaults.
 *   - `write` runs only from `setSelection`. Never on mount, never from `preview`,
 *     never as a side effect of reading, so the first write to a store is always a
 *     user's decision. A throw is swallowed, because a full or blocked store must
 *     not break the switch.
 */
export type ThemePersistence = {
  read(): Partial<ThemeSelection> | undefined
  write(next: ThemeSelection): void
}

/**
 * The preference store, or nothing.
 *
 * Only ever called inside a `try`: where storage is blocked — a sandboxed iframe, a
 * privacy mode, a denied site-data permission — merely *reading* the `localStorage`
 * global throws ("Access is denied", `SecurityError`), so even the `typeof` guard
 * has to sit inside the `try` rather than in front of it. Without a store the
 * preference lives only in the provider's signal for the session.
 */
function preferenceStore(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

/** The stored preference, validated against the catalogue. */
function readSelection(storageKey: string): ThemeSelection {
  try {
    const raw = preferenceStore()?.getItem(storageKey)
    if (!raw) return defaultThemeSelection
    const parsed = JSON.parse(raw) as Partial<ThemeSelection>
    const fonts = normalizeAppearanceEditorFontSettings(parsed.fonts, parsed.font).settings
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
      // A theme accent is kept whenever it names a slot, even one the stored pair
      // cannot offer: the id is role-shaped so it survives a theme switch, and an
      // unoffered slot already resolves to the theme's own primary when applied.
      accent:
        typeof parsed.accent === 'string' &&
        (accentPresets.some((preset) => preset.id === parsed.accent) ||
          isThemeAccentId(parsed.accent))
          ? parsed.accent
          : defaultThemeSelection.accent,
      font: fonts.ui.family,
      fonts,
      // Every axis has to be read back here, or it is lost twice: the provider's
      // document effect removes the `data-density` that `themeScript` set for the first paint, and
      // the next `setSelection` rewrites the store without it.
      density: resolvedDensity(parsed as ThemeSelection),
    }
  } catch {
    return defaultThemeSelection
  }
}

/**
 * The default persistence: one JSON document in `localStorage` under `key`.
 *
 * `read` is the provider's original `readSelection`, moved here unchanged — every
 * stored id is validated against the catalogue, so a stale preference falls back to
 * a default rather than reaching the document. `key` may be a function so a
 * provider whose `storageKey` prop changes writes to the key it is now given.
 *
 * Blocked, full or absent storage is survivable in both directions: a read answers
 * with the defaults and a write is dropped, so the preference simply lasts the
 * session.
 */
export function localStoragePersistence(key: string | (() => string)): ThemePersistence {
  const keyOf = () => (typeof key === 'function' ? key() : key)
  return {
    read: () => readSelection(keyOf()),
    write(next) {
      try {
        preferenceStore()?.setItem(keyOf(), JSON.stringify(next))
      } catch {
        // A full, blocked or unavailable store must not break the switch: the
        // preference simply does not survive the reload.
      }
    },
  }
}

/**
 * What a persistence knows, or nothing.
 *
 * The seam's `read` must not throw, and the provider does not rely on that: a host
 * persistence is code the design system has not seen, and a theme provider that
 * fails to mount because a store misbehaved has turned a lost preference into a
 * blank application.
 */
export function readPersisted(persistence: ThemePersistence): Partial<ThemeSelection> | undefined {
  try {
    return persistence.read()
  } catch {
    return undefined
  }
}

/** Hand a selection to the store; a store that throws loses the preference, not the switch. */
export function writePersisted(persistence: ThemePersistence, next: ThemeSelection): void {
  try {
    persistence.write(next)
  } catch {
    // Same contract as a full or blocked `localStorage`: the choice holds for the
    // session and does not survive the reload.
  }
}
