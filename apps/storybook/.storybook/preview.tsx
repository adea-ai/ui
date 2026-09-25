import {
  accentPresets,
  builtinThemes,
  defaultDarkThemeId,
  defaultLightThemeId,
  fontOptions,
  ThemeProvider,
  themeById,
  TooltipProvider,
} from '@adea-ai/ui'
import { withThemeByClassName } from '@storybook/addon-themes'
import { themeClasses } from './theme-classes'
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
 *      applications drive it. The toolbar toggles the real mechanism.
 *   3. The backdrop is a real app surface, so a component is never judged
 *      against a colour that does not exist in the product.
 *
 * The accessibility addon runs axe on every story. Its findings are part of a
 * component's definition of done, not advice: an unused colour is a preference,
 * an unlabelled control is a defect.
 */

// One Tailwind entry for the whole workshop. It imports the design system's own
// sheet and declares the source trees explicitly; see its header for why the
// explicit sources are required rather than merely tidy.
import '../styleguide/workshop.css'
import './preview.css'

/**
 * The accent axis, density, and the tooltip provider — the three things
 * `addon-themes` does not do.
 *
 * The accent is a *selection*, not a second theme: it sets `data-accent` on the
 * same element that carries `dark`, and the `[data-accent]` blocks in `theme.css`
 * override the interactive primary, its label, the hover rung, the tint and the
 * focus ring. That is exactly how both applications apply a user's accent choice,
 * so what the toolbar shows is what ships — including the polarity flip, where a
 * bright accent in dark mode carries a black label and its deep light-mode form
 * carries a white one.
 *
 * The preset list is read from the library rather than written out here, so the
 * workshop cannot offer an accent the package does not define.
 *
 * The theme itself is `withThemeByClassName`'s job. Writing that decorator by hand
 * was the first version of this file and it was a mistake: the hand-rolled version
 * toggled the class on the preview document only, so the docs pages kept
 * Storybook's own light chrome while the text took the dark theme's near-white —
 * a white sheet with white text. The addon exists because the docs container and
 * the preview are two documents, and it handles both.
 */
/**
 * The workshop runs on the library's own provider.
 *
 * Not a re-implementation of it: the theme control sets the same preference an
 * application sets, and `ThemeProvider` applies it the same way. That is what makes
 * the workshop a preview of the product rather than a picture of it, and it is why
 * a theme added to the catalogue appears in the toolbar with no change here.
 *
 * A variant declares its own appearance, so the picker pins the variant in the slot
 * that matches — the light/dark pair a user configures is still what an application
 * stores, but in the workshop there is one control rather than three.
 */
const withWorkshopTheme: Decorator = (Story, context) => {
  const themeId = (context.globals['theme'] as string | undefined) ?? defaultDarkThemeId
  const accent = (context.globals['accent'] as string | undefined) ?? 'theme'
  const font = (context.globals['font'] as string | undefined) ?? 'space-grotesk'
  const density = (context.globals['density'] as string | undefined) ?? 'comfortable'
  const variant = themeById(themeId) ?? themeById(defaultDarkThemeId)!

  document.documentElement.dataset['density'] = density

  return (
    <ThemeProvider
      storageKey="adea-workshop-appearance"
      initial={{
        appearance: variant.appearance,
        lightThemeId: variant.appearance === 'light' ? variant.id : defaultLightThemeId,
        darkThemeId: variant.appearance === 'dark' ? variant.id : defaultDarkThemeId,
        accent,
        font,
      }}
    >
      <TooltipProvider>{Story()}</TooltipProvider>
    </ThemeProvider>
  )
}

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      description:
        "Every theme in the library catalogue. The professional sets are other people's palettes, validated against the contrast floors rather than hand-checked.",
      defaultValue: defaultDarkThemeId,
      toolbar: {
        icon: 'mirror',
        items: builtinThemes.map((theme) => ({
          value: theme.id,
          title: `${theme.familyLabel} ${theme.label}`,
        })),
        showName: true,
        dynamicTitle: true,
      },
    },
    font: {
      name: 'Typeface',
      description:
        'The interface face. Space Grotesk is the default the language was drawn against.',
      defaultValue: 'space-grotesk',
      toolbar: {
        icon: 'type',
        items: fontOptions.map((option) => ({ value: option.id, title: option.label })),
        showName: true,
        dynamicTitle: true,
      },
    },
    accent: {
      name: 'Accent',
      description:
        "adea's accent presets. A selection, not a theme: it re-colours the primary, its label and the focus ring.",
      defaultValue: 'theme',
      toolbar: {
        icon: 'paintbrush',
        items: accentPresets.map((preset) => ({
          value: preset.id,
          title: preset.label,
        })),
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
  decorators: [
    withThemeByClassName({
      // Derived, and it must cover every id the `theme` global can hold — the
      // addon splits `themes[selected]` at render time and throws on a miss.
      // `theme-classes.ts` explains why, and the unit test pins it.
      themes: themeClasses,
      defaultTheme: defaultDarkThemeId,
      // The canvas is the app surface, so `color-scheme` follows the theme too —
      // scrollbars, form controls and the caret are painted by the engine.
      parentSelector: 'html',
    }),
    withWorkshopTheme,
  ],
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
      /**
       * The sidebar order.
       *
       * It has to match the real title tree, because a group that is not named here
       * falls to the end of its parent alphabetically and nothing says so — the
       * order just quietly stops applying. `Conversation` and `UI` were both absent
       * for a while, which put fifteen components after the primitives they belong
       * beside.
       *
       * The order is the reading order the **Overview** page describes: the rules,
       * then the tokens, then the window, then the components by purpose, then the
       * app-layer shapes.
       */
      storySort: {
        order: [
          'Overview',
          'Conventions',
          'Foundations',
          [
            'Colour',
            'Themes',
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
            'Resizable',
            'Scroll area',
          ],
          'Primitives',
          ['Actions', 'Forms', 'Overlays', 'Navigation', 'Data display', 'Feedback'],
          'Composites',
          ['Settings', 'List row', 'Stat', 'Account menu', 'Update Dialog', 'Workspace mark'],
          'Conversation',
          'UI',
          [
            'Board',
            'Detail Panel',
            'Status Chip',
            'Entity Icon',
            'Code Block',
            'Diff Block',
            'Calendar',
            'Carousel',
            'Chart',
            'Navigation Menu',
          ],
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
             * `packages/ui/tests/tokens.test.ts`, where every pairing the system
             * actually uses is measured against its measured surface. axe cannot
             * see the resolved `oklch()` values inside a `color-mix()` and reports
             * false positives on them.
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
