/**
 * Which modifier a chord should advertise.
 *
 * Every global chord in the product binds `(metaKey || ctrlKey)`, so the
 * working key is the platform's command modifier wherever the app runs — but
 * Apple platforms draw it as ⌘ and everyone else spells it Ctrl. A chord
 * label drawn from anything else (a hardcoded ⌘, say) advertises a key that
 * does not work as drawn on Windows and Linux.
 *
 * These helpers are the one place that decides the glyph, so every surface
 * that draws or announces a shortcut — rail rows, menus, a pane's search
 * field — draws the same one. They sit next to the `Kbd` caps because the
 * glyph is a property of the drawing, not of the feature that shows it: a
 * spelled-out `Ctrl` needs one cap per word (a `KbdGroup`), while `⌘K` can
 * ride `KbdChord`'s one-cap-per-character split.
 */

/** The modifier glyph the running OS renders for Meta: ⌘ on Apple platforms, Ctrl elsewhere. */
export function platformModifierKey(platform?: string): '⌘' | 'Ctrl' {
  // The guard keeps server renders honest: no navigator means no Apple
  // platform string, so they fall back to the spelled-out modifier.
  const browserPlatform = platform ?? (typeof navigator === 'undefined' ? '' : navigator.platform)
  return /Mac|iPhone|iPad|iPod/i.test(browserPlatform) ? '⌘' : 'Ctrl'
}

/** The workspace search chord label as the rail's hover text draws it: the
 *  platform modifier plus K (`⌘K`, or `Ctrl+K` where ⌘ does not exist). */
export function searchShortcutLabel(platform?: string): string {
  return platformModifierKey(platform) === '⌘' ? '⌘K' : 'Ctrl+K'
}

/**
 * The `aria-keyshortcuts` for the search chord. The binding accepts Meta and
 * Ctrl alike, so the announced shortcuts name both: a hardcoded `Meta+K`
 * would promise a key the row does not keep on non-Apple platforms.
 */
export const searchShortcutKeyshortcuts = 'Meta+K Control+K'
