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

  test('a div wearing role="button" is reported as a Button re-implementation', () => {
    const config = writeConfig({ 'no-interactive-wrappers': 'error' })
    const output = lint(
      config,
      'role-wrapper.tsx',
      `export function Wrapper() {\n\treturn <div role="button" tabIndex={0} class="px-3 py-2">Save</div>\n}\n`
    )
    expect(output).toContain('no-interactive-wrappers')
    expect(output).toContain('use Button from @adea-ai/ui/components/ui/button')
  })

  test('a click handler on a generic element is reported', () => {
    const config = writeConfig({ 'no-interactive-wrappers': 'error' })
    const output = lint(
      config,
      'click-wrapper.tsx',
      `export function Row() {\n\treturn <span class="cursor-pointer" onClick={() => {}}>pick me</span>\n}\n`
    )
    expect(output).toContain('no-interactive-wrappers')
    expect(output).toContain('composes Button by hand')
  })

  test('a tabindex alone makes a generic element a finding', () => {
    const config = writeConfig({ 'no-interactive-wrappers': 'error' })
    const output = lint(
      config,
      'tabindex-wrapper.tsx',
      `export function Cell() {\n\treturn <td tabIndex={0}>cell</td>\n}\n`
    )
    expect(output).toContain('no-interactive-wrappers')
    expect(output).toContain('tabindex on td')
  })

  test('non-generic elements without roles pass, and anchors stay native', () => {
    const config = writeConfig({ 'no-interactive-wrappers': 'error' })
    const output = lint(
      config,
      'legit.tsx',
      `export function Legit() {\n\treturn <a href="/docs">Docs</a>\n}\n`
    )
    expect(output).not.toContain('no-interactive-wrappers')
  })

  test('native interactive elements belong to the sibling rule, not this one', () => {
    const config = writeConfig({ 'no-interactive-wrappers': 'error' })
    const output = lint(
      config,
      'native.tsx',
      `export function Native() {\n\treturn <button type="button">Save</button>\n}\n`
    )
    expect(output).not.toContain('no-interactive-wrappers')
  })

  test('the allow option exempts a wrapper element', () => {
    const config = join(dir, `wrap-allow-${Math.random().toString(36).slice(2)}.json`)
    writeFileSync(
      config,
      JSON.stringify({
        jsPlugins: [pluginPath],
        overrides: [
          {
            files: ['wrap-allow.tsx'],
            rules: [['adea/no-interactive-wrappers', 'error', { allow: ['div'] }]],
          },
        ],
      })
    )
    const output = lint(
      config,
      'wrap-allow.tsx',
      `export function Exempt() {\n\treturn <div onClick={() => {}}>exempt</div>\n}\n`
    )
    expect(output).not.toContain('no-interactive-wrappers')
  })

  test('a design-system component composing a role is not reported', () => {
    // A Button carrying role="option" inside a custom listbox is composition —
    // the element is already the design system's own primitive with its
    // keyboard story intact. The rule polices raw markup, not the library.
    const config = writeConfig({ 'no-interactive-wrappers': 'error' })
    const output = lint(
      config,
      'composed.tsx',
      `import { Button } from '@adea-ai/ui/components/ui/button'\nexport function Option({ label }: { label: string }) {\n\treturn <Button role="option">{label}</Button>\n}\n`
    )
    expect(output).not.toContain('no-interactive-wrappers')
  })
})
