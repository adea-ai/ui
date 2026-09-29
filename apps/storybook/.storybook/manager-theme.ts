import { useEffect } from 'react'
import { addons, types, useGlobals } from 'storybook/manager-api'
import { create } from 'storybook/theming'
import { oklchToHex, parseColor } from '@adea-ai/themes/oklch'
import { accentVariables, themeById, type ThemeAppearance } from '@adea-ai/ui/lib/themes'
import { resolveSelection } from './appearance-globals'

const THEME_SYNC_ID = 'workshop/theme-sync'

/**
 * The catalogue speaks oklch; Storybook's theme converter speaks polished, whose
 * colour math throws on anything but hex/rgb/hsl. Every value that crosses this
 * boundary goes through the catalogue's own converter.
 */
const srgb = (value: string): string => {
  const parsed = parseColor(value)
  return parsed ? oklchToHex(parsed) : value
}

/**
 * The manager's palette, built from the selection the toolbar drives.
 *
 * The sidebar, the top bar and the addon panels are Storybook's own chrome, and
 * without this they keep the static light theme from `manager.ts` no matter what
 * the canvas is doing — which is how a dark workshop ended up with a white
 * sidebar. Every colour here is one of the variant's own roles, so the chrome
 * follows the same selection the components do, accent included: an accent
 * preset overrides the interactive roles, and `accentVariables` is the same
 * function the provider applies to the document.
 */
export function managerTheme(appearance: ThemeAppearance, themeId: string, accent: string) {
  const c = themeById(themeId)?.colors
  const accentPrimary = accentVariables(accent, appearance)
  const primary = accentPrimary?.['--primary'] ?? c?.primary
  const primaryForeground = accentPrimary?.['--primary-foreground'] ?? c?.primaryForeground
  return create({
    base: appearance,
    brandTitle: 'Adea UI — Storybook',
    ...(c && {
      colorPrimary: srgb(primary!),
      // Not a surface rung: the toolbar's interactive controls take their text
      // from here, so it has to read against the bar.
      colorSecondary: srgb(primary!),
      appBg: srgb(c.background),
      appContentBg: srgb(c.card),
      appHoverBg: srgb(c.accent),
      appPreviewBg: srgb(c.background),
      appBorderColor: srgb(c.border),
      textColor: srgb(c.foreground),
      textMutedColor: srgb(c.mutedForeground),
      textInverseColor: srgb(primaryForeground!),
      barBg: srgb(c.card),
      barTextColor: srgb(c.foreground),
      barHoverColor: srgb(c.accent),
      barSelectedColor: srgb(primary!),
      buttonBg: srgb(c.background),
      buttonBorder: srgb(c.border),
      booleanBg: srgb(c.background),
      booleanSelectedBg: srgb(primary!),
      inputBg: srgb(c.background),
      inputBorder: srgb(c.border),
      inputTextColor: srgb(c.foreground),
    }),
  })
}

/**
 * Re-applies the manager theme whenever the globals change.
 *
 * `addons.setConfig` is live — the manager re-renders on each call — so a tool
 * that renders nothing is enough to carry it: it exists to observe globals, and
 * it runs everywhere the toolbar does.
 */
const ManagerThemeSync = () => {
  const [globals] = useGlobals()
  const selection = resolveSelection(globals as Parameters<typeof resolveSelection>[0])
  const appearance = selection.appearance
  const themeId = appearance === 'dark' ? selection.darkThemeId : selection.lightThemeId
  useEffect(() => {
    addons.setConfig({ theme: managerTheme(appearance, themeId, selection.accent) })
  }, [appearance, themeId, selection.accent])
  return null
}

addons.register(THEME_SYNC_ID, () => {
  addons.add(`${THEME_SYNC_ID}/tool`, {
    title: 'Manager theme sync',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => !!(viewMode && viewMode.match(/^(story|docs)$/)) && !tabId,
    render: ManagerThemeSync,
  })
})
