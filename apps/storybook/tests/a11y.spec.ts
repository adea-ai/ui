import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { fetchStories, openStory } from './stories'

/**
 * Accessibility: every story, in both themes.
 *
 * This is the lane that makes "accessible" a property of the repository rather
 * than an intention. A violation fails the story it appears in, and the failure
 * names the rule, the element and the fix — which is what makes it actionable
 * rather than merely blocking.
 *
 * Both themes are checked because the system is not symmetric: the accent is
 * bright in dark and deep in light, and a pairing that clears a floor in one can
 * fail in the other. Colour contrast is measured by the numeric token suite in
 * `packages/ui/tests/tokens.test.ts` instead of by axe, because axe cannot
 * resolve a value inside `color-mix()` and would report false positives on the
 * status tints.
 *
 * The rules below are the ones axe can judge here. They are run explicitly rather
 * than as a preset so that the lane's coverage is readable from the source.
 */

const stories = await fetchStories()

const THEMES = ['dark', 'light'] as const

test.describe.configure({ mode: 'parallel' })

test.describe('storybook accessibility', () => {
  test('the catalogue is not empty', () => {
    // A lane that silently covers nothing is worse than no lane: it reports
    // green while checking zero stories.
    expect(stories.length).toBeGreaterThan(40)
  })

  for (const theme of THEMES) {
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
