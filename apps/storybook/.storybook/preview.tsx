import type { Decorator, Preview } from 'storybook-solidjs-vite'

/**
 * The workshop's global setup.
 *
 * Three things matter here, and each of them is the reason the workshop is
 * trustworthy as a review surface rather than a demo:
 *
 *   1. The real stylesheet is imported — the same `globals.css` a consumer
 *      imports. A workshop with its own copy of the tokens can look correct
 *      while the shipped package is broken.
 *   2. The theme is driven by a class on `<html>`, which is exactly how both
 *      applications drive it. What the toolbar toggles is the real mechanism,
 *      not an approximation of it.
 *   3. The backdrop is a real app surface, so a component is never judged
 *      against a colour that does not exist in the product.
 *
 * The tooltip provider is mounted here for the same reason an application mounts
 * it at its root: tooltip timing is a property of the app, not of one story, and a
 * per-story provider would let two stories disagree about how fast a tooltip
 * opens.
 *
 * The accessibility addon runs axe on every story. Its findings are part of the
 * component's definition of done, not advice: an unused colour is a preference,
 * an unlabelled control is a defect.
 */

import { TooltipProvider } from '@adea-ai/ui'

// One Tailwind entry for the whole workshop. It imports the design system's own
// sheet and declares the source trees explicitly; see its header for why the
// explicit sources are required rather than merely tidy.
import '../styleguide/workshop.css'
import './preview.css'

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals['theme'] as string | undefined) ?? 'dark'
  const density = (context.globals['density'] as string | undefined) ?? 'comfortable'

  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset['density'] = density
  // The canvas is the app surface, so a component is reviewed on the surface it
  // will actually sit on rather than on the neutral Storybook default.
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'

  return <TooltipProvider>{Story()}</TooltipProvider>
}

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'The design system ships dark-first, with a light theme as an equal.',
      defaultValue: 'dark',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'dark', icon: 'moon', title: 'Dark' },
          { value: 'light', icon: 'sun', title: 'Light' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    density: {
      name: 'Density',
      description: 'The compact rung tightens row and control heights.',
      defaultValue: 'comfortable',
      toolbar: {
        icon: 'component',
        items: [
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'compact', title: 'Compact' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      expanded: true,
    },
    options: {
      storySort: {
        order: [
          'Overview',
          'Conventions',
          'Foundations',
          [
            'Colour',
            'Typography',
            'Spacing and density',
            'Radius and elevation',
            'Motion',
            'Iconography',
          ],
          'Layout',
          [
            'App shell',
            'Side rail',
            'Sidebar navigation',
            'Top bar',
            'Status bar',
            'Panel',
            'Page',
          ],
          'Primitives',
          ['Actions', 'Forms', 'Overlays', 'Navigation', 'Data display', 'Feedback'],
          'Composites',
        ],
      },
    },
    a11y: {
      /**
       * `error` rather than `todo`: a violation fails the story. The Playwright
       * lane in `tests/a11y.spec.ts` enforces the same bar headlessly in CI, so
       * this setting is for the reviewer who is looking at the panel.
       */
      test: 'error',
      config: {
        rules: [
          {
            /**
             * Colour contrast is checked by the token audit in
             * `packages/ui/tests/tokens.test.ts`, where every pairing the
             * system actually uses is measured against its measured surface.
             * axe cannot see the resolved `oklch()` values inside a
             * `color-mix()` and reports false positives on them.
             */
            id: 'color-contrast',
            enabled: false,
          },
        ],
      },
    },
    docs: {
      codePanel: true,
    },
  },
  tags: ['autodocs'],
}

export default preview
