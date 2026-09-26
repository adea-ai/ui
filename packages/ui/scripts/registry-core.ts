/**
 * The registry builder, shared by the build script and by the validator.
 *
 * Keeping the derivation in one place is what makes "the committed registry
 * cannot be stale" a checkable property rather than a hope: the validator runs
 * this same function and compares the result with the file on disk.
 *
 * The registry is a *deliverable*, not a document: it is what lets another
 * project take one component without adopting the whole package, and it is what
 * the shadcn CLI reads. Two consequences follow from that, and they are the
 * reason this file exists rather than a hand-written `registry.json`:
 *
 *   1. **It cannot drift.** The item list, each item's file list, its npm
 *      dependencies and its cross-item dependencies are all derived from the
 *      source. Adding a component adds a registry entry, because the component
 *      is the entry.
 *   2. **It is checked.** `registry:validate` and the unit tests assert that
 *      every public export belongs to an item, every item's files exist, and
 *      no item can be installed without a dependency it silently needs.
 *
 * Outputs, all committed so a consumer can read the registry from the
 * repository without building anything:
 *
 *   packages/ui/registry.json       the item catalogue, in shadcn's schema
 *   packages/ui/public/r/*.json     one payload per item, plus the index
 *   packages/ui/public/r/src/**     the files the payloads point at
 *
 * The third output is not a copy of `src`, and that is the whole point of it. A
 * registry item's `files[].path` is resolved by the CLI against the registry's
 * base URL, so the payload is a promise that a file exists there — and while the
 * payloads pointed straight at `src/`, the publish step shipped only the JSON, so
 * every one of the 74 items resolved to a 404. A second, quieter problem sat behind
 * it: 73 of those payloads import `#lib/utils` and friends, which is *this* package's
 * private `imports` map. That resolves inside the package and nowhere else, so even a
 * served copy would have installed a file its consumer's bundler could not read.
 *
 * So this writes its own tree. The served copy is the source with `#lib/*` rewritten
 * to a relative path into the `lib` item, which is the only form of those specifiers
 * that means anything outside this package. The two copies then differ by exactly
 * that rewrite, `tests/registry.test.ts` asserts nothing else differs, and
 * `validate-registry.ts` asserts the served tree is complete and that no file in it
 * still carries an import the consumer cannot resolve.
 *
 * Run: bun run registry:build
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(PACKAGE_ROOT, 'src')
/**
 * Where components live.
 *
 * `group` is the directory between `components/` and the component, and it is
 * also what a consumer's target path is built from — except for a `self` root,
 * which *is* the component rather than a directory of them. The conversation
 * layer is the one such root: it is a single module of several components
 * (`MessageRow`, `MessageComposer`, `ThreadPanel`, …) rather than a folder per
 * component, and it belongs in the registry for the same reason the rest do — a
 * consumer taking `MessageRow` should not have to adopt the package.
 */
const COMPONENT_ROOTS: readonly {
  dir: string
  group: string
  self?: boolean
  slug?: string
}[] = [
  { dir: join(SRC, 'components', 'ui'), group: 'ui' },
  { dir: join(SRC, 'components', 'layout'), group: 'layout' },
  { dir: join(SRC, 'components', 'composites'), group: 'composites' },
  { dir: join(SRC, 'components', 'conversation'), group: 'conversation', self: true },
  // The theming runtime and the motion primitive are public exports like any
  // other, and a consumer who installs `Button` and gets a component that cannot
  // be themed has installed nothing useful. They were absent here, which meant the
  // one thing a design system exists to provide could not be installed at all.
  //
  // `theming` rather than `theme`, because `theme` is the stylesheet item and is
  // referenced by that name from the docs, the registry index page and the tests.
  // Two items sharing a name is not a cosmetic clash: each item is published as
  // `r/<name>.json`, so the second write silently replaced the first and the URL
  // the documentation tells consumers to install resolved to the wrong thing.
  {
    dir: join(SRC, 'components', 'theme'),
    group: 'theme',
    self: true,
    slug: 'theming',
  },
  { dir: join(SRC, 'components', 'motion'), group: 'motion', self: true },
]
const PUBLIC_R = join(PACKAGE_ROOT, 'public', 'r')
const REGISTRY_PATH = join(PACKAGE_ROOT, 'registry.json')
const LIB_SRC = join(SRC, 'lib')
/** Where a copied `lib` module lands in a consumer's project. */
const LIB_TARGET_DIR = 'lib'
/** The item name the private helpers are published under. */
const LIB_ITEM_NAME = 'lib'

