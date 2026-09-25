/**
 * The story catalogue, read from the build the lane is serving.
 *
 * Storybook writes `index.json` next to the built workshop, so enumerating
 * stories from it means this lane covers a new story automatically — a lane that
 * lists stories by hand stops covering the newest component and nobody notices.
 *
 * Tags are honoured: a story tagged `skip-a11y` is a deliberate, reviewed
 * exception. There are none today, and the mechanism exists so that adding one
 * is a visible change rather than a quiet filter here.
 */

export type StoryEntry = {
  id: string
  title: string
  name: string
  type: string
}

const BASE_URL = (process.env['STORYBOOK_URL'] ?? 'http://127.0.0.1:6106').replace(/\/$/, '')

export async function fetchStories(): Promise<StoryEntry[]> {
  const response = await fetch(`${BASE_URL}/index.json`)
  if (!response.ok) {
    throw new Error(`could not read the story index (${response.status}); is the workshop built?`)
  }

  const index = (await response.json()) as {
    entries?: Record<string, StoryEntry & { tags?: string[] }>
  }

  return Object.values(index.entries ?? {})
    .filter((entry) => entry.type === 'story')
    .filter((entry) => !(entry.tags ?? []).includes('skip-a11y'))
    .toSorted((a, b) => a.id.localeCompare(b.id))
}

/** The URL that renders one story on its own, without the manager chrome. */
export function storyUrl(id: string, theme: 'light' | 'dark'): string {
  return `${BASE_URL}/iframe.html?id=${encodeURIComponent(id)}&globals=theme:${theme};density:comfortable&viewMode=story`
}

/**
 * Open a story and wait for it to have actually mounted.
 *
 * `networkidle` is not enough: Storybook renders the story client-side after the
 * bundle loads, so a test that clicks immediately after navigating can race the
 * mount and fail intermittently against a story that is perfectly fine. That
 * flake is expensive to diagnose because it looks like a component defect.
 *
 * Waiting for the root to have content is the signal that matters, and Storybook
 * puts its own error block in the same place, so a story that throws fails here
 * with the error visible rather than timing out anonymously.
 */
export async function openStory(
  page: import('@playwright/test').Page,
  id: string,
  theme: 'light' | 'dark'
): Promise<void> {
  await page.goto(storyUrl(id, theme), { waitUntil: 'networkidle' })
  await page.locator('#storybook-root > *').first().waitFor({ state: 'visible', timeout: 10_000 })
}
