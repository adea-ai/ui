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

/** A consumer config with one path-scoped rule override. */
function writeConfigWithOverride(
  rules: Record<string, string>,
  files: string[],
  overrideRules: Record<string, string>
): string {
  const target = join(dir, `.oxlintrc-${Math.random().toString(36).slice(2)}.json`)
  writeFileSync(
    target,
    JSON.stringify({
      jsPlugins: [pluginPath],
      rules: Object.fromEntries(
        Object.entries(rules).map(([rule, level]) => [`adea/${rule}`, level])
      ),
      overrides: [
        {
          files,
          rules: Object.fromEntries(
            Object.entries(overrideRules).map(([rule, level]) => [`adea/${rule}`, level])
          ),
        },
      ],
    })
  )
  return target
}

function lint(config: string, name: string, body: string): string {
  writeFileSync(join(dir, name), body)
  const run = spawnSync(OXLINT, ['--format=json', '-c', config, name], {
    cwd: dir,
    encoding: 'utf8',
  })
  const output = run.stdout + run.stderr
  if (run.error) throw new Error(`oxlint could not start: ${run.error.message}\n${output}`)
  if (run.signal) throw new Error(`oxlint terminated with signal ${run.signal}\n${output}`)
  if (run.status !== 0 && run.status !== 1)
    throw new Error(`oxlint exited unexpectedly with status ${run.status}\n${output}`)
  let result: {
    diagnostics?: { severity?: string }[]
    number_of_files?: number
    number_of_rules?: number
  }
  try {
    result = JSON.parse(output)
  } catch {
    throw new Error(`oxlint output is missing its JSON findings summary\n${output}`)
  }
  if (
    !Array.isArray(result.diagnostics) ||
    result.number_of_files !== 1 ||
    typeof result.number_of_rules !== 'number'
  )
    throw new Error(`oxlint output is missing its JSON findings summary\n${output}`)
  const hasErrors = result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  if ((run.status === 0 && hasErrors) || (run.status === 1 && !hasErrors))
    throw new Error(`oxlint exit status does not match its findings summary\n${output}`)
  return output
}

