import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming'

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

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Adea UI — Storybook',
  }),
})