const packageJson = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
  name: string
  version: string
  dependencies: Record<string, string>
}

type RegistryItemType = 'registry:ui' | 'registry:lib' | 'registry:style'

type RegistryItem = {
  name: string
  type: RegistryItemType
  title: string
  description: string
  dependencies: string[]
  registryDependencies: string[]
  files: { path: string; type: RegistryItemType; target: string }[]
}

type ComponentFolder = { slug: string; dir: string; group: string; self: boolean }

/** Every folder under a component root that has an `index.ts`, keyed by slug. */
function findComponentFolders(): ComponentFolder[] {
  const found: ComponentFolder[] = []

  for (const root of COMPONENT_ROOTS) {
    // A root that carries its own index is a single component, not a group of
    // them — and its target has no group segment.
    if (root.self) {
      found.push({ slug: root.slug ?? root.group, dir: root.dir, group: root.group, self: true })
      continue
    }
    for (const entry of readdirSync(root.dir).toSorted()) {
      const dir = join(root.dir, entry)
      if (!statSync(dir).isDirectory()) continue
      // A folder without an index is not a public item; it is a private helper.
      if (!readdirSync(dir).includes('index.ts')) continue
      found.push({ slug: entry, dir, group: root.group, self: false })
    }
  }

  return found
}

/** Source files of a component, excluding the files the registry does not ship. */
function componentFiles(dir: string): string[] {
  const files: string[] = []

  const walk = (current: string) => {
    for (const entry of readdirSync(current).toSorted()) {
      const path = join(current, entry)
      if (statSync(path).isDirectory()) {
        if (entry === '__screenshots__') continue
        walk(path)
        continue
      }
      // Stories and MDX are the workshop's, not the consumer's: copying them
      // into someone's project would ship our documentation as their source.
      if (entry.endsWith('.stories.tsx') || entry.endsWith('.stories.ts')) continue
      if (entry.endsWith('.mdx')) continue
      // Tests are the same: a consumer wants the component, not our assertions
      // about it, and `bun:test` is not a dependency they agreed to.
      if (/\.test\.(ts|tsx)$/.test(entry)) continue
      if (!/\.(ts|tsx)$/.test(entry)) continue
      files.push(path)
    }
  }

  walk(dir)
  return files
}

const IMPORT_RE = /(?:^|\n)\s*import\s[^'"]*['"]([^'"]+)['"]/g

/**
 * What an item needs in order to be installed anywhere.
 *
 * Two different things are collected from the same import list, and conflating
 * them is how a registry ends up shipping a component that fails to compile in
 * a fresh project:
 *
 *   - a **bare specifier** is an npm dependency, and has to appear in the
 *     package's own `dependencies` or the registry is claiming something the
 *     package does not declare;
 *   - a **relative import that leaves the item's folder** is a cross-item
 *     dependency, and has to resolve to another item or the consumer gets a
 *     file that imports a path that will not exist.
 */
function analyseImports(files: string[], dir: string) {
  const npm = new Set<string>()
  const crossFolder = new Set<string>()
  const internal = new Set<string>()

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(IMPORT_RE)) {
      const specifier = match[1] ?? ''

      if (!specifier.startsWith('.') && !specifier.startsWith('#')) {
        // `@kobalte/core/popover` is the package `@kobalte/core`.
        const name = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : (specifier.split('/')[0] ?? specifier)
        npm.add(name)
        continue
      }

      if (specifier.startsWith('#')) {
        // `#lib/utils` is this package's private `imports` map. It resolves inside
        // the package and nowhere else, so it cannot be shipped as-is: a consumer
        // receives a file whose bundler cannot read it, and the error surfaces in
        // their app rather than in the install. It is recorded here and rewritten on
        // the way out, and the `lib` item below is what it is rewritten to point at.
        if (specifier.startsWith('#lib/')) internal.add(specifier.slice('#lib/'.length))
        continue
      }

      const resolved = resolve(dirname(file), specifier)
      if (!resolved.startsWith(dir)) {
        // Walk back to the component folder this import reaches into.
        const fromComponents = relative(join(SRC, 'components'), resolved)
        crossFolder.add(fromComponents)
      }
    }
  }

  return { npm, crossFolder, internal }
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * The one-line description of an item comes from its index file's header
 * comment, so the registry entry and the documentation cannot disagree about
 * what a component is for.
 */
