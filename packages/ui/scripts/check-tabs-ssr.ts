import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import solid from 'vite-plugin-solid'

/** Exercise real server rendering, independently of the browser-only Solid runtime. */
export async function checkTabsSsr(consumer: string, tabsImport: string) {
  const directory = mkdtempSync(join(consumer, '.tabs-ssr-'))
  const require = createRequire(join(consumer, 'package.json'))
  const solidRoot = new URL('.', pathToFileURL(require.resolve('solid-js/package.json')))
  try {
    const entry = join(directory, 'probe.tsx')
    writeFileSync(
      entry,
      `import { renderToString } from 'solid-js/web'
import { Tabs, TabsList, TabsTrigger, TabsContent } from ${JSON.stringify(tabsImport)}
export const html = renderToString(() => <>
  <Tabs id="first-root" value="account">
    <TabsList><TabsTrigger id="custom-account" value="account">Account</TabsTrigger></TabsList>
    <TabsContent value="account">First panel</TabsContent>
  </Tabs>
  <Tabs id="second-root" value="account">
    <TabsList><TabsTrigger value="account">Independent account</TabsTrigger></TabsList>
    <TabsContent value="account">Independent panel</TabsContent>
  </Tabs>
  <Tabs id="explicit-root" value="account">
    <TabsList><TabsTrigger id="explicit-trigger" value="account">Explicit account</TabsTrigger></TabsList>
    <TabsContent value="account" aria-labelledby="external-label">Explicit panel</TabsContent>
  </Tabs>
  <span id="external-label">External panel label</span>
</>)`
    )
    await build({
      configFile: false,
      logLevel: 'error',
      plugins: [solid({ ssr: true })],
      resolve: {
        conditions: ['solid', 'node'],
        alias: {
          'solid-js/web': new URL('web/dist/server.js', solidRoot).pathname,
          'solid-js': new URL('dist/server.js', solidRoot).pathname,
        },
      },
      ssr: { noExternal: true },
      build: {
        ssr: entry,
        outDir: join(directory, 'out'),
        minify: false,
        rolldownOptions: { output: { entryFileNames: 'probe.mjs' } },
      },
    })
    const { html } = await import(pathToFileURL(join(directory, 'out/probe.mjs')).href)
    assert.match(html, /id="custom-account"[^>]*role="tab"/)
    assert.match(html, /id="first-root-content-account"[^>]*aria-labelledby="custom-account"/)
    assert.match(
      html,
      /id="second-root-content-account"[^>]*aria-labelledby="second-root-trigger-account"/
    )
    assert.match(html, /id="explicit-root-content-account"[^>]*aria-labelledby="external-label"/)
    console.log('Tabs SSR: custom IDs, independent roots and explicit labels passed')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
