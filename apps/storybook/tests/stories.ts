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

export type OpenStoryOptions = {
  baseUrl?: string
}

type StoryFinishedResult = {
  storyId: string
  status: string
  reporters: Array<{
    type?: string
    status?: string
    error?: string
  }>
}

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
export function storyUrl(id: string, theme: string, baseUrl = BASE_URL): string {
  return `${baseUrl}/iframe.html?id=${encodeURIComponent(id)}&globals=theme:${theme};density:comfortable&viewMode=story`
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

async function installStoryFinishedListener(
  page: import('@playwright/test').Page,
  storyId: string
): Promise<void> {
  // Storybook creates its preview addon store during page bootstrap. Install the
  // channel hook before navigation so a fast story cannot emit STORY_FINISHED
  // before the test starts waiting for it.
  await page.addInitScript(
    ({ id }) => {
      const stateKey = '__ADEA_STORYBOOK_READINESS__'
      const addonStoreKey = '__STORYBOOK_ADDONS_PREVIEW'
      const state = { storyId: id, finished: null as unknown, channel: null as unknown }
      const wrappedStores = new WeakSet<object>()

      const attachChannel = (channel: unknown) => {
        if (
          !channel ||
          typeof channel !== 'object' ||
          typeof Reflect.get(channel, 'on') !== 'function' ||
          state.channel === channel
        ) {
          return
        }
        state.channel = channel
        Reflect.get(channel, 'on').call(channel, 'storyFinished', (result: unknown) => {
          if (result && typeof result === 'object' && Reflect.get(result, 'storyId') === id) {
            state.finished = result
          }
        })
      }

      const wrapStore = (store: unknown) => {
        if (!store || typeof store !== 'object' || wrappedStores.has(store)) return
        const setChannel = Reflect.get(store, 'setChannel')
        if (typeof setChannel !== 'function') return
        wrappedStores.add(store)
        Reflect.set(store, 'setChannel', function (channel: unknown) {
          const result = setChannel.call(this, channel)
          attachChannel(channel)
          return result
        })
        attachChannel(Reflect.get(store, 'channel'))
      }

      Object.defineProperty(globalThis, stateKey, {
        configurable: true,
        value: state,
        writable: true,
      })

      let addonStore: unknown
      Object.defineProperty(globalThis, addonStoreKey, {
        configurable: true,
        get: () => addonStore,
        set: (store: unknown) => {
          addonStore = store
          wrapStore(store)
        },
      })
    },
    { id: storyId }
  )
}

async function waitForStoryFinished(
  page: import('@playwright/test').Page,
  storyId: string
): Promise<StoryFinishedResult> {
  // Storybook's a11y addon reports from its `afterEach` render phase. The
  // STORY_FINISHED event is emitted after that phase and carries its terminal
  // status, so this both prevents concurrent axe runs and rejects failed
  // render/play/report paths instead of treating their error UI as a story.
  await page.waitForFunction(
    (id) => {
      const state = Reflect.get(globalThis, '__ADEA_STORYBOOK_READINESS__') as
        | { storyId?: string; finished?: { storyId?: string } }
        | undefined
      return state?.storyId === id && state.finished?.storyId === id
    },
    storyId,
    { timeout: 10_000 }
  )

  return page.evaluate((id) => {
    const state = Reflect.get(globalThis, '__ADEA_STORYBOOK_READINESS__') as
      | { storyId?: string; finished?: Record<string, unknown> }
      | undefined
    const finished = state?.storyId === id ? state.finished : undefined
    const reporters = Array.isArray(finished?.['reporters'])
      ? finished['reporters'].map((reporter) => {
          if (!reporter || typeof reporter !== 'object') return {}
          const result = Reflect.get(reporter, 'result')
          return {
            type:
              typeof Reflect.get(reporter, 'type') === 'string'
                ? Reflect.get(reporter, 'type')
                : undefined,
            status:
              typeof Reflect.get(reporter, 'status') === 'string'
                ? Reflect.get(reporter, 'status')
                : undefined,
            error:
              result && typeof result === 'object' && Reflect.get(result, 'error')
                ? String(Reflect.get(result, 'error'))
                : undefined,
          }
        })
      : []
    return {
      storyId: typeof finished?.['storyId'] === 'string' ? finished['storyId'] : id,
      status: typeof finished?.['status'] === 'string' ? finished['status'] : 'unknown',
      reporters,
    }
  }, storyId) as Promise<StoryFinishedResult>
}

async function storyFinishedError(
  page: import('@playwright/test').Page,
  result: StoryFinishedResult
): Promise<Error> {
  const visibleError = ((await page.locator('.sb-errordisplay').allTextContents())[0] ?? '').trim()

  const reporterErrors = result.reporters
    .map((reporter) => {
      const label = [reporter.type, reporter.status].filter(Boolean).join('/') || 'reporter'
      return reporter.error ? `${label}: ${reporter.error}` : label
    })
    .join('; ')
  const details = [visibleError && `visible error: ${visibleError}`, reporterErrors].filter(Boolean)
  return new Error(
    `Storybook story "${result.storyId}" finished with status "${result.status}"${details.length ? ` (${details.join('; ')})` : ''}`
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
 * terminal event is observed before this readiness check so failed render/play/
 * reporter paths reject even when they never produce a visible story root.
 */
export async function openStory(
  page: import('@playwright/test').Page,
  id: string,
  theme: string,
  options: OpenStoryOptions = {}
): Promise<void> {
  await installStoryFinishedListener(page, id)
  await page.goto(storyUrl(id, theme, options.baseUrl), { waitUntil: 'domcontentloaded' })
  const result = await waitForStoryFinished(page, id)
  if (result.status !== 'success') throw await storyFinishedError(page, result)
  await waitForStoryReady(page, theme)
}
