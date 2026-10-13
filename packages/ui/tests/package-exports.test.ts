import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { readModuleExports } from '../scripts/module-exports'
import {
  diffExports,
  libraryEntries,
  publishedModules,
  type ExportsMap,
} from '../scripts/package-exports'

const packageRoot = resolve(import.meta.dirname, '..')
const manifest: { exports: ExportsMap } = JSON.parse(
  readFileSync(resolve(packageRoot, 'package.json'), 'utf8')
)
const sourceFiles = readdirSync(resolve(packageRoot, 'src'), { recursive: true }).map(String)

test('every lib module the exports map publishes is a library entry', () => {
  const modules = publishedModules(manifest.exports, sourceFiles)
  const entries = libraryEntries(modules, packageRoot)

  const libSources = sourceFiles.filter(
    (file) => file.startsWith('lib/') && file.endsWith('.ts') && !/\.(test|stories)\./.test(file)
  )
  expect(libSources.length).toBeGreaterThan(10)
  for (const file of libSources) {
    const name = file.slice('lib/'.length, -'.ts'.length)
    // A subpath set to `null` is a deliberate block, not a published module.
    if (manifest.exports[`./lib/${name}`] === null) {
      expect(entries[`lib/${name}`]).toBeUndefined()
      continue
    }
    expect(entries[`lib/${name}`]).toBe(resolve(packageRoot, 'src', file))
  }
})

test('the modules that lost exports in 0.128.0 are entries', () => {
  const entries = libraryEntries(publishedModules(manifest.exports, sourceFiles), packageRoot)
  const lost = [
    'lib/accent-roles',
    'lib/themes',
    'lib/font-zoom',
    'lib/overlay',
    'lib/tooltip-focus-gate',
  ]
  for (const entry of lost) expect(Object.keys(entries)).toContain(entry)
})

test('explicit subpaths and component indexes are entries too', () => {
  const entries = libraryEntries(publishedModules(manifest.exports, sourceFiles), packageRoot)
  expect(Object.keys(entries)).toContain('components/layout/split-layout/model')
  expect(Object.keys(entries)).toContain('components/conversation/paste-tokens')
  expect(Object.keys(entries)).toContain('components/ui/button/index')
  expect(Object.keys(entries)).not.toContain('lib/cn-tables.generated')
  // Stories and tests never become entries.
  expect(Object.keys(entries).filter((name) => /stories|\.test/.test(name))).toEqual([])
})

test('publishedModules expands wildcards against source files and honours null blocks', () => {
  const exportsMap: ExportsMap = {
    './lib/*': {
      types: './dist/lib/*.d.ts',
      solid: './src/lib/*.ts',
      import: './dist/lib/*.js',
    },
    './lib/hidden': null,
    './components/*': {
      types: './dist/components/*/index.d.ts',
      solid: './src/components/*/index.ts',
      import: './dist/components/*/index.js',
    },
    './lint': { types: './dist/lint/index.d.ts', default: './dist/lint.js' },
    './theme.css': './src/styles/theme.css',
  }
  const modules = publishedModules(exportsMap, [
    'lib/a.ts',
    'lib/a.test.ts',
    'lib/hidden.ts',
    'lib/nested/deep.ts',
    'components/ui/x/index.ts',
    'components/ui/x/x.tsx',
  ])
  expect(modules.map((module) => [module.specifier, module.entry])).toEqual([
    ['./components/ui/x', 'components/ui/x/index'],
    ['./lib/a', 'lib/a'],
    ['./lint', 'lint'],
  ])
})

test('every * in a target is replaced, and a key or source with several is refused', () => {
  const modules = publishedModules(
    {
      './lib/*': {
        types: './dist/lib/*/*.d.ts',
        solid: './src/lib/*.ts',
        import: './dist/lib/*/*.js',
      },
    },
    ['lib/a.ts']
  )
  expect(modules).toEqual([
    {
      specifier: './lib/a',
      types: 'dist/lib/a/a.d.ts',
      runtime: 'dist/lib/a/a.js',
      source: 'src/lib/a.ts',
      entry: 'lib/a/a',
    },
  ])
  const target = { types: './dist/*.d.ts', solid: './src/*.ts', import: './dist/*.js' }
  expect(() => publishedModules({ './a/*/*': target }, ['a.ts'])).toThrow('exactly one *')
  expect(() =>
    publishedModules({ './a/*': { ...target, solid: './src/*/*.ts' } }, ['a.ts'])
  ).toThrow('exactly one *')
})

