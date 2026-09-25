/**
 * A minimal reader for the token file, shared by the token test and by the
 * workshop's galleries.
 *
 * Deliberately not a CSS parser. It tracks one piece of context — whether the
 * cursor is inside an `@theme` block — because `@theme inline` contains
 * `--name: var(--name)` mappings rather than token declarations, and counting
 * those as tokens would make the completeness check compare a list against
 * itself and pass no matter what.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const THEME_CSS_PATH = join(import.meta.dir, '../../src/styles/theme.css')

export const THEME_CSS = readFileSync(THEME_CSS_PATH, 'utf8')

type Scope = 'root' | 'dark'

function readDeclarations(css: string): { name: string; value: string; scope: Scope }[] {
  const declarations: { name: string; value: string; scope: Scope }[] = []
  // Strip comments so a commented-out token is not counted as declared.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')

  // Nested at-rule depth while *outside* a `:root`/`.dark` block, so that a
  // `@media`-wrapped rule is not mistaken for a theme block.
  let atDepth = 0
  let themeDepth = 0
  let scope: Scope | null = null
  let index = 0

  while (index < source.length) {
    const rest = source.slice(index)
    const leading = /^\s+/.exec(rest)?.[0] ?? ''
    index += leading.length
    const token = source.slice(index)

    if (token === '') break

    if (token[0] === '}') {
      if (scope) {
        scope = null
      } else if (themeDepth > 0) {
        themeDepth -= 1
      } else if (atDepth > 0) {
        atDepth -= 1
      }
      index += 1
      continue
    }

    const atRule = /^@[a-z-]+[^{;]*[,)]?\s*\{/.exec(token) ?? /^@[a-z-]+[^;{]*;/.exec(token)
    if (atRule) {
      const opened = atRule[0].endsWith('{')
      if (atRule[0].startsWith('@theme')) {
        if (opened) themeDepth += 1
      } else if (opened) {
        atDepth += 1
      }
      index += atRule[0].length
      continue
    }

    const selector = /^([^{};]+)\{/.exec(token)
    if (selector && atDepth === 0 && themeDepth === 0 && scope === null) {
      const text = selector[1]?.trim() ?? ''
      if (/^:root$/.test(text)) scope = 'root'
      else if (/^\.dark$/.test(text)) scope = 'dark'
      index += selector[0].length
      continue
    }

    const declaration = /^--([a-zA-Z0-9-]+)\s*:\s*([^;}]+);?/.exec(token)
    if (declaration && scope) {
      declarations.push({
        name: declaration[1] ?? '',
        value: (declaration[2] ?? '').trim(),
        scope,
      })
      index += declaration[0].length
      continue
    }

    index += 1
  }

  return declarations
}

export const declarations = readDeclarations(THEME_CSS)
export const declaredNames = new Set(declarations.map((d) => d.name))

/**
 * Resolve a token's value in a theme, following `var()` indirection and falling
 * back to the light root block.
 *
 * The indirection matters: `--sidebar-muted-foreground` is declared as
 * `var(--muted-foreground)`, and a contrast check that could not see through
 * that would either skip the pairing or read the alias as a missing token.
 */
export function valueOf(name: string, scope: Scope, depth = 0): string | undefined {
  const own = declarations.find((d) => d.name === name && d.scope === scope)
  const fallback = declarations.find((d) => d.name === name && d.scope === 'root')
  const raw = own?.value ?? fallback?.value
  if (raw === undefined) return undefined

  const alias = /^var\(\s*--([a-zA-Z0-9-]+)/.exec(raw)
  if (alias && depth < 4) {
    // Resolve the alias in the scope that declared it, so a dark-theme alias
    // reads the dark value rather than the light one.
    const aliasScope = own ? scope : 'root'
    return valueOf(alias[1] ?? '', aliasScope, depth + 1)
  }

  return raw
}

export type { Scope }
