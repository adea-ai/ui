import { defaultDarkThemeId, themeById } from '@adea-ai/ui/lib/themes'

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

/**
 * The URL that renders one story on its own, without the manager chrome.
 *
 * `theme` is a catalogue variant id, not a light/dark flag: the lane checks real
 * themes, which is what a user would be looking at. `adea-dark` and `adea-light`
 * are the two the accessibility lane runs, because they are the defaults — a
 * catalogue variant only needs this treatment if it becomes one.
 */
export function storyUrl(id: string, theme: string): string {
  return `${BASE_URL}/iframe.html?id=${encodeURIComponent(id)}&globals=theme:${theme};density:comfortable&viewMode=story`
}

function resolvedStoryTheme(theme: string): { id: string; appearance: 'light' | 'dark' } {
  // Keep this fallback in lockstep with `.storybook/preview.tsx`: the addon accepts
  // the conventional `light`/`dark` aliases, while the provider resolves unknown
  // ids to the default dark variant before it writes the document authority.
  const variant = themeById(theme) ?? themeById(defaultDarkThemeId)!
  return { id: variant.id, appearance: variant.appearance }
}

/**
 * Wait for the browser-visible state that makes a story safe to inspect.
 *
 * DOMContentLoaded only means the preview shell exists. Storybook mounts the
 * component afterward, ThemeProvider applies its document authority in a Solid
 * effect, and the self-hosted typefaces settle independently. These waits keep
 * those signals explicit without treating unrelated network activity as a story
 * readiness contract.
 */
export async function waitForStoryReady(
  page: import('@playwright/test').Page,
  theme: string
): Promise<void> {
  const expected = resolvedStoryTheme(theme)

  await page.locator('#storybook-root > *').first().waitFor({ state: 'visible', timeout: 10_000 })

  await Promise.all([
    page.evaluate(() => document.fonts.ready),
    page.waitForFunction(
      ({ id, appearance }) => {
        const root = document.documentElement
        return (
          root.dataset['theme'] === id &&
          root.dataset['appearance'] === appearance &&
          root.classList.contains('dark') === (appearance === 'dark') &&
          root.style.colorScheme === appearance &&
          root.style.getPropertyValue('--background').trim().length > 0
        )
      },
      expected,
      { timeout: 10_000 }
    ),
  ])
}

async function waitForStoryRenderFinished(
  page: import('@playwright/test').Page,
  storyId: string
): Promise<void> {
  // Storybook's a11y addon reports from its `afterEach` render phase. Waiting
  // for the preview's own finished phase keeps the external AxeBuilder lane
  // from starting a second axe run while that report is still in flight.
  await page.waitForFunction(
    (id) => {
      const preview = Reflect.get(globalThis, '__STORYBOOK_PREVIEW__') as
        | { storyRenders?: Array<{ id: string; phase: string }> }
        | undefined
      return preview?.storyRenders?.some(
        (render) => render.id === id && render.phase === 'finished'
      )
    },
    storyId,
    { timeout: 10_000 }
  )
}

/**
 * Open a story and wait for it to have actually mounted.
 *
 * DOMContentLoaded is not enough: Storybook renders the story client-side after the
 * preview shell loads, so a test that clicks immediately after navigating can race
 * the mount and fail intermittently against a story that is perfectly fine. That
 * flake is expensive to diagnose because it looks like a component defect.
 *
 * Waiting for the root to have content is the first signal that matters, and
 * Storybook puts its own error block in the same place, so a story that throws
 * fails here with the error visible rather than timing out anonymously. The
 * render-phase wait also lets Storybook finish its async reporters before an
 * external assertion starts.
 */
export async function openStory(
  page: import('@playwright/test').Page,
  id: string,
  theme: string
): Promise<void> {
  await page.goto(storyUrl(id, theme), { waitUntil: 'domcontentloaded' })
  await waitForStoryReady(page, theme)
  await waitForStoryRenderFinished(page, id)
}
