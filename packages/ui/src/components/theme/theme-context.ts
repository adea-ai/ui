import { createContext, useContext, type Context } from 'solid-js'
import type { ThemeContextValue } from './theme-state'

/**
 * Where the context object lives: on the global, under a registered symbol.
 *
 * A context is an object identity, and a bundle can legitimately load this module
 * twice — a dev graph where a relative import and a package subpath are distinct
 * module records, or two copies of the package at different versions. Each copy
 * would then call `createContext` and own its own object; a provider from one and a
 * `useOptionalTheme()` from the other would never meet, and the second would return
 * `undefined` as though no provider were mounted. `Symbol.for` is shared across
 * every copy in a realm, so they all find the one context the first created.
 *
 * Both copies must agree on its shape. The context value only ever grows, which is
 * why a newer provider under an older reader is safe and the reverse is a missing
 * member, not a mismatch.
 */
const CONTEXT_KEY = Symbol.for('adea.ui.theme')

type ContextHost = { [CONTEXT_KEY]?: Context<ThemeContextValue | undefined> }

export function themeContext(): Context<ThemeContextValue | undefined> {
  const host = globalThis as ContextHost
  return (host[CONTEXT_KEY] ??= createContext<ThemeContextValue>())
}

export function useTheme(): ThemeContextValue {
  const value = useContext(themeContext())
  if (!value) throw new Error('useTheme must be called inside a <ThemeProvider>.')
  return value
}

/**
 * The theme context, or `undefined` outside a `ThemeProvider`.
 *
 * For a component that can run both ways — a shared control rendered in a harness,
 * a story, or a host that has not mounted a provider — and would rather degrade
 * than throw.
 */
export function useOptionalTheme(): ThemeContextValue | undefined {
  return useContext(themeContext())
}
