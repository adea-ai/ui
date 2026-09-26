import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { fetchStories, openStory } from './stories'

const story = (await fetchStories()).find(
  (entry) => entry.title.endsWith('/Button') && entry.name === 'Default'
)
if (!story) throw new Error('Missing actual Button default story for Axe ownership proof')

for (const theme of ['adea-dark', 'adea-light']) {
  test(`one automated Axe pass preserves accessibility enforcement in ${theme}`, async ({
    page,
  }) => {
    const measures: Record<string, number> = {}
    for (const owner of [undefined, 'playwright'] as const) {
      const start = performance.now()
      const finished = await openStory(page, story.id, theme, { a11yOwner: owner })
      const addonReports = finished.reporters.filter((reporter) => reporter.type === 'a11y')
      if (owner) expect(addonReports).toHaveLength(0)
      else expect(addonReports).toHaveLength(1)
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze()
      expect(result.violations).toEqual([])
      measures[owner ?? 'addon-and-playwright'] = Math.round(performance.now() - start)
    }
    console.log(JSON.stringify({ theme, navigationAndAnalysisMs: measures }))
    // The owned sweep must still catch real bad markup, not only a good story.
    await page.evaluate(() => {
      const button = document.createElement('button')
      document.querySelector('#storybook-root')?.append(button)
    })
    const invalid = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze()
    expect(invalid.violations.some((violation) => violation.id === 'button-name')).toBe(true)
  })
}
