import { resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { createFilter, createServer, type Plugin } from 'vite'
import { viteFinal as storybookSolidViteFinal } from 'storybook-solidjs-vite/preset'
import { scopeComponentMetadataPlugins } from '../../.storybook/component-metadata'

const metadataHandler = () => ({ code: 'component metadata retained', map: null })

test('metadata keeps local components and original exclusions while avoiding dependency TSX', async () => {
  const original: Plugin = {
    name: 'storybook:solid-component-meta',
    enforce: 'pre',
    transform: {
      filter: { id: { include: /\.(?:tsx|jsx)$/, exclude: /\.stories\.(?:tsx|jsx|ts|js)$|\?/ } },
      handler: metadataHandler,
    },
  }
  const [result] = await scopeComponentMetadataPlugins([original])
  const scoped = result as Plugin
  const hook = scoped.transform
  expect(hook && typeof hook === 'object').toBe(true)
  if (!hook || typeof hook === 'function') throw new Error('missing metadata hook')
  expect(hook.handler).toBe(metadataHandler)
  const allows = createFilter(hook.filter?.id?.include, hook.filter?.id?.exclude)
  expect(allows('/repo/packages/ui/src/components/ui/button/button.tsx')).toBe(true)
  expect(allows('C:\\repo\\packages\\ui\\src\\control.jsx')).toBe(true)
  expect(allows('/repo/packages/ui/src/components/ui/button/button.stories.tsx')).toBe(false)
  expect(allows('/repo/packages/ui/src/control.tsx?query')).toBe(false)
  expect(
    allows('/repo/packages/ui/src/components/layout/split-layout/resize-controller-core.tsx')
  ).toBe(false)
  expect(
    allows('/repo/packages/ui/src/components/layout/split-layout/resize-controller-core-retry.tsx')
  ).toBe(false)
  expect(allows('/repo/packages/ui/src/components/layout/split-layout/split-layout.tsx')).toBe(true)
  expect(allows('/repo/node_modules/lucide-solid/src/icons/check.tsx')).toBe(false)
  expect(allows('C:\\repo\\node_modules\\lucide-solid\\src\\icons\\check.tsx')).toBe(false)
  expect(original.transform).not.toBe(hook)
})

test('nested async options retain unrelated hooks', async () => {
  const other: Plugin = { name: 'unrelated-plugin', transform: () => null }
  const result = await scopeComponentMetadataPlugins([false, [Promise.resolve(other)]])
  expect(result).toEqual([false, [other]])
})

test('the real Storybook transform skips private resize controllers and keeps public component docgen', async () => {
  const repositoryRoot = resolve(import.meta.dir, '../../../..')
  const configDir = resolve(repositoryRoot, 'apps/storybook/.storybook')
  const storybookConfig = await storybookSolidViteFinal({}, {
    configDir,
    presets: {
      apply: async (name: string) => (name === 'framework' ? { options: {} } : {}),
    },
  } as Parameters<typeof storybookSolidViteFinal>[1])
  const plugins = await scopeComponentMetadataPlugins(storybookConfig.plugins ?? [])
  const server = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    plugins,
    root: repositoryRoot,
    server: { middlewareMode: true },
  })

  try {
    const button = await server.transformRequest(
      resolve(repositoryRoot, 'packages/ui/src/components/ui/button/button.tsx')
    )
    expect(button?.code).toContain('Button.__docgenInfo =')

    for (const name of ['resize-controller-core.tsx', 'resize-controller-core-retry.tsx']) {
      const controller = await server.transformRequest(
        resolve(repositoryRoot, 'packages/ui/src/components/layout/split-layout', name)
      )
      expect(controller?.code).not.toContain('__docgenInfo')
    }
  } finally {
    await server.close()
  }
}, 30_000)