test('a wildcard export without a source condition cannot be expanded', () => {
  expect(() =>
    publishedModules({ './lib/*': { types: './dist/lib/*.d.ts', import: './dist/lib/*.js' } }, [])
  ).toThrow('no solid source condition')
})

test('diffExports reports both directions and ignores order', () => {
  expect(diffExports(['b', 'a', 'c'], ['c', 'a'])).toEqual({
    missingAtRuntime: ['b'],
    undeclared: [],
  })
  expect(diffExports(['a'], ['a', 'z'])).toEqual({ missingAtRuntime: [], undeclared: ['z'] })
  expect(diffExports([], [])).toEqual({ missingAtRuntime: [], undeclared: [] })
})

test('readModuleExports sees values, classes and re-exports but not types', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adea-module-exports-'))
  try {
    writeFileSync(
      join(dir, 'a.d.ts'),
      [
        'export declare const value: number;',
        'export declare function fn(): void;',
        'export declare class Klass {}',
        'export interface OnlyType { x: number }',
        'export type Alias = string;',
        "export { other, type OtherType } from './b';",
        "export * from './c';",
      ].join('\n')
    )
    writeFileSync(
      join(dir, 'b.d.ts'),
      'export declare const other: number;\nexport interface OtherType {}\n'
    )
    writeFileSync(join(dir, 'c.d.ts'), 'export declare const fromStar: number;\n')
    writeFileSync(
      join(dir, 'a.js'),
      [
        'export const value = 1',
        'export function fn() {}',
        'export class Klass {}',
        "export { other } from './b.js'",
        "export * from './c.js'",
      ].join('\n')
    )
    writeFileSync(join(dir, 'b.js'), 'export const other = 2\n')
    writeFileSync(join(dir, 'c.js'), 'export const fromStar = 3\n')
    const { declared, runtime } = readModuleExports([join(dir, 'a.d.ts')], [join(dir, 'a.js')])
    const names = ['Klass', 'fn', 'fromStar', 'other', 'value']
    expect(declared.get(join(dir, 'a.d.ts'))).toEqual(names)
    expect(runtime.get(join(dir, 'a.js'))).toEqual(names)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('root cause: preserveModules drops exports of a non-entry module, and an entry keeps them', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'adea-preserve-modules-'))
  try {
    mkdirSync(join(dir, 'src', 'lib'), { recursive: true })
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      "import { used } from './lib/shared'\nexport const main = () => used()\n"
    )
    writeFileSync(
      join(dir, 'src', 'lib', 'shared.ts'),
      'export const used = () => Math.random()\nexport const unusedByAnyEntry = () => Math.random()\n'
    )
    const bundle = async (entries: Record<string, string>, outDir: string) => {
      await build({
        root: dir,
        logLevel: 'silent',
        configFile: false,
        build: {
          outDir,
          emptyOutDir: true,
          minify: false,
          lib: { entry: entries, formats: ['es'], fileName: () => 'index.js' },
          rollupOptions: {
            output: {
              preserveModules: true,
              preserveModulesRoot: 'src',
              entryFileNames: '[name].js',
            },
          },
        },
      })
      return readFileSync(join(dir, outDir, 'lib', 'shared.js'), 'utf8')
    }
    const index = join(dir, 'src', 'index.ts')
    const shared = join(dir, 'src', 'lib', 'shared.ts')

    const withoutEntry = await bundle({ index }, 'out-without-entry')
    expect(withoutEntry).not.toContain('unusedByAnyEntry')

    const withEntry = await bundle({ index, 'lib/shared': shared }, 'out-with-entry')
    expect(withEntry).toContain('unusedByAnyEntry')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}, 30_000)

test('vite.config.ts derives its entries from the exports map', () => {
  const config = readFileSync(resolve(packageRoot, 'vite.config.ts'), 'utf8')
  expect(config).toMatch(/publishedModules\(\s*manifest\.exports/)
  expect(config).toContain('libraryEntries(')
})
