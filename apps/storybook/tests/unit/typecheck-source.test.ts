import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
// The config-resolution guard needs the classic JS API (`ts.sys`,
// `readConfigFile`, `resolveModuleName`), which TypeScript 7's native compiler
// removed. The `typescript6` alias keeps exactly that API for this test while
// the toolchain itself runs TypeScript 7.
import ts from 'typescript6'

/*
 * `typecheck` runs without a library build first (the named Vite+ tasks
 * depend only on the toolchain check). That is only sound while every workshop tsconfig resolves the design
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
  // Load Vite's Node-only dependency graph in its own process. The workshop's
  // transform test installs browser globals in this Bun process.
  const tasks = JSON.parse(
    execFileSync(
      'node',
      [
        '--input-type=module',
        '-e',
        "import config from './vite.config.ts'; console.log(JSON.stringify(config.run.tasks))",
      ],
      { cwd: resolve(app, '../..'), encoding: 'utf8' }
    )
  ) as Record<string, { dependsOn?: string[] }>
  for (const name of ['orch:ui:typecheck', 'orch:storybook:typecheck']) {
    expect(tasks[name]).toMatchObject({ dependsOn: ['orch:toolchain'] })
  }
})
