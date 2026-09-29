import { accentPresets, fontOptions } from '@adea-ai/ui/lib/tokens'
import {
  defaultDarkThemeId,
  defaultLightThemeId,
  themeById,
  type ThemeAppearance,
} from '@adea-ai/ui/lib/themes'
import type { ThemeSelection } from '@adea-ai/ui/components/theme/theme-provider'

/**
 * The workshop globals → the provider's `ThemeSelection`, in one pure function.
 *
 * This is the one piece of workshop configuration where a bad value is visible in
 * the document rather than in a console: whatever this returns is what the
 * provider paints. Like `theme-classes.ts` before it, it lives outside
 * `preview.tsx` so `tests/unit` can pin it without booting a browser.
 *
 * ## The vocabulary
 *
 * Three of the globals are the toolbar's; two more are URL-settable axes with no
 * toolbar control.
 *
 *   - `appearance` — `light` or `dark`. The workshop pins polarity rather than
 *     following the system: a reviewer asks for a side of the catalogue, and a
 *     system flip mid-review would be a heisenbug.
 *   - `theme` — a catalogue variant id, or the bare `light`/`dark` aliases the
 *     lanes write (`globals=theme:dark` predates the toolbar and means "the dark
 *     side, default variant"). A catalogue id carries its own appearance, so a
 *     URL that names a light variant *is* a request for the light side.
 *   - `accent` — an `accentPresets` id. `theme` is the default and means the
 *     variant's own primary; the toolbar shows it as "Theme Default".
 *   - `font`, `density` — no toolbar control by design; the URLs are how a lane
 *     pins them.
 *
 * When `appearance` and a `theme` variant disagree, appearance wins and the
 * variant falls back to that side's default — the two globals must describe one
 * document, and the toolbar always writes them as a pair. An unknown id falls
 * back rather than applying nothing, so a stale URL degrades to the defaults
 * instead of an unthemed canvas.
 */
export type WorkshopGlobals = {
  appearance?: unknown
  theme?: unknown
  accent?: unknown
  font?: unknown
  density?: unknown
}

/** The variant the workshop opens on, and the side each alias names. */
export const workshopDefaults = {
  appearance: 'dark' as ThemeAppearance,
  accent: 'theme',
  font: 'space-grotesk',
  density: 'comfortable' as const,
}

export function resolveSelection(globals: WorkshopGlobals): ThemeSelection {
  // The variant named by `theme`, if it is a catalogue id at all. The bare
  // `light`/`dark` aliases are not ids and fall through to the defaults below.
  const requested = typeof globals.theme === 'string' ? themeById(globals.theme) : undefined
  const alias = globals.theme === 'light' || globals.theme === 'dark' ? globals.theme : undefined

  const appearance: ThemeAppearance =
    globals.appearance === 'light' || globals.appearance === 'dark'
      ? globals.appearance
      : (requested?.appearance ?? alias ?? workshopDefaults.appearance)

  // The variant is only kept when it lives on the resolved side; otherwise the
  // pair would disagree about what the document should be.
  const variant =
    requested?.appearance === appearance
      ? requested.id
      : appearance === 'light'
        ? defaultLightThemeId
        : defaultDarkThemeId

  const accent =
    typeof globals.accent === 'string' &&
    accentPresets.some((preset) => preset.id === globals.accent)
      ? globals.accent
      : workshopDefaults.accent

  const font =
    typeof globals.font === 'string' && fontOptions.some((option) => option.id === globals.font)
      ? globals.font
      : workshopDefaults.font

  return {
    appearance,
    lightThemeId: appearance === 'light' ? variant : defaultLightThemeId,
    darkThemeId: appearance === 'dark' ? variant : defaultDarkThemeId,
    accent,
    font,
    density: globals.density === 'compact' ? 'compact' : workshopDefaults.density,
  }
}
