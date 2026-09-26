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
 * Outputs, both committed so a consumer can read the registry from the
 * repository without building anything:
 *
 *   packages/ui/registry.json     the item catalogue, in shadcn's schema
 *   packages/ui/public/r/*.json   one payload per item, plus the index
 *
 * Run: bun run registry:build
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
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
const COMPONENT_ROOTS: readonly { dir: string; group: string; self?: boolean }[] = [
  { dir: join(SRC, 'components', 'ui'), group: 'ui' },
  { dir: join(SRC, 'components', 'layout'), group: 'layout' },
  { dir: join(SRC, 'components', 'composites'), group: 'composites' },
  { dir: join(SRC, 'components', 'conversation'), group: 'conversation', self: true },
]
const PUBLIC_R = join(PACKAGE_ROOT, 'public', 'r')
const REGISTRY_PATH = join(PACKAGE_ROOT, 'registry.json')

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
      found.push({ slug: root.group, dir: root.dir, group: root.group, self: true })
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

      if (specifier.startsWith('#')) continue

      const resolved = resolve(dirname(file), specifier)
      if (!resolved.startsWith(dir)) {
        // Walk back to the component folder this import reaches into.
        const fromComponents = relative(join(SRC, 'components'), resolved)
        crossFolder.add(fromComponents)
      }
    }
  }

  return { npm, crossFolder }
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

  // A slug → item-name map, so a cross-folder import can be reported as a
  // registry dependency by name rather than by path.
  const slugByPrefix = new Map(folders.map((folder) => [folder.slug, folder.slug]))

  const items: RegistryItem[] = folders.map((folder) => {
    const files = componentFiles(folder.dir)
    const { npm, crossFolder } = analyseImports(files, folder.dir)

    const registryDependencies = [...crossFolder]
      .map((path) => {
        // .../ui/button/button -> the item is the folder name after the group.
        const parts = path.split('/')
        const groupIndex =
          parts.lastIndexOf('ui') >= 0 ? parts.lastIndexOf('ui') : parts.lastIndexOf('layout')
        const candidate = parts[groupIndex + 1] ?? ''
        return slugByPrefix.has(candidate) ? `@adea-ai/ui/${candidate}` : undefined
      })
      .filter((value): value is string => Boolean(value) && !value?.endsWith(`/${folder.slug}`))

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

export const registryItems = [...buildItems(), styleItem()]

export const registry = {
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  name: packageJson.name,
  homepage: 'https://github.com/adea-ai/ui',
  items: registryItems,
}

export const packageRoot = PACKAGE_ROOT
export const registryPath = REGISTRY_PATH
export const publicRegistryDir = PUBLIC_R
export type { RegistryItem }
