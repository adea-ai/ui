import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { openStory, waitForStoryReady } from './stories'

let fixtureServer: Server | undefined
let fixtureBaseUrl = ''
let fixtureFont: Uint8Array

type StorybookFixtureMode =
  | 'success'
  | 'render-error'
  | 'play-error'
  | 'report-error'
  | 'violations-error'

const fixtureHtml = (error: boolean) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @font-face {
        font-family: FixtureFont;
        src: url('/fixture-font.woff2') format('woff2');
        font-display: block;
      }
      html, body { margin: 0; }
      #storybook-root { min-height: 100px; }
      #storybook-root > * { font-family: FixtureFont, sans-serif; }
    </style>
  </head>
  <body>
    <div id="storybook-root"></div>
    <script>
      const root = document.querySelector('#storybook-root');
      setTimeout(() => {
        root.innerHTML = ${JSON.stringify(
          error
            ? '<div class="sb-errordisplay" role="alert">fixture story failed</div>'
            : '<button type="button">fixture mounted</button>'
        )};
        void document.fonts.load('16px FixtureFont');
      }, 40);
      setTimeout(() => {
        document.documentElement.className = 'dark';
        document.documentElement.dataset.theme = 'adea-dark';
        document.documentElement.dataset.appearance = 'dark';
        document.documentElement.style.colorScheme = 'dark';
        document.documentElement.style.setProperty('--background', 'oklch(0.2 0 0)');
      }, 120);
      ${error ? "setTimeout(() => { throw new Error('fixture story failed'); }, 60);" : ''}
    </script>
  </body>
</html>`

const storybookFixtureHtml = (mode: StorybookFixtureMode) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @font-face {
        font-family: FixtureFont;
        src: url('/fixture-font.woff2') format('woff2');
        font-display: block;
      }
      html, body { margin: 0; }
      #storybook-root { min-height: 100px; }
      #storybook-root > * { font-family: FixtureFont, sans-serif; }
      .sb-errordisplay { color: darkred; }
    </style>
  </head>
  <body>
    <div id="storybook-root"></div>
    <script>
      const mode = ${JSON.stringify(mode)};
      const storyId = new URLSearchParams(location.search).get('id') ?? '';
      const listeners = new Map();
      const channel = {
        on(event, listener) { listeners.set(event, listener); },
        emit(event, payload) { listeners.get(event)?.(payload); },
      };
      window.__STORYBOOK_ADDONS_PREVIEW = {
        channel,
        getChannel() { return this.channel; },
        setChannel(next) { this.channel = next; },
      };
      window.__STORYBOOK_ADDONS_PREVIEW.setChannel(channel);

      const root = document.querySelector('#storybook-root');
      const finish = (status, reporters = []) =>
        channel.emit('storyFinished', { storyId, status, reporters });
      const setTheme = () => {
        document.documentElement.className = 'dark';
        document.documentElement.dataset.theme = 'adea-dark';
        document.documentElement.dataset.appearance = 'dark';
        document.documentElement.style.colorScheme = 'dark';
        document.documentElement.style.setProperty('--background', 'oklch(0.2 0 0)');
      };
      const setError = (message) => {
        root.innerHTML = '<div class="sb-errordisplay" role="alert"></div>';
        root.querySelector('.sb-errordisplay').textContent = message;
      };

      setTimeout(() => {
        if (mode === 'render-error') {
          setError('fixture render failed');
          finish('error');
          return;
        }
        root.innerHTML = '<button id="fixture-mounted" type="button">fixture mounted</button>';
        void document.fonts.load('16px FixtureFont');
        setTimeout(() => {
          setTheme();
          if (mode === 'success') {
            root.dataset.playComplete = 'true';
            finish('success');
          } else if (mode === 'report-error') {
            finish('error', [
              { type: 'a11y', status: 'failed', result: { error: 'fixture report failed' } },
            ]);
          } else if (mode === 'violations-error') {
            finish('error', [
              {
                type: 'a11y',
                status: 'failed',
                result: {
                  violations: [
                    {
                      id: 'button-name',
                      help: 'Buttons must have discernible text',
                      nodes: [{ target: ['#fixture-mounted'] }],
                    },
                  ],
                },
              },
            ]);
          } else {
            setError('fixture play failed');
            setTimeout(() => { throw new Error('fixture play failed'); }, 0);
            finish('error');
          }
        }, 180);
      }, 40);
    </script>
  </body>
</html>`

