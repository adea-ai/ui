import { addons } from 'storybook/manager-api'

import './manager-theme'
import './theme-toolbar'
import { managerTheme } from './manager-theme'
import { resolveSelection } from './appearance-globals'

const storybookTitle = 'Adea UI — Storybook'

if (typeof document !== 'undefined') {
  const setPageTitle = () => {
    if (document.title !== storybookTitle) document.title = storybookTitle
  }

  // Storybook derives the tab title from the active story, so keep the workshop brand visible.
  setPageTitle()
  new MutationObserver(setPageTitle).observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}

/**
 * The boot theme, read straight from the URL globals so the chrome is correct
 * on first paint — Storybook applies URL globals to the store before the
 * manager renders, and `ManagerThemeSync` (registered in manager-theme.ts)
 * keeps it live after that.
 */
const bootGlobals = Object.fromEntries(
  (new URLSearchParams(window.location.search).get('globals') ?? '')
    .split(';')
    .filter(Boolean)
    .map((pair) => pair.split(':'))
)
const bootSelection = resolveSelection(bootGlobals)

addons.setConfig({
  theme: managerTheme(
    bootSelection.appearance,
    bootSelection.appearance === 'dark' ? bootSelection.darkThemeId : bootSelection.lightThemeId,
    bootSelection.accent
  ),
})
