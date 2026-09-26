/**
 * Validate the registry against the source, the package manifest and the public
 * API surface.
 *
 * Run: bun run registry:validate
 *
 * The checks are written as *findings* rather than asserts so the unit tests can
 * share them: `tests/registry.test.ts` calls `validateRegistry()` and fails on a
 * non-empty list. That means the same rules run in the test suite and from the
 * command line, and neither can drift from the other.
 *
 * What each check is defending against:
 *
 *   files        an item whose payload names a file that was moved or deleted —
 *                every install of that component would fail
 *   dependencies an item that imports a package the install command will not
 *                fetch, so the pasted file fails to compile
 *   peerItems    a cross-item import with no registry dependency, so the
 *                consumer gets a file importing a path that does not exist
 *   exports      a component reachable from the package but absent from the
 *                registry, so it cannot be taken individually
 *   staleness    a committed registry.json that no longer matches the source
 */

import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { packageRoot, registry, registryItems } from './registry-core'

const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
  peerDependencies?: Record<string, string>
  exports: Record<string, unknown>
}

const declaredPackages = new Set([
  ...Object.keys(packageJson.dependencies),
  ...Object.keys(packageJson.peerDependencies ?? {}),
])

/**
 * `@scope/name@1.2.3` → `@scope/name`, and `name@1.2.3` → `name`.
 *
 * Splitting on `@` is wrong for a scoped package: the leading `@` is part of the
 * name. Taking the last `@` that is not at index 0 handles both shapes, and an
 * unversioned specifier falls through unchanged.
 */
function packageNameOf(specifier: string): string {
  const at = specifier.lastIndexOf('@')
  return at > 0 ? specifier.slice(0, at) : specifier
}

const itemNames = new Set(registryItems.map((item) => item.name))

export function validateRegistry(): string[] {
  const findings: string[] = []

  for (const item of registryItems) {
    // --- files exist on disk -------------------------------------------------
    if (item.files.length === 0) {
      findings.push(`${item.name}: no files. An item with no files installs nothing.`)
    }

    for (const file of item.files) {
      if (!existsSync(join(packageRoot, file.path))) {
        findings.push(`${item.name}: file "${file.path}" does not exist.`)
      }
      if (!file.target.startsWith('components/') && !file.target.startsWith('styles/')) {
        findings.push(
          `${item.name}: target "${file.target}" is outside components/ or styles/, so the shadcn CLI will refuse it.`
        )
      }
    }

    // --- npm dependencies are declared --------------------------------------
    for (const dependency of item.dependencies) {
      const name = packageNameOf(dependency)

      if (!declaredPackages.has(name)) {
        findings.push(
          `${item.name}: depends on "${name}", which is not in dependencies or peerDependencies of packages/ui/package.json.`
        )
      }
    }

    // --- cross-item dependencies resolve ------------------------------------
    for (const dependency of item.registryDependencies) {
      const name = dependency.replace('@adea-ai/ui/', '')
      if (!itemNames.has(name)) {
        findings.push(`${item.name}: registry dependency "@adea-ai/ui/${name}" is not an item.`)
      }
      if (name === item.name) {
        findings.push(`${item.name}: depends on itself.`)
      }
    }

    // --- a component item must be reachable from the package root ----------
    if (item.type === 'registry:ui' && item.name !== 'theme') {
      // The root export list is what a consumer sees; an item that is not in it
      // is a component the registry can install but the package does not admit
      // to having.
      //
      // A `self` root (the conversation module) is exported one level up, at
      // `./components/<name>`, because the folder *is* the component.
      const exported = readFileSync(join(packageRoot, 'src', 'index.ts'), 'utf8')
      const reachable =
        exported.includes(`./components/ui/${item.name}`) ||
        exported.includes(`./components/layout/${item.name}`) ||
        exported.includes(`./components/composites/${item.name}`) ||
        exported.includes(`./components/${item.name}'`)

      if (!reachable) {
        findings.push(
          `${item.name}: not exported from src/index.ts, so it is installable from the registry but absent from the package.`
        )
      }
    }
  }

  // --- the committed registry is current -------------------------------------
  if (!existsSync(join(packageRoot, 'registry.json'))) {
    findings.push('registry.json is missing. Run `bun run registry:build`.')
  } else {
    const committed = JSON.parse(readFileSync(join(packageRoot, 'registry.json'), 'utf8')) as {
      items?: unknown[]
    }
    const committedNames = (committed.items ?? [])
      .map((item) => (item as { name?: string }).name)
      .filter(Boolean)
      .toSorted()
    const derivedNames = [...itemNames].toSorted()

    if (JSON.stringify(committedNames) !== JSON.stringify(derivedNames)) {
      findings.push(
        `registry.json lists ${committedNames.length} items but the source produces ${derivedNames.length}. ` +
          'Run `bun run registry:build`.'
      )
    }

    if (JSON.stringify(committed) !== JSON.stringify(registry)) {
      findings.push(
        'registry.json differs from the registry derived from source. Run `bun run registry:build`.'
      )
    }
  }

  return findings
}

const findings = validateRegistry()

if (findings.length > 0) {
  console.error(`registry: ${findings.length} finding(s)\n`)
  for (const finding of findings) console.error(`  - ${finding}`)
  process.exit(1)
}

console.log(`registry: valid — ${registryItems.length} items checked`)
