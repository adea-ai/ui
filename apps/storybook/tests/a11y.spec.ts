import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { fetchStories, openStory } from './stories'

/**
 * Accessibility: every story, in every theme the lane can afford.
 *
 * This is the lane that makes "accessible" a property of the repository rather
 * than an intention. A violation fails the story it appears in, and the failure
 * names the rule, the element and the fix — which is what makes it actionable
 * rather than merely blocking.
 *
 * Themes are checked because the system is not symmetric: the accent is bright in
 * dark and deep in light, and a pairing that clears a floor in one can fail in the
 * other. Colour contrast is measured by the numeric suites instead of by axe,
 * because axe cannot resolve a value inside `color-mix()` and would report false
 * positives on the status tints.
 *
 * The rules below are the ones axe can judge here. They are run explicitly rather
 * than as a preset so that the lane's coverage is readable from the source.
 */

const stories = await fetchStories()

/**
 * The two default variants, swept over every story.
 *
 * A catalogue theme earns a place here when it becomes a default — these are the
 * themes a user sees without choosing, so every component is measured in them.
 */
const THEMES = ['adea-dark', 'adea-light'] as const

/**
 * The imports, sampled — every story in each, but only a few themes.
 *
 * Running the full catalogue over the full story set would multiply this lane by
 * twenty-seven for a signal that does not scale with it: a contrast floor is
 * already measured numerically for every theme in `@adea-ai/themes`, so what axe
 * adds here is *rendering* failures — a component that reads a role the bridge
 * failed to map, an overlay that lands invisible against a particular canvas.
 *
 * So the sample is chosen adversarially rather than evenly. It takes the extremes:
 * the palette with the faintest colours in the catalogue (Everforest Light, whose
 * own comment grey is 1.9:1 on its canvas), the palette most likely to break a
 * focus ring (Vesper, which is near-black with a single amber accent), the two
 * whose status colours had to be deepened the most (Ayu Light, Gruvbox Light), and
 * one representative mid-catalogue dark theme. A theme that passes here is not
 * proven correct, but a bridge defect has nowhere to hide.
 */
const SAMPLED_THEMES = [
  'everforest-light',
  'ayu-light',
  'gruvbox-light',
  'vesper',
  'tokyonight-night',
] as const

test.describe.configure({ mode: 'parallel' })

test.describe('storybook accessibility', () => {
  test('the catalogue is not empty', () => {
    // A lane that silently covers nothing is worse than no lane: it reports
    // green while checking zero stories.
    expect(stories.length).toBeGreaterThan(40)
  })
  test('the theme sample is not empty', () => {
    expect(SAMPLED_THEMES.length).toBeGreaterThan(0)
  })

  for (const theme of [...THEMES, ...SAMPLED_THEMES]) {
    test.describe(`${theme} theme`, () => {
      for (const story of stories) {
        test(`${story.title} › ${story.name}`, async ({ page }) => {
          // Waits for the story to mount, and fails visibly if it threw.
          await openStory(page, story.id, theme)

          /*
           * WCAG rules only, deliberately.
           *
           * `best-practice` adds three rules that assert properties of a *page* —
           * one `main` landmark, one `h1`, all content inside a landmark. A
           * Storybook iframe renders one component with no page chrome, so those
           * rules fire on every story and say nothing about the component. The
           * document structure is the consuming application's, and it is asserted
           * where it can be: the interaction lane checks that the full shell
           * provides `main` and `contentinfo` landmarks.
           *
           * Everything a component *can* get wrong — names, roles, ARIA
           * relationships, focus order, keyboard access to a scroll region — is a
           * WCAG rule and stays on.
           */
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .disableRules(['color-contrast'])
            .analyze()

          const summary = results.violations
            .map((violation) => {
              const targets = violation.nodes
                .slice(0, 3)
                .map((node) => `      ${node.target.join(' ')}`)
                .join('\n')
              return `  ${violation.id}: ${violation.help}\n${targets}`
            })
            .join('\n')

          expect(
            results.violations,
            `Accessibility violations in ${story.title} › ${story.name} (${theme}):\n${summary}`
          ).toEqual([])
        })
      }
    })
  }
})