function expectNoLintFindings(output: string): void {
  const result = JSON.parse(output) as { diagnostics: unknown[] }
  expect(result.diagnostics).toHaveLength(0)
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
    expectNoLintFindings(output)
  })

  test('every JSX style attribute is rejected, including geometry and theme variables', () => {
    const config = writeConfig({ 'no-inline-styles': 'error' })
    const output = lint(
      config,
      'inline-style.tsx',
      `import { Button } from '@adea-ai/ui/components/ui/button'
export function Examples({ x, style }: { x: number; style: object }) {
  return <><section style={{ position: 'absolute', left: x }} /><Button style={{ '--button-background': 'var(--color-danger)' }} /><div style={style} /></>
}
`
    )
    expect(output).toContain('no-inline-styles')
    expect(output).toContain('style attributes are not permitted')
    expect(output.match(/no-inline-styles/g)).toHaveLength(3)
  })

  test('static object spreads carrying style or classList are rejected', () => {
    const config = writeConfig({ 'no-inline-styles': 'error', 'no-class-list': 'error' })
    const output = lint(
      config,
      'spread-props.tsx',
      `import { Button } from '@adea-ai/ui/components/ui/button'
export function Examples() {
  return <><section {...{ style: { left: 1 } }} /><Button {...{ style: { '--button-background': 'var(--color-danger)' } }} /><aside {...{ ['style']: { left: 2 } }} /><footer {...{ [\`classList\`]: { active: true } }} /><div {...{ classList: { active: true } }} /></>
}
`
    )
    expect(output).toContain('no-inline-styles')
    expect(output).toContain('no-class-list')
    expect(output.match(/no-inline-styles/g)).toHaveLength(3)
    expect(output.match(/no-class-list/g)).toHaveLength(2)
  })

  test('computed identifier keys in object spreads remain an unresolved review boundary', () => {
    const config = writeConfig({ 'no-inline-styles': 'error', 'no-class-list': 'error' })
    const output = lint(
      config,
      'computed-spread-props.tsx',
      `export function Example({ styleKey, classListKey, value }: { styleKey: string; classListKey: string; value: unknown }) {
  return <div {...{ [styleKey]: value, [classListKey]: value }} />
}
`
    )
    expect(output).not.toContain('no-inline-styles')
    expect(output).not.toContain('no-class-list')
    expectNoLintFindings(output)
  })

  test('style elements are rejected at their opening element', () => {
    const config = writeConfig({ 'no-inline-styles': 'error' })
    const output = lint(
      config,
      'style-element.tsx',
      `export function Example() { return <style>{'.preview { left: 2px; }'}</style> }\n`
    )
    expect(output).toContain('no-inline-styles')
    expect(output).toContain('A JSX style element bypasses the shared design system')
  })

  test('classList is rejected on intrinsic and shared JSX components', () => {
    const config = writeConfig({ 'no-class-list': 'error' })
    const output = lint(
      config,
      'class-list.tsx',
      `import { Button } from '@adea-ai/ui/components/ui/button'
export function Examples({ active }: { active: boolean }) {
  return <><div classList={{ active }} /><Button classList={{ 'bg-destructive': active }} /></>
}
`
    )
    expect(output).toContain('no-class-list')
    expect(output).toContain('Use cn() with its object-key form')
    expect(output.match(/no-class-list/g)).toHaveLength(2)
  })

  test('static classes, cn object-key conditions, and non-style props remain valid', () => {
    const config = writeConfig({ 'no-inline-styles': 'error', 'no-class-list': 'error' })
    const output = lint(
      config,
      'static-classes.tsx',
      `import { Button } from '@adea-ai/ui/components/ui/button'
import { cn } from '@adea-ai/ui/lib/utils'
export function Examples({ active, state }: { active: boolean; state: string }) {
  return <><Button class={cn('w-full', { 'md:ml-2': active })} data-state={state} data-style="compact">Save</Button><div class="domain-layout">Content</div></>
}
`
    )
    expect(output).not.toContain('no-inline-styles')
    expect(output).not.toContain('no-class-list')
    expectNoLintFindings(output)
  })

  test('a path-scoped implementation exemption does not exempt sibling consumers', () => {
    const config = writeConfigWithOverride(
      { 'no-inline-styles': 'error' },
      ['library-component.tsx'],
      { 'no-inline-styles': 'off' }
    )
    const source = `export function Example() { return <div style={{ color: 'red' }} /> }\n`
    const libraryOutput = lint(config, 'library-component.tsx', source)
    const consumerOutput = lint(config, 'consumer-component.tsx', source)
    expect(libraryOutput).not.toContain('no-inline-styles')
    expectNoLintFindings(libraryOutput)
    expect(consumerOutput).toContain('no-inline-styles')
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
            rules: {
              'adea/no-raw-interactive-elements': ['error', { allow: ['button'] }],
            },
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

  // Each case starts a real oxlint process. Keep one process per test so the
  // normal test deadline measures a case, rather than several CLI startups.
  for (const [name, source] of Object.entries({
    named: "export { TextField } from '@kobalte/core/text-field'",
    star: "export * from '@corvu/drawer'",
    dynamic: "export const load = () => import('cmdk-solid')",
    require: "export const primitive = require('@base-ui/react/dialog')",
  })) {
    test(`primitive ${name} cannot bypass the shared boundary`, () => {
      const config = writeConfig({ 'no-primitive-library-imports': 'error' })
      expect(lint(config, `${name}.ts`, source)).toContain('no-primitive-library-imports')
    })
  }
  test('a shared re-export remains permitted', () => {
    const config = writeConfig({ 'no-primitive-library-imports': 'error' })
    expect(
      lint(config, 'shared-export.ts', "export * from '@adea-ai/ui/components/ui/dialog'")
    ).not.toContain('no-primitive-library-imports')
  })

  for (const [name, attributes] of Object.entries({
    expression: 'role={"button"}',
    conditional: 'role={true ? "switch" : "checkbox"}',
    native: 'on:click={() => {}}',
    bound: 'onClick={[() => {}, "data"]}',
    pointer: 'onPointerUp={() => {}}',
  })) {
    test(`${name} wrapper interaction is reported`, () => {
      const config = writeConfig({ 'no-interactive-wrappers': 'error' })
      expect(
        lint(config, `${name}.tsx`, `export const Control = () => <div ${attributes}>Go</div>`)
      ).toContain('no-interactive-wrappers')
    })
  }

  for (const [name, attribute] of Object.entries({
    expression: 'tabIndex={-1}',
    literal: 'tabindex="-1"',
  })) {
    test(`negative ${name} tabindex permits programmatic focus without a tab stop`, () => {
      const config = writeConfig({ 'no-interactive-wrappers': 'error' })
      expect(
        lint(
          config,
          `focus-${name}.tsx`,
          `export const Main = () => <main ${attribute}>Page</main>`
        )
      ).not.toContain('no-interactive-wrappers')
    })
  }
  test('negative tabindex does not permit a hand-built control', () => {
    const config = writeConfig({ 'no-interactive-wrappers': 'error' })
    expect(
      lint(
        config,
        'focus-control.tsx',
        'export const Bad = () => <div tabIndex={-1} role="button">Go</div>'
      )
    ).toContain('no-interactive-wrappers')
  })

  test('literal spread props preserve role, activation, and tab-stop wrapper checks', () => {
    const config = writeConfig({ 'no-interactive-wrappers': 'error' })
    const output = lint(
      config,
      'spread-wrappers.tsx',
      `const roleKey = 'role'
export function Examples({ activate, handleKey, props }: { activate: () => void; handleKey: () => void; props: object }) {
  return <><section {...{ role: 'switch' }} /><span {...{ ['on:click']: activate }} /><td {...{ [\`tabIndex\`]: 0 }} /><nav {...{ ...{ ['role']: 'checkbox' } }} /><header {...({ onClick: activate } as const)} /><aside {...({ ['role']: 'radio' } as const)} /><div {...{ [roleKey]: 'button' }} /><main {...{ tabIndex: -1, onKeyDown: handleKey }} /><article {...{ tabIndex: 0, onKeyDown: handleKey }} /><footer {...props} /></>
}
`
    )
    expect(output).toContain('no-interactive-wrappers')
    expect(output.match(/no-interactive-wrappers/g)).toHaveLength(7)
  })

  test('unknown spread expressions and computed key variables remain unresolved', () => {
    const config = writeConfig({ 'no-interactive-wrappers': 'error' })
    const output = lint(
      config,
      'unresolved-wrappers.tsx',
      `export function Examples({ roleKey, props }: { roleKey: string; props: object }) {
  return <><div {...{ [roleKey]: 'button' }} /><span {...props} /><main {...{ tabIndex: -1, onKeyDown: () => {} }} /></>
}
`
    )
    expect(output).not.toContain('no-interactive-wrappers')
    expectNoLintFindings(output)
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
            rules: {
              'adea/no-interactive-wrappers': ['error', { allow: ['div'] }],
            },
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
    expectNoLintFindings(output)
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

  test('icon-size shared Button actions require ActionButton', () => {
    const config = writeConfig({ 'require-action-button-tooltip': 'error' })
    const output = lint(
      config,
      'bare-icon-buttons.tsx',
      `import { Button as SharedButton } from '@adea-ai/ui/components/ui/button'
import { TooltipTrigger } from '@adea-ai/ui/components/ui/tooltip'
export function Examples() {
  return <><SharedButton size="icon-sm" aria-label="Close" /><TooltipTrigger as={SharedButton} size="icon-xs" aria-label="Open"><span /></TooltipTrigger></>
}
`
    )
    expect(output).toContain('require-action-button-tooltip')
    expect(output.match(/require-action-button-tooltip/g)).toHaveLength(2)
  })

  test('icon-size ActionButton requires a supplied nonblank tooltip', () => {
    const config = writeConfig({ 'require-action-button-tooltip': 'error' })
    const output = lint(
      config,
      'missing-action-tooltips.tsx',
      `import { ActionButton as SharedAction } from '@adea-ai/ui/components/composites/action-button'
export function Examples() {
  return <><SharedAction size="icon-md" aria-label="Save" /><SharedAction size="icon-lg" tooltip="  " aria-label="Delete" /></>
}
`
    )
    expect(output).toContain('require-action-button-tooltip')
    expect(output).toContain('needs a supplied nonblank tooltip')
    expect(output.match(/require-action-button-tooltip/g)).toHaveLength(2)
  })

  test('named ActionButton aliases and polymorphic ActionButton triggers accept nonblank tooltips', () => {
    const config = writeConfig({ 'require-action-button-tooltip': 'error' })
    const output = lint(
      config,
      'action-button-tooltips.tsx',
      `import { ActionButton as SharedAction } from '@adea-ai/ui/components/composites/action-button'
import { TooltipTrigger as Trigger } from '@adea-ai/ui/components/ui/tooltip'
export function Examples() {
  return <><SharedAction size="icon-sm" tooltip="Save" aria-label="Save" /><Trigger as={SharedAction} size="icon-xs" tooltip="Close panel" aria-label="Close"><span /></Trigger></>
}
`
    )
    expectNoLintFindings(output)
  })

  test('labelled shared Buttons and ActionButtons are not required to have tooltips', () => {
    const config = writeConfig({ 'require-action-button-tooltip': 'error' })
    const output = lint(
      config,
      'labelled-buttons.tsx',
      `import { Button } from '@adea-ai/ui/components/ui/button'
import { ActionButton } from '@adea-ai/ui/components/composites/action-button'
export function Examples() { return <><Button size="md">Save changes</Button><ActionButton size="sm">Delete project</ActionButton></> }
`
    )
    expectNoLintFindings(output)
  })

  test('dynamic icon-size or tooltip values remain a documented review boundary', () => {
    const config = writeConfig({ 'require-action-button-tooltip': 'error' })
    const output = lint(
      config,
      'dynamic-action-values.tsx',
      `import { ActionButton } from '@adea-ai/ui/components/composites/action-button'
export function Example({ size, tooltip }: { size: string; tooltip: string }) { return <ActionButton size={size} tooltip={tooltip}><span /></ActionButton> }
`
    )
    expectNoLintFindings(output)
  })
})
