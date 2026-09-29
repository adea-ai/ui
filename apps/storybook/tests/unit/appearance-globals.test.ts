import { describe, expect, test } from 'bun:test'
import { accentPresets } from '@adea-ai/ui/lib/tokens'
import {
  defaultDarkThemeId,
  defaultLightThemeId,
  themesForAppearance,
} from '@adea-ai/ui/lib/themes'
import { resolveSelection, workshopDefaults } from '../../.storybook/appearance-globals'

/**
 * The workshop's globals vocabulary, as invariants.
 *
 * These are here rather than in a browser test because the failure they guard
 * against is a *configuration* failure: whatever this resolver returns is what
 * the provider paints, and a wrong value is a wrong document — not an exception.
 * The browser lane still covers the result — it checks every story in two
 * themes — but it can only check the themes it is told to use, and this checks
 * the ones it is not.
 */
describe('the workshop appearance globals', () => {
  /**
   * A catalogue id carries its own side: `globals=theme:adea-light` is a request
   * for the light side, which is how the accessibility lane reviews light themes
   * without a second global.
   */
  test('a catalogue id pins the appearance it declares', () => {
    for (const theme of themesForAppearance('light').slice(0, 3)) {
      const selection = resolveSelection({ theme: theme.id })
      expect(selection.appearance).toBe('light')
      expect(selection.lightThemeId).toBe(theme.id)
      expect(selection.darkThemeId).toBe(defaultDarkThemeId)
    }
  })

  /** The dark side, symmetrically. */
  test('a dark catalogue id pins the dark appearance', () => {
    const selection = resolveSelection({ theme: defaultDarkThemeId })
    expect(selection.appearance).toBe('dark')
    expect(selection.darkThemeId).toBe(defaultDarkThemeId)
  })

  /**
   * `globals=theme:dark` in a URL is not a catalogue id, and the interaction lane
   * passes exactly that. The bare aliases mean "the side, default variant".
   */
  test('the bare light/dark aliases resolve, because a caller writes them', () => {
    expect(resolveSelection({ theme: 'dark' })).toMatchObject({
      appearance: 'dark',
      darkThemeId: defaultDarkThemeId,
    })
    expect(resolveSelection({ theme: 'light' })).toMatchObject({
      appearance: 'light',
      lightThemeId: defaultLightThemeId,
    })
  })

  /**
   * When both globals are given and disagree, appearance wins: the two globals
   * must describe one document, and the toolbar always writes them as a pair —
   * so a disagreement can only come from a hand-written URL, where the explicit
   * side is the intent.
   */
  test('a conflicting appearance wins and the variant falls back', () => {
    const lightTheme = themesForAppearance('light')[0]!
    const selection = resolveSelection({ appearance: 'dark', theme: lightTheme.id })
    expect(selection.appearance).toBe('dark')
    expect(selection.darkThemeId).toBe(defaultDarkThemeId)
  })

  /** An unknown id degrades to the defaults rather than applying nothing. */
  test('an unknown theme id falls back to the workshop default', () => {
    const selection = resolveSelection({ theme: 'not-a-theme' })
    expect(selection.appearance).toBe(workshopDefaults.appearance)
    expect(selection.darkThemeId).toBe(defaultDarkThemeId)
  })

  /**
   * No globals at all is the state of every fresh load: the workshop opens on
   * its default side, with the accent that means "the variant's own primary".
   */
  test('no globals resolve to the workshop defaults', () => {
    const selection = resolveSelection({})
    expect(selection.appearance).toBe(workshopDefaults.appearance)
    expect(selection.accent).toBe('theme')
    expect(selection.font).toBe(workshopDefaults.font)
    expect(selection.density).toBe(workshopDefaults.density)
  })

  /**
   * The accent axis is validated against the library's own list, so a preset
   * cannot exist in the toolbar while the resolver rejects it — both read the
   * one source.
   */
  test('every accent preset survives a round trip through the resolver', () => {
    for (const preset of accentPresets) {
      expect(resolveSelection({ accent: preset.id }).accent).toBe(preset.id)
    }
    expect(resolveSelection({ accent: 'not-an-accent' }).accent).toBe('theme')
  })

  /**
   * Density has no toolbar control and is set through the URL, so the one value
   * that exists besides the default has to reach the selection unchanged.
   */
  test('the compact density rung passes through', () => {
    expect(resolveSelection({ density: 'compact' }).density).toBe('compact')
    expect(resolveSelection({ density: 'not-a-rung' }).density).toBe(workshopDefaults.density)
  })
})
