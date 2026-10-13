import {
  applyAppearanceFontSettings,
  normalizeAppearanceEditorFontSettings,
} from '#lib/appearance-font-settings'
import { terminalCssVariables } from '#lib/theme-css'
import type { ThemeEngine } from '#lib/theme-engine'
import type { EditorRolesMode, ThemeAppearance, ThemeVariant } from '#lib/themes'
import { isCustomAccent } from '#lib/accent-roles'
import { surfaceAlpha, type SurfaceState } from '#lib/theme-surface'
import { resolvedDensity, type ThemeSelection } from './theme-state-core'

/**
 * The document half of the theme provider: the single writer of `<html>`.
 *
 * Written against the few members of an element it uses, so the rules can be tested
 * on a stand-in and the provider's effect stays a one-line call.
 *
 * This is the engine-parameterised half: every question the catalogue answers goes
 * through the {@link ThemeEngine} it is given, so it imports no catalogue code or data.
 * `theme-document.ts` binds the full catalogue and keeps the signatures the eager
 * provider and the tests have always used.
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
  /**
   * The variant whose terminal palette is pinned over the interface variant's.
   * Absent, the terminal follows the interface theme.
   */
  terminalVariant?: ThemeVariant
  /**
   * The resolved surface axis. Absent, the axis is off: no attribute and no
   * `--surface-alpha` is written, and any this writer wrote before is removed.
   */
  surface?: SurfaceState
}

export type ThemeDocumentOptions = {
  /**
   * Rewrites the custom properties just before they are written: the variant's
   * roles with the accent laid over them. It sees every property of the pass and
   * must return the full map; a name it drops is not written.
   */
  transformTokens?: (tokens: Record<string, string>) => Record<string, string>
  /**
   * The contrast an accent is held to against the variant's background. Absent, a
   * preset is painted verbatim (the catalogue measured it for its own themes) and
   * only a custom `#rrggbb` is held to the default floor of 3:1.
   */
  accentContrastFloor?: number
  /**
   * Where a catalogue variant's palette comes from. `inline` (the default) writes
   * every role onto the root. `stylesheet` writes none for a catalogue variant,
   * because the host loads a stylesheet that carries a `[data-theme]` block for it;
   * a variant the catalogue does not hold (a host's imported theme) is still written
   * inline, since no stylesheet can know it. The accent, the terminal pin, the
   * surface alpha and the fonts are written the same in both.
   *
   * Switching from an imported variant back to a catalogue one removes what the
   * imported one wrote, so nothing inline outlives it to beat the stylesheet.
   */
  palette?: 'inline' | 'stylesheet'
  /**
   * The `--editor-*` projection. `syntax` (the default) is the catalogue's quiet
   * syntax roles, which is what `theme-variants.css` carries; `floor` holds every
   * editor role to 4.5:1 on the canvas, as hex.
   *
   * With `palette: 'stylesheet'`, `floor` is the one palette write a catalogue
   * variant still gets: the stylesheet is generated for the default projection, so
   * the sixteen `--editor-*` properties are written inline over it. The rest of the
   * palette stays in the stylesheet.
   */
  editorRoles?: EditorRolesMode
}

/**
 * What a catalogue variant still writes inline when its palette is the stylesheet's:
 * nothing, unless the editor projection is not the one the stylesheet was generated
 * for.
 */
function stylesheetOverrides(
  engine: ThemeEngine,
  variant: ThemeVariant,
  editorRoles: EditorRolesMode | undefined
): Record<string, string> {
  if (editorRoles !== 'floor') return {}
  return Object.fromEntries(
    Object.entries(engine.themeCssVariables(variant, { editor: 'floor' })).filter(([name]) =>
      name.startsWith('--editor-')
    )
  )
}

/**
 * The custom properties a state paints: the variant's roles, with the accent
 * selection laid over them, the pinned terminal palette over that, the surface
 * alpha, then `transformTokens`.
 *
 * The accent is applied *here* rather than left to the `[data-accent]` blocks in
 * `theme.css`, because the properties are written inline and an inline declaration
 * outranks every stylesheet selector however specific it is. The blocks still exist
 * and are still correct — they are what styles the window before this runs — but
 * they cannot win from here, so leaving the accent to them meant the attribute was
 * set, the rules were present, and nothing changed on screen.
 */
export function themeDocumentTokensWith(
  engine: ThemeEngine,
  state: ThemeDocumentState,
  options: ThemeDocumentOptions = {}
): { tokens: Record<string, string>; accented: boolean } {
  const fromStylesheet =
    options.palette === 'stylesheet' && engine.isCatalogueVariant(state.variant)
  const properties = fromStylesheet
    ? stylesheetOverrides(engine, state.variant, options.editorRoles)
    : { ...engine.themeCssVariables(state.variant, { editor: options.editorRoles }) }
  const accent = engine.accentVariables(state.selection.accent, state.appearance, state.selection, {
    background: state.variant.colors.background,
    floor: options.accentContrastFloor,
    variantId: state.variant.id,
  })
  if (accent) Object.assign(properties, accent)
  // Written after the variant and the accent, so it wins over the interface
  // variant's own terminal ramp (and over the stylesheet's, which it outranks as an
  // inline declaration). Dropping the pin needs no removal of its own: the ramp is
  // then rewritten by the variant, or swept back to the stylesheet.
  if (state.terminalVariant) Object.assign(properties, terminalCssVariables(state.terminalVariant))
  if (state.surface) properties['--surface-alpha'] = surfaceAlpha[state.surface.surface]
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
export function applyThemeToRootWith(
  engine: ThemeEngine,
  root: ThemeRoot,
  state: ThemeDocumentState,
  options: ThemeDocumentOptions = {},
  previous?: ReadonlySet<string>
): ReadonlySet<string> {
  const { tokens, accented } = themeDocumentTokensWith(engine, state, options)

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

  // A custom colour has no stylesheet block to select, and its value is the
  // attribute's worst possible content, so it is reported as `custom`.
  if (!accented) root.removeAttribute('data-accent')
  else
    root.dataset['accent'] = isCustomAccent(state.selection.accent)
      ? 'custom'
      : state.selection.accent

  // The surface axis is opt-in, so its absence removes rather than defaults: a host
  // that never enables it keeps an `<html>` with neither attribute, and one that
  // turns it off leaves nothing behind. (`--surface-alpha` is swept with the tokens.)
  if (state.surface) {
    root.dataset['surface'] = state.surface.surface
    root.dataset['reduceTransparency'] = state.surface.reduceTransparencyActive ? 'true' : 'false'
  } else {
    root.removeAttribute('data-surface')
    root.removeAttribute('data-reduce-transparency')
  }

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
