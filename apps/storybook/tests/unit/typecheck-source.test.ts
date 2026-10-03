import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import ts from 'typescript'

/*
 * `typecheck` runs without a library build first (turbo.json gives it no
 * `^build`). That is only sound while every workshop tsconfig resolves the design
 * system to its source: were one to fall back to the package's `types` export, it
 * would read `dist` — absent on a clean checkout, stale on a dirty one. The packed
 * `dist` declarations are verified by `bun run build` and the `check:packed-*`
 * scripts, not by typecheck.
 */

const app = resolve(import.meta.dir, '../..')
const uiSource = resolve(app, '../../packages/ui/src')

for (const config of ['tsconfig.json', 'tsconfig.layout.json', 'tsconfig.components.json']) {
  test(`${config} resolves @adea-ai/ui to source`, () => {
    const path = join(app, config)
    const { config: raw, error } = ts.readConfigFile(path, ts.sys.readFile)
    expect(error).toBeUndefined()
    const { options } = ts.parseJsonConfigFileContent(raw, ts.sys, dirname(path))
    for (const specifier of ['@adea-ai/ui', '@adea-ai/ui/components/ui/button']) {
      const resolved = ts.resolveModuleName(specifier, join(app, 'probe.ts'), options, ts.sys)
      const file = resolved.resolvedModule?.resolvedFileName
      expect(file?.startsWith(uiSource)).toBe(true)
    }
  })
}

test('typecheck does not wait on a build', () => {
  const turbo = JSON.parse(readFileSync(resolve(app, '../../turbo.json'), 'utf8')) as {
    tasks: Record<string, { dependsOn?: string[] }>
  }
  expect(turbo.tasks.typecheck?.dependsOn ?? []).not.toContain('^build')
})
