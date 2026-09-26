import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { waitForStoryReady } from './stories'

let fixtureServer: Server | undefined
let fixtureBaseUrl = ''
let fixtureFont: Uint8Array

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
})
