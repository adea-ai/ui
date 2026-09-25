import { describe, expect, test } from 'bun:test'
import { builtinThemes } from '@adea-ai/ui/lib/themes'
import { themeClasses } from '../../.storybook/theme-classes'

/**
 * The workshop's preview configuration, as invariants.
 *
 * These are here rather than in a browser test because the failure they guard
 * against is a *configuration* failure: it does not depend on a rendering path, and
 * the fastest place to catch it is before the browser starts. The browser lane
 * still covers the result — it checks every story in two themes — but it can only
 * check the themes it is told to use, and this checks the ones it is not.
 */
describe('the workshop theme global', () => {
  /**
   * The crash this exists for.
   *
   * `withThemeByClassName` registers the `theme` global from `Object.keys(themes)`
   * and then, at render time, splits `themes[selected]` into classes. A map that
   * does not cover every id the global offers throws
   * `Cannot read properties of undefined (reading 'split')` — an error that names
   * neither the theme nor the file, and that only appears when someone picks the
   * missing entry.
   */
  test('every catalogue id has a class, so no selection can throw', () => {
    const missing = builtinThemes.filter((theme) => !(theme.id in themeClasses)).map((t) => t.id)
    expect(missing).toEqual([])
  })

  /** A theme with no class would be a variant the workshop cannot preview. */
  test('the map has no id the catalogue does not declare', () => {
    const ids = new Set(builtinThemes.map((theme) => theme.id))
    const extra = Object.keys(themeClasses).filter((id) => !ids.has(id))
    expect(extra).toEqual([])
  })

  /**
   * The value is the *appearance*, not the variant id: the addon's job is
   * Storybook's own two-state chrome, and a variant id would put a class on the
   * docs container that no stylesheet defines.
   */
  test('every class is an appearance, not a variant id', () => {
    for (const [id, value] of Object.entries(themeClasses)) {
      expect(value, `${id} maps to ${value}`).toMatch(/^(light|dark)$/)
    }
  })

  /**
   * Both polarities are represented, so the workshop can preview either. A
   * catalogue that only had dark themes would make the light theme unreviewable,
   * and this repository treats light as a peer rather than an inversion.
   */
  test('the catalogue covers both appearances', () => {
    const appearances = new Set(Object.values(themeClasses))
    expect(appearances.has('light')).toBe(true)
    expect(appearances.has('dark')).toBe(true)
  })
})
