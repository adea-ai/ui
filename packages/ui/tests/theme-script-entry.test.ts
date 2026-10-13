import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { themeScript as providerEntryScript } from '../src/components/theme'
import { themeScript } from '../src/components/theme/script'

const root = join(import.meta.dir, '..')

describe('the script entry', () => {
  test('writes the script the provider entries export', () => {
    const options = { key: 'host.appearance', version: 2, surface: true } as const
    expect(themeScript(options)).toBe(providerEntryScript(options))
    expect(themeScript('host.appearance')).toBe(providerEntryScript('host.appearance'))
  })

  test('is published as its own subpath, backed by a module without a UI runtime', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      exports: Record<string, { solid?: string; import?: string }>
    }
    const entry = manifest.exports['./components/theme/script']
    expect(entry?.solid).toBe('./src/components/theme/script.ts')
    expect(entry?.import).toBe('./dist/components/theme/script.js')
  })

  test('loads without Solid, so a build tool can import it in Node', async () => {
    const built = await Bun.build({
      entrypoints: [join(root, 'src/components/theme/script.ts')],
      external: ['solid-js', 'solid-js/*'],
      target: 'node',
    })
    expect(built.success).toBe(true)
    const code = (await Promise.all(built.outputs.map((output) => output.text()))).join('\n')
    expect(code).not.toMatch(/from\s+["']solid-js/)
  })
})