function descriptionOf(dir: string): string {
  const index = readFileSync(join(dir, 'index.ts'), 'utf8')
  const comment = /\/\*\*([\s\S]*?)\*\//.exec(index)
  if (!comment) return ''
  return (comment[1] ?? '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
}

function buildItems() {
  const folders = findComponentFolders()

  const items: RegistryItem[] = folders.map((folder) => {
    const files = componentFiles(folder.dir)
    const { npm, crossFolder, internal } = analyseImports(files, folder.dir)

    // A cross-folder import is reported by *folder identity*, not by picking a
    // directory name out of the path. The previous version searched for `ui` and
    // fell back to `layout`, so an import reaching `composites/`, `conversation/`,
    // `theme` or `motion` produced no match, was dropped, and the item shipped with
    // a dependency it silently needed — the exact failure `registry.test.ts` claims
    // to rule out. Matching against the known folders means an unrecognised path is
    // a hard error instead of a quiet omission.
    const registryDependencies = [...crossFolder]
      .map((path) => {
        const owner = folders.find((candidate) =>
          path.startsWith(relative(join(SRC, 'components'), candidate.dir))
        )
        if (!owner) {
          throw new Error(
            `${folder.slug} imports ${path}, which is inside components/ but is not a component folder. ` +
              'A registry consumer would receive the import with no item to satisfy it.'
          )
        }
        return `@adea-ai/ui/${owner.slug}`
      })
      .filter((value) => !value.endsWith(`/${folder.slug}`))

    // Anything reaching for `#lib/*` needs the `lib` item, or the copied file is
    // dead on arrival.
    if (internal.size > 0) registryDependencies.push(LIB_ITEM_NAME)

    return {
      name: folder.slug,
      type: 'registry:ui' as const,
      title: titleCase(folder.slug),
      description: descriptionOf(folder.dir),
      dependencies: [...npm]
        .filter((name) => name !== 'solid-js')
        .map((name) =>
          packageJson.dependencies[name] ? `${name}@${packageJson.dependencies[name]}` : name
        )
        .toSorted(),
      registryDependencies: [...new Set(registryDependencies)].toSorted(),
      files: files.map((file) => ({
        path: relative(PACKAGE_ROOT, file),
        type: 'registry:ui' as const,
        target: folder.self
          ? `components/${folder.slug}/${file.split('/').at(-1)}`
          : `components/${folder.group}/${folder.slug}/${file.split('/').at(-1)}`,
      })),
    }
  })

  return items
}

/**
 * The styles are an item too, because a component copied into someone's project
 * is useless without the tokens it references. One item, so a consumer installs
 * the theme once rather than per component.
 */
function styleItem(): RegistryItem {
  return {
    name: 'theme',
    type: 'registry:style',
    title: 'Adea theme',
    description:
      'The design tokens: the semantic palette in OKLCH, the type and control scales, shells geometry, shadows, motion and the z-index stack.',
    // Derived rather than listed: the typefaces the stylesheet imports are the
    // ones the manifest declares, and a hard-coded pair here is how the registry
    // kept shipping two families the package had already stopped depending on.
    dependencies: [
      ...Object.keys(packageJson.dependencies)
        .filter((name) => name.startsWith('@fontsource-variable/'))
        .toSorted()
        .map((name) => `${name}@${packageJson.dependencies[name]}`),
      `tw-animate-css@${packageJson.dependencies['tw-animate-css']}`,
    ],
    registryDependencies: [],
    files: ['globals.css', 'theme.css', 'base.css', 'fonts.css'].map((file) => ({
      path: `src/styles/${file}`,
      type: 'registry:style',
      target: `styles/${file}`,
    })),
  }
}

/**
 * The private helpers, as an item.
 *
 * Every component imports `cn`, `cva` and the token manifest through `#lib/*`,
 * which is this package's own `imports` map. A consumer's project has no such
 * entry, so without this item a copied component references a module that does not
 * exist in their tree. It is one item rather than seven so a consumer installs the
 * helpers once, the way the theme is one item rather than one per stylesheet.
 */
function libItem(): RegistryItem {
  const files = libFiles()
  return {
    name: LIB_ITEM_NAME,
    type: 'registry:lib' as unknown as RegistryItem['type'],
    title: 'Class-name and token helpers',
    description:
      'The private helpers the components import: the class-name merge, the variant recipes, the token manifest and the theme bridge. Installed automatically as a peer of any component that needs it.',
    dependencies: ['clsx', 'tailwind-merge', 'class-variance-authority', '@adea-ai/themes']
      .filter((name) => packageJson.dependencies[name])
      .toSorted()
      .map((name) => `${name}@${packageJson.dependencies[name]}`),
    registryDependencies: [],
    files: files.map((file) => ({
      path: relative(PACKAGE_ROOT, file),
      type: 'registry:lib' as unknown as RegistryItem['type'],
      target: `${LIB_TARGET_DIR}/${file.split('/').at(-1)}`,
    })),
  }
}

/** The `lib` modules a consumer can receive. Tests are not source they need. */
function libFiles(): string[] {
  return readdirSync(LIB_SRC)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .toSorted()
    .map((name) => join(LIB_SRC, name))
}

/**
 * `#lib/x` → the relative specifier that reaches `lib/x` from a given target.
 *
 * The extension is dropped because a consumer's `tsconfig` resolves the `.ts`; the
 * separators are forced to POSIX because the import is written into a file the CLI
 * writes on a consumer's machine, which may not be this one.
 */
function rewrittenSpecifier(target: string, module: string): string {
  const from = posix.dirname(target.split(/[\\/]/).join('/'))
  const to = `${LIB_TARGET_DIR}/${module}`
  const path = posix.relative(from, to).replace(/\.ts$/, '')
  return path.startsWith('.') ? path : `./${path}`
}

/**
 * The file the registry serves for a source file.
 *
 * Identical to the source except for the `#lib/*` rewrite, and the difference is
 * asserted to be only that — a served tree that drifts from `src` in any other way
 * is a file no reviewer has read.
 */
function servedSource(file: string, target: string): string {
  return readFileSync(file, 'utf8').replace(
    /(['"])#lib\/([\w.-]+)\1/g,
    (_match, quote: string, module: string) =>
      `${quote}${rewrittenSpecifier(target, module)}${quote}`
  )
}

/**
 * Write the tree the payloads point at.
 *
 * Under `public/r/`, so a payload's `files[].path` — which the CLI resolves against
 * the registry's own base URL — lands on a file that exists, and the publish step
 * needs to copy one directory rather than construct a second copy of the source.
 */
function writeServedTree(items: RegistryItem[]): string[] {
  const written: string[] = []
  for (const item of items) {
    for (const file of item.files) {
      const source = join(PACKAGE_ROOT, file.path)
      if (!existsSync(source)) continue
      const destination = join(PUBLIC_R, file.path)
      mkdirSync(dirname(destination), { recursive: true })
      writeFileSync(destination, servedSource(source, file.target))
      written.push(file.path)
    }
  }
  return written.toSorted()
}

export const registryItems = [...buildItems(), styleItem(), libItem()]

export const registry = {
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  name: packageJson.name,
  homepage: 'https://github.com/adea-ai/ui',
  items: registryItems,
}

export const packageRoot = PACKAGE_ROOT
export const registryPath = REGISTRY_PATH
export const publicRegistryDir = PUBLIC_R
export { writeServedTree, servedSource, libFiles, LIB_ITEM_NAME, LIB_TARGET_DIR }
export type { RegistryItem }
