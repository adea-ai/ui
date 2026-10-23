import { describe, expect, test } from 'bun:test'
import { createRoot } from 'solid-js'
import { themeContext, useOptionalTheme, useTheme } from '../src/components/theme/theme-context'
import type { ThemeContextValue } from '../src/components/theme/theme-state'

describe('theme context', () => {
  test('outside a provider, the optional hook is undefined and the strict one throws', () => {
    createRoot((dispose) => {
      expect(useOptionalTheme()).toBeUndefined()
      expect(() => useTheme()).toThrow('inside a <ThemeProvider>')
      dispose()
    })
  })

  test('the context object lives on the global under a registered symbol', () => {
    const host = globalThis as Record<symbol, unknown>
    expect(host[Symbol.for('adea.ui.theme')]).toBe(themeContext())
    expect(themeContext()).toBe(themeContext())
  })

  test('a second copy of the module finds the first copy’s context', async () => {
    // What the symbol is for: two module records for one file (a dev graph, or two
    // copies of the package) must not each create a context of their own.
    const specifier = '../src/components/theme/theme-context.ts?second-copy'
    const copy = (await import(specifier)) as typeof import('../src/components/theme/theme-context')
    expect(copy.themeContext).not.toBe(themeContext)
    expect(copy.themeContext()).toBe(themeContext())

    const value = { marker: true } as unknown as ThemeContextValue
    createRoot((dispose) => {
      const Provider = themeContext().Provider
      // Provide through the first copy, read through the second.
      let seen: ThemeContextValue | undefined
      Provider({
        value,
        get children() {
          seen = copy.useOptionalTheme()
          // The strict hook reads the same shared context.
          expect(copy.useTheme()).toBe(value)
          return undefined
        },
      })
      expect(seen).toBe(value)
      dispose()
    })
  })
})
