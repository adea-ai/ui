import { beforeAll, afterAll, describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * The design system's lint plugin, verified end to end through the same binary the
 * consumers run.
 *
 * Unit-testing the rule's visitor would test our reading of the AST, not the
 * product: the thing that can break is the *plugin boundary* — how oxlint loads
 * the module, names the rules and hands it options. So each case builds the
 * plugin, writes an oxlint config that loads it exactly the way a consumer's
 * `.oxlintrc.json` does, and asserts on oxlint's own output.
 */
const ROOT = resolve(import.meta.dir, '..')
/** oxlint hoists to the workspace root's bin; the package-local .bin does not carry it. */
const OXLINT = resolve(ROOT, '../../node_modules/.bin/oxlint')
const PLUGIN_SOURCE = resolve(ROOT, 'src/lint/index.ts')

let dir: string
let pluginPath: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'adea-lint-plugin-'))
  pluginPath = join(dir, 'adea-lint-plugin.mjs')
  const built = spawnSync(
    'bun',
    ['build', PLUGIN_SOURCE, '--outfile', pluginPath, '--format', 'esm'],
    {
      encoding: 'utf8',
    }
  )
  if (built.status !== 0) throw new Error(`plugin build failed: ${built.stderr}`)
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** An oxlint config loading the built plugin, with the named rules at error. */
function writeConfig(rules: Record<string, string>): string {
  const target = join(dir, `.oxlintrc-${Math.random().toString(36).slice(2)}.json`)
  writeFileSync(
    target,
    JSON.stringify({
      jsPlugins: [pluginPath],
      rules: Object.fromEntries(
        Object.entries(rules).map(([rule, level]) => [`adea/${rule}`, level])
      ),
    })
  )
  return target
}

function lint(config: string, name: string, body: string): string {
  writeFileSync(join(dir, name), body)
  const run = spawnSync(OXLINT, ['-c', config, name], { cwd: dir, encoding: 'utf8' })
  return run.stdout + run.stderr
}

describe('the design system lint plugin', () => {
  beforeAll(() => {
    // oxlint resolves its own schema relative to the linted workspace; the fixtures
    // carry a minimal tsconfig so TSX parses without a full project.
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { jsx: 'preserve', jsxImportSource: 'solid-js' } })
    )
  })

  test('raw interactive elements are reported with their primitive', () => {
    const config = writeConfig({ 'no-raw-interactive-elements': 'error' })
    const output = lint(
      config,
      'raw.tsx',
      `export function Bad() {\n\treturn <button type="button">Save</button>\n}\n`
    )
    expect(output).toContain('no-raw-interactive-elements')
    expect(output).toContain('use Button from @adea-ai/ui/components/ui/button')
  })

  test('a file with no interactive elements is not reported', () => {
    const config = writeConfig({ 'no-raw-interactive-elements': 'error' })
    const output = lint(
      config,
      'clean.tsx',
      `export function Fine() {\n\treturn <div class="ok">text and <span>markup</span></div>\n}\n`
    )
    expect(output).not.toContain('no-raw-interactive-elements')
  })

  test('an allowed element is exempt through the rule option', () => {
    const config = join(dir, `allow-${Math.random().toString(36).slice(2)}.json`)
    writeFileSync(
      config,
      JSON.stringify({
        jsPlugins: [pluginPath],
        overrides: [
          {
            files: ['allow-case.tsx'],
            rules: [['adea/no-raw-interactive-elements', 'error', { allow: ['button'] }]],
          },
        ],
      })
    )
    const output = lint(
      config,
      'allow-case.tsx',
      `export function Allowed() {\n\treturn <button type="button">Save</button>\n}\n`
    )
    expect(output).not.toContain('no-raw-interactive-elements')
  })

  test('primitive library imports are reported', () => {
    const config = writeConfig({ 'no-primitive-library-imports': 'error' })
    const output = lint(
      config,
      'primitive.ts',
      `import { TextField } from '@kobalte/core/text-field'\nexport { TextField }\n`
    )
    expect(output).toContain('no-primitive-library-imports')
    expect(output).toContain('@kobalte/core')
  })

  test('an import from the design system itself is not reported', () => {
    const config = writeConfig({ 'no-primitive-library-imports': 'error' })
    const output = lint(
      config,
      'own.ts',
      `import { cn } from '@adea-ai/ui/lib/utils'\nexport const marker = typeof cn\n`
    )
    expect(output).not.toContain('no-primitive-library-imports')
  })
})
