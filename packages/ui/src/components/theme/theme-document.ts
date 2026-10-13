import {
  applyAppearanceFontSettings,
  normalizeAppearanceEditorFontSettings,
} from '#lib/appearance-font-settings'
import {
  accentVariables,
  themeCssVariables,
  type ThemeAppearance,
  type ThemeVariant,
} from '#lib/themes'
import { resolvedDensity, type ThemeSelection } from './theme-state'

/**
 * The document half of the theme provider: the single writer of `<html>`.
 *
 * Written against the few members of an element it uses, so the rules can be tested
 * on a stand-in and the provider's effect stays a one-line call.
 */
export type ThemeRoot = Pick<
  HTMLElement,
  'classList' | 'dataset' | 'style' | 'removeAttribute' | 'setAttribute'
>

export type ThemeDocumentState = {
  /** What the document shows: the committed selection, or a preview laid over it. */
  selection: ThemeSelection
  appearance: ThemeAppearance
  variant: ThemeVariant
}

export type ThemeDocumentOptions = {
  /**
   * Rewrites the custom properties just before they are written: the variant's
   * roles with the accent laid over them. It sees every property of the pass and
   * must return the full map; a name it drops is not written.
   */
  transformTokens?: (tokens: Record<string, string>) => Record<string, string>
}

/**
 * The custom properties a state paints: the variant's roles, with the accent
 * selection laid over them, then `transformTokens`.
 *
 * The accent is applied *here* rather than left to the `[data-accent]` blocks in
 * `theme.css`, because the properties are written inline and an inline declaration
 * outranks every stylesheet selector however specific it is. The blocks still exist
 * and are still correct — they are what styles the window before this runs — but
 * they cannot win from here, so leaving the accent to them meant the attribute was
 * set, the rules were present, and nothing changed on screen.
 */
export function themeDocumentTokens(
  state: ThemeDocumentState,
  options: ThemeDocumentOptions = {}
): { tokens: Record<string, string>; accented: boolean } {
  const properties = { ...themeCssVariables(state.variant) }
  const accent = accentVariables(state.selection.accent, state.appearance, state.selection)
  if (accent) Object.assign(properties, accent)
  return {
    tokens: options.transformTokens ? options.transformTokens(properties) : properties,
    accented: accent !== undefined,
  }
}

/**
 * Write a state onto a root and report which custom properties it owns.
 *
 * Pass the previous call's return as `previous` and any palette property that pass
 * wrote and this one does not is removed. For the catalogue the two sets are the
 * same, so nothing is ever removed; it matters for a host variant that carries
 * `tokens` the catalogue does not, which would otherwise stay inline, beating the
 * stylesheet, after the user switched away from it.
 */
export function applyThemeToRoot(
  root: ThemeRoot,
  state: ThemeDocumentState,
  options: ThemeDocumentOptions = {},
  previous?: ReadonlySet<string>
): ReadonlySet<string> {
  const { tokens, accented } = themeDocumentTokens(state, options)

  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value)
  }
  if (previous) {
    for (const name of previous) {
      if (!(name in tokens)) root.style.removeProperty(name)
    }
  }

  root.classList.toggle('dark', state.appearance === 'dark')
  root.dataset['theme'] = state.variant.id
  root.dataset['appearance'] = state.appearance
  root.style.colorScheme = state.appearance

  if (!accented) root.removeAttribute('data-accent')
  else root.dataset['accent'] = state.selection.accent

  applyAppearanceFontSettings(
    root,
    normalizeAppearanceEditorFontSettings(state.selection.fonts, state.selection.font).settings
  )

  // Density is a pure token shift, so unlike the colour axes there is nothing to
  // compute: the attribute selects a block in `theme.css`. It is applied here for
  // the same reason as the others — this is the one place that knows what the
  // current selection is, and it is the only writer of these attributes.
  if (resolvedDensity(state.selection) === 'comfortable') root.removeAttribute('data-density')
  else root.dataset['density'] = resolvedDensity(state.selection)

  return new Set(Object.keys(tokens))
}

/** What {@link applyWithoutTransitions} needs of a document. */
export type TransitionDocument = {
  head: { appendChild(node: unknown): unknown }
  createElement(tag: 'style'): {
    textContent: string | null
    offsetHeight?: number
    remove(): void
  }
}

/**
 * Run `apply` with every CSS transition switched off for the frame that carries
 * it, so a theme switch cannot animate page-wide.
 *
 * Without this, flipping the custom properties on `<html>` starts a transition on
 * every element that declares one, and each fades from the old palette to the new
 * over its own duration: a theme change that looks like a rendering fault. The
 * rule is removed two frames later, after the browser has committed the new styles
 * with transitions off, and `restore` runs it early (the provider calls it when it
 * is disposed mid-switch).
 *
 * `schedule` is the frame source; it defaults to `requestAnimationFrame` and falls
 * back to running at once where there is none, which leaves transitions on rather
 * than off.
 */
export function applyWithoutTransitions(
  doc: TransitionDocument,
  apply: () => void,
  schedule: (callback: () => void) => void = defaultSchedule
): () => void {
  const style = doc.createElement('style')
  style.textContent = '*{transition:none !important}'
  doc.head.appendChild(style)
  // Reading a layout property forces the browser to commit the rule before the
  // properties change; without it the two can be batched into one style recalc.
  void style.offsetHeight
  let removed = false
  const restore = () => {
    if (removed) return
    removed = true
    style.remove()
  }
  try {
    apply()
  } catch (error) {
    restore()
    throw error
  }
  schedule(() => schedule(restore))
  return restore
}

function defaultSchedule(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback)
  else callback()
}
