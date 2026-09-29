import { ThemeProvider, TooltipProvider, type ThemeSelection } from '@adea-ai/ui'
import { createSignal } from 'solid-js'
import { createJSXDecorator, type Decorator, type Preview } from 'storybook-solidjs-vite'
import { resolveSelection, type WorkshopGlobals } from './appearance-globals'

/**
 * The workshop's global setup.
 *
 * Three things matter here, and each of them is the reason the workshop is
 * trustworthy as a review surface rather than a demo:
 *
 *   1. The real stylesheet is imported — the same `globals.css` a consumer
 *      imports. A workshop with its own copy of the tokens can look correct
 *      while the shipped package is broken.
 *   2. The theme is driven by the same `ThemeProvider` the applications drive,
 *      through its controlled `selection` prop. The toolbar edits Storybook
 *      globals; this file is the only place that translates them into the
 *      provider's vocabulary, and the document follows.
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
 * The bridge between Storybook's globals and the provider's reactive graph.
 *
 * The Solid renderer mounts a story once and, on a globals change, re-runs the
 * decorator chain *outside the mounted tree* and discards the JSX. A provider
 * that only read globals at mount — the first version of this file — could never
 * see a toolbar change again, and the theme selector was dead while looking
 * alive. So the selection travels over a module-level signal: the pass-through
 * decorator below re-runs on every pass and writes it, the JSX decorator reads
 * it inside the mounted tree, and Solid does the rest.
 */
const [toolbarSelection, setToolbarSelection] = createSignal<ThemeSelection>()

/**
 * Writes the globals on every render pass.
 *
 * Runs outside the JSX decorators, which the renderer skips once a story is
 * mounted — this one is the only place that is guaranteed to observe a globals
 * change after the first paint. It is also where Storybook's own two-state
 * chrome used to be handled by `addon-themes`; the provider writes the `dark`
 * class, `data-theme` and `color-scheme` on the same `<html>`, which covers the
 * canvas and the docs pages in one document, so the addon had nothing left to
 * do and its all-themes toolbar switcher only duplicated the one below.
 */
const withWorkshopGlobals: Decorator = (Story, context) => {
  setToolbarSelection(resolveSelection(context.globals as WorkshopGlobals))
  return Story()
}

/**
 * The provider itself, mounted once per story.
 *
 * The accent is a *selection*, not a second theme: it sets `data-accent` on the
 * same element that carries `dark`, and the provider applies it the way both
 * applications do — including the polarity flip, where a bright accent in dark
 * mode carries a black label and its deep light-mode form carries a white one.
 *
 * `initial` seeds the very first paint from the same globals, so a story opened
 * with `globals=theme:adea-light` never flashes the dark default. After that the
 * controlled `selection` prop is authoritative and nothing here re-renders the
 * story on a change — the provider rewrites the document in place.
 *
 * `Story()` is called *here*, in the decorator body, and not inside the JSX:
 * a call written as `{Story()}` compiles to a reactive children memo, and the
 * memo's dependencies include the toolbar signal the other decorator writes.
 * On a theme change the memo re-runs, and the renderer's story wrapper answers
 * `null` on any pass after the first — its contract is "already mounted, skip" —
 * so Solid receives `null` where children used to be and `cleanChildren` wipes
 * the canvas. Every later pass then no-ops into the empty container, which is
 * the blank preview that never reloads. A static child node cannot re-run, and
 * the provider keeps observing the selection through its prop getter.
 */
const withWorkshopTheme: Decorator = createJSXDecorator((Story, context) => {
  const initial = resolveSelection(context.globals as WorkshopGlobals)
  const story = Story()
  return (
    <ThemeProvider
      storageKey="adea-workshop-appearance"
      initial={initial}
      selection={toolbarSelection()}
    >
      <TooltipProvider>{story}</TooltipProvider>
    </ThemeProvider>
  )
})

const preview: Preview = {
  /**
   * Declared so the vocabulary is written down somewhere a reader will find it,
   * not because Storybook renders these — the globalTypes toolbar went away with
   * the addon that rendered them. The four the toolbar drives are listed in
   * `theme-toolbar.tsx`; `density` has no toolbar control and is set through the
   * URL (`globals=density:compact`).
   *
   * Deliberately no `defaultValue`s. Storybook materializes a declared default
   * into every story's globals, which would make `globals=theme:adea-light`
   * arrive as `{appearance: 'dark', theme: 'adea-light'}` — a defaulted
   * appearance overriding the theme the URL did name. Defaults live in one
   * place, `appearance-globals.ts`, which sees a missing key as "unset".
   */
  globalTypes: {
    appearance: {
      name: 'Appearance',
      description: 'Light or dark. The workshop pins polarity; the toolbar owns this value.',
    },
    theme: {
      name: 'Theme',
      description:
        'A catalogue variant id, or the bare light/dark aliases the test lanes write. Every theme in the library is accepted; the resolver in appearance-globals.ts pins it to the matching side.',
    },
    accent: {
      name: 'Accent',
      description:
        "adea's accent presets. `theme` is the default — the variant's own primary — and each named preset re-colours the interactive roles on top of whichever theme is active.",
    },
    font: {
      name: 'Typeface',
      description:
        'The interface face. Space Grotesk is the default the language was drawn against.',
    },
    density: {
      name: 'Density',
      description:
        'The compact rung moves the control ladder one step tighter, so a control keeps its place in the ladder rather than becoming a different control.',
    },
  },
  decorators: [withWorkshopGlobals, withWorkshopTheme],
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
