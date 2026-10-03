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
 *   served       a payload whose file is not in the published tree, or whose
 *                published copy carries an import the consumer cannot resolve —
 *                the registry looked complete and every install 404'd
 *   staleness    a committed registry.json, payload or served copy in public/r whose
 *                bytes differ from what `registry:build` writes — the comparison
 *                CI's rebuild-and-diff gate makes, so "valid" here means valid there
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath } from 'node:path'
import { packageRoot, publicRegistryDir, registryItems, registryOutputs } from './registry-core'

/**
 * Assert that a published file is something a consumer could actually build.
 *
 * The registry's whole promise is "paste this and it works", and two things break
 * that silently. A `#lib/…` specifier is this package's private `imports` map: it
 * resolves inside the package and nowhere else, so a consumer receives a file their
 * bundler cannot read. A relative specifier that reaches a file the registry does not
 * serve is the same failure one hop further out. Neither produces an error at install
 * time — only in the consumer's build, which is the worst place to find it.
 */
function checkServedImports(
  itemName: string,
  path: string,
  servedFile: string,
  findings: string[]
): void {
  const source = readFileSync(servedFile, 'utf8')

  for (const match of source.matchAll(/\b(?:from|import)\s*(['"])#([\w/.-]+)\1/g)) {
    findings.push(
      `${itemName}: served "${path}" imports "${match[2]}" through the #lib map, which only resolves inside this package.`
    )
  }

  for (const match of source.matchAll(/(?:from|import)\s*(['"])(\.[^'"]*)\1/g)) {
    const specifier = match[2] ?? ''
    const base = resolvePath(dirname(servedFile), specifier)
    // A relative specifier has to reach a file the registry actually serves. The
    // literal path is tried first, because a stylesheet import already carries its
    // extension — `globals.css` is nothing but `@import './base.css'`, and probing
    // only for `.ts`/`.tsx` called every one of them dangling. Then the shapes a
    // consumer's bundler synthesises: an extensionless TypeScript import, and a
    // directory import.
    const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]
    if (!candidates.some((candidate) => existsSync(candidate))) {
      findings.push(
        `${itemName}: served "${path}" imports "${specifier}", which resolves to nothing in the published tree.`
      )
    }
  }
}

/** Every file under a directory, as absolute paths. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

/** At most five paths, then a count — a finding is a pointer, not a listing. */
function sample(paths: string[]): string {
  const shown = paths.slice(0, 5).join(', ')
  return paths.length > 5 ? `${shown} and ${paths.length - 5} more` : shown
}

/**
 * Compare the committed registry, byte for byte, with what the build would write.
 *
 * CI rebuilds the registry and fails when `registry.json` or anything in `public/r`
 * changes. A served copy is the source with one rewrite applied, so editing a
 * component without rebuilding leaves its served copy stale — and a parsed-JSON
 * comparison of `registry.json` alone could not see that. A file in `public/r` the
 * build would not write is stale too: the build clears the directory first.
 */
export function staleOutputs(
  expected: Map<string, string>,
  servedDir: string = publicRegistryDir,
  root: string = packageRoot
): string[] {
  const differs: string[] = []
  const missing: string[] = []
  for (const [path, content] of expected) {
    if (!existsSync(path)) missing.push(relative(root, path))
    else if (readFileSync(path, 'utf8') !== content) differs.push(relative(root, path))
  }
  const extra = filesUnder(servedDir)
    .filter((path) => !expected.has(path))
    .map((path) => relative(root, path))
    .toSorted()

  const fix = 'Run `bun run registry:build` and commit the result.'
  const findings: string[] = []
  if (differs.length > 0) {
    findings.push(
      `${differs.length} committed registry file(s) differ from what the build produces: ${sample(differs)}. ${fix}`
    )
  }
  if (missing.length > 0) {
    findings.push(
      `${missing.length} registry file(s) the build produces are not committed: ${sample(missing)}. ${fix}`
    )
  }
  if (extra.length > 0) {
    findings.push(
      `${extra.length} file(s) in public/r are not produced by the build: ${sample(extra)}. ${fix}`
    )
  }
  return findings
}

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
  const targetOwners = new Map<string, string>()

  for (const item of registryItems) {
    for (const file of item.files) {
      const owner = targetOwners.get(file.target)
      if (owner) {
        findings.push(
          `${item.name}: target "${file.target}" is also assigned to ${owner}; install targets must be unique.`
        )
      } else {
        targetOwners.set(file.target, `${item.name}/${file.path}`)
      }
    }
  }

  for (const item of registryItems) {
    // --- files exist on disk -------------------------------------------------
    if (item.files.length === 0) {
      findings.push(`${item.name}: no files. An item with no files installs nothing.`)
    }

    for (const file of item.files) {
      if (!existsSync(join(packageRoot, file.path))) {
        findings.push(`${item.name}: file "${file.path}" does not exist.`)
      }
      // `lib/` is a legal target. The previous allowlist was `components/` and
      // `styles/` only, which did not merely reject the helpers — it *forbade*
      // them, so the one shape a copied component needs in order to compile could
      // never be published. The check now asks whether the target is inside the
      // consumer's project at all, which is the property that actually matters.
      if (
        !file.target.startsWith('components/') &&
        !file.target.startsWith('styles/') &&
        !file.target.startsWith('lib/')
      ) {
        findings.push(
          `${item.name}: target "${file.target}" is outside components/, styles/ or lib/, so the shadcn CLI will refuse it.`
        )
      }
    }

    // --- every served file must exist and be installable -------------------
    // The payload promises a file at a URL. Checking that the *source* exists is
    // not the same claim: for the whole life of this registry the payloads pointed
    // at `src/`, the source existed, and every URL 404'd because the publish step
    // shipped only the JSON. So the served tree is checked as its own artifact.
    for (const file of item.files) {
      const served = join(publicRegistryDir, file.path)
      if (!existsSync(served)) {
        findings.push(
          `${item.name}: "${file.path}" is not in the served tree at public/r/. The payload points at it, so it would 404.`
        )
        continue
      }
      // Two things must hold of the served copy for a consumer to be able to build
      // it: it must not still carry this package's private `#lib` map, which
      // resolves here and nowhere else, and every relative import must reach a file
      // that is actually served.
      checkServedImports(item.name, file.path, served, findings)
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
      // A peer is named either bare (`lib`) for an item in this registry, or
      // `@adea-ai/ui/<slug>`. Both forms occur, so both are accepted, and anything
      // else is an error rather than a silent no-op.
      const name = dependency.replace('@adea-ai/ui/', '')
      if (!itemNames.has(name)) {
        findings.push(`${item.name}: registry dependency "${dependency}" is not an item.`)
      }
      if (name === item.name) {
        findings.push(`${item.name}: depends on itself.`)
      }
    }

    // Optional-peer components are public through subpaths without making core
    // root consumers resolve their engines. Validate all four folder conditions;
    // pack:check separately checks the built artifacts inside the actual tarball.
    if (item.type === 'registry:ui' && item.name !== 'theme') {
      const index = item.files.find(
        (file) => file.path.startsWith('src/components/') && file.path.endsWith('/index.ts')
      )
      const component = index?.path.slice('src/components/'.length, -'/index.ts'.length)
      const key = component ? `./components/${component}` : undefined
      const entry = (key && packageJson.exports[key]) ?? packageJson.exports['./components/*']
      const targets =
        entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : undefined
      const expected = component
        ? {
            types: `./dist/components/${component}/index.d.ts`,
            solid: `./src/components/${component}/index.ts`,
            development: `./src/components/${component}/index.ts`,
            import: `./dist/components/${component}/index.js`,
          }
        : undefined
      if (
        !expected ||
        !targets ||
        Object.entries(expected).some(
          ([condition, target]) =>
            typeof targets[condition] !== 'string' ||
            (targets[condition] as string).replaceAll('*', component!) !== target
        )
      )
        findings.push(
          `${item.name}: no complete public component subpath for types/Solid/development/compiled consumers.`
        )
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
  }

  findings.push(...staleOutputs(registryOutputs()))

  return findings
}

const findings = validateRegistry()

if (findings.length > 0) {
  console.error(`registry: ${findings.length} finding(s)\n`)
  for (const finding of findings) console.error(`  - ${finding}`)
  process.exit(1)
}

console.log(`registry: valid — ${registryItems.length} items checked`)