test.beforeAll(async () => {
  fixtureFont = await readFile(
    new URL(
      '../../../packages/ui/node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2',
      import.meta.url
    )
  )
  fixtureServer = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/fixture-font.woff2') {
      setTimeout(() => {
        response.writeHead(200, { 'content-type': 'font/woff2' })
        response.end(fixtureFont)
      }, 150)
      return
    }
    if (url.pathname === '/fixture.html') {
      const body = fixtureHtml(url.searchParams.get('error') === '1')
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(body)
      return
    }
    if (url.pathname === '/iframe.html') {
      const modeByStoryId: Record<string, StorybookFixtureMode> = {
        'fixture--delayed-success': 'success',
        'fixture--render-error': 'render-error',
        'fixture--play-error': 'play-error',
        'fixture--report-error': 'report-error',
        'fixture--violations-error': 'violations-error',
      }
      const mode = modeByStoryId[url.searchParams.get('id') ?? ''] ?? 'success'
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(storybookFixtureHtml(mode))
      return
    }
    response.writeHead(204)
    response.end()
  })
  await new Promise<void>((resolve) => {
    fixtureServer!.listen(0, '127.0.0.1', () => {
      const address = fixtureServer!.address()
      if (!address || typeof address === 'string') throw new Error('fixture server did not bind')
      fixtureBaseUrl = `http://127.0.0.1:${address.port}`
      resolve()
    })
  })
})

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!fixtureServer) {
      resolve()
      return
    }
    fixtureServer.close((error) => (error ? reject(error) : resolve()))
  })
  fixtureServer = undefined
})

test.describe('story readiness', () => {
  test('waits for delayed mount, provider theme tokens, and web fonts', async ({ page }) => {
    await page.goto(`${fixtureBaseUrl}/fixture.html`, { waitUntil: 'domcontentloaded' })

    await waitForStoryReady(page, 'adea-dark')

    await expect(page.locator('#storybook-root > *')).toHaveText('fixture mounted')
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded')
    await expect
      .poll(() =>
        page.evaluate(() => ({
          theme: document.documentElement.dataset.theme,
          appearance: document.documentElement.dataset.appearance,
          dark: document.documentElement.classList.contains('dark'),
          background: document.documentElement.style.getPropertyValue('--background'),
        }))
      )
      .toEqual({
        theme: 'adea-dark',
        appearance: 'dark',
        dark: true,
        background: 'oklch(0.2 0 0)',
      })
  })

  test('leaves a delayed Storybook error visible and observable', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(`${fixtureBaseUrl}/fixture.html?error=1`, { waitUntil: 'domcontentloaded' })

    await waitForStoryReady(page, 'adea-dark')

    await expect(page.locator('.sb-errordisplay')).toBeVisible()
    await expect(page.locator('.sb-errordisplay')).toHaveText('fixture story failed')
    expect(pageErrors).toContain('fixture story failed')
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded')
  })

  test('automated Axe ownership uses the supported manual global only for that navigation', async ({
    page,
  }) => {
    await openStory(page, 'fixture--delayed-success', 'adea-dark', {
      baseUrl: fixtureBaseUrl,
      a11yOwner: 'playwright',
    })
    expect(new URL(page.url()).searchParams.get('globals')).toContain('a11y.manual:!true')
    await expect(page.locator('#storybook-root')).toHaveAttribute('data-play-complete', 'true')
    await openStory(page, 'fixture--delayed-success', 'adea-dark', { baseUrl: fixtureBaseUrl })
    expect(new URL(page.url()).searchParams.get('globals')).not.toContain('a11y.manual')
  })

  test('openStory waits for a successful delayed play and terminal report', async ({ page }) => {
    await openStory(page, 'fixture--delayed-success', 'adea-dark', { baseUrl: fixtureBaseUrl })

    await expect(page.locator('#storybook-root')).toHaveAttribute('data-play-complete', 'true')
    await expect(page.locator('#fixture-mounted')).toHaveText('fixture mounted')
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded')
  })

  for (const [storyId, expectedMessage] of [
    ['fixture--render-error', 'fixture render failed'],
    ['fixture--play-error', 'fixture play failed'],
    ['fixture--report-error', 'fixture report failed'],
  ] as const) {
    test(`openStory rejects ${storyId} terminal status`, async ({ page }) => {
      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))

      await expect(
        openStory(page, storyId, 'adea-dark', { baseUrl: fixtureBaseUrl })
      ).rejects.toThrow(expectedMessage)

      if (storyId !== 'fixture--report-error') {
        await expect(page.locator('.sb-errordisplay')).toHaveText(expectedMessage)
      }
      if (storyId === 'fixture--play-error') {
        await expect.poll(() => pageErrors).toContain('fixture play failed')
      }
    })
  }

  test('openStory reports failed a11y rule details from terminal reporters', async ({ page }) => {
    await expect(
      openStory(page, 'fixture--violations-error', 'adea-dark', { baseUrl: fixtureBaseUrl })
    ).rejects.toThrow(/button-name.*Buttons must have discernible text.*#fixture-mounted/)
  })

  test('openStory reuses its terminal listener across same-page navigations', async ({ page }) => {
    await openStory(page, 'fixture--delayed-success', 'adea-dark', { baseUrl: fixtureBaseUrl })
    await expect(page.locator('#storybook-root')).toHaveAttribute('data-play-complete', 'true')

    await expect(
      openStory(page, 'fixture--violations-error', 'adea-dark', { baseUrl: fixtureBaseUrl })
    ).rejects.toThrow(/button-name.*#fixture-mounted/)
  })
})
