/**
 * The catalogue facts `theme-defaults.generated.ts` holds, recomputed from the live
 * catalogue. Shared by the generator and by the test that compares its output with
 * the committed file.
 */
import { primarySubtleCss, themeAccentPresets, themes as catalogue } from '@adea-ai/themes'
import { floorEditorPalette, variantFromRecord } from '../src/lib/themes'

export const defaultLightThemeId = 'adea-light'
export const defaultDarkThemeId = 'adea-dark'

export function themeDefaultsData() {
  const light = catalogue.find((theme) => theme.id === defaultLightThemeId)!
  const dark = catalogue.find((theme) => theme.id === defaultDarkThemeId)!
  const variants = {
    [defaultLightThemeId]: variantFromRecord(light),
    [defaultDarkThemeId]: variantFromRecord(dark),
  }
  return {
    index: catalogue.map((theme) => [theme.id, theme.appearance] as const),
    variants,
    accents: themeAccentPresets(light, dark),
    primarySubtle: Object.fromEntries(
      [light, dark].map((theme) => [theme.id, primarySubtleCss(theme)])
    ),
    floorEditor: Object.fromEntries(
      [light, dark].map((theme) => [
        theme.id,
        floorEditorPalette(theme, variants[theme.id as keyof typeof variants].editor),
      ])
    ),
  }
}
