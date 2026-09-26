import { expect, test } from 'bun:test'
import { createFilter, type Plugin } from 'vite'
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
  expect(allows('/repo/node_modules/lucide-solid/src/icons/check.tsx')).toBe(false)
  expect(allows('C:\\repo\\node_modules\\lucide-solid\\src\\icons\\check.tsx')).toBe(false)
  expect(original.transform).not.toBe(hook)
})

test('nested async options retain unrelated hooks', async () => {
  const other: Plugin = { name: 'unrelated-plugin', transform: () => null }
  const result = await scopeComponentMetadataPlugins([false, [Promise.resolve(other)]])
  expect(result).toEqual([false, [other]])
})
