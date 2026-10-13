/**
 * The published-exports gate.
 *
 * Every module the package `exports` map publishes must export, at runtime,
 * exactly the values its declaration file declares. `tsc` writes the `.d.ts`
 * files from source, but the JavaScript comes from a separate Rollup build whose
 * `preserveModules` output drops any export of a non-entry module that no other
 * bundled module imports. The result is a package whose types promise
 * `colorToHex` and whose runtime does not have it: TypeScript accepts the import
 * and Node or Bun fails on it, in the consumer.
 *
 * Reads `dist/` after `bun run build`; like `pack:check`, it does not build.
 * Run: bun run --cwd packages/ui check:lib-exports
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { readModuleExports } from './module-exports'
import { diffExports, publishedModules, type ExportsMap } from './package-exports'

const packageRoot = resolve(import.meta.dirname, '..')
const manifest: { name: string; exports: ExportsMap } = JSON.parse(
  readFileSync(resolve(packageRoot, 'package.json'), 'utf8')
)

if (!existsSync(resolve(packageRoot, 'dist'))) {
  console.error('check:lib-exports — dist/ is absent. Run `bun run build` first.')
  process.exit(1)
}

const modules = publishedModules(
  manifest.exports,
  readdirSync(resolve(packageRoot, 'src'), { recursive: true }).map(String)
)
const failures: string[] = []
const present = modules.filter((module) => {
  const missing = [module.types, module.runtime].filter(
    (file) => !existsSync(resolve(packageRoot, file))
  )
  for (const file of missing) failures.push(`${module.specifier}: ${file} is missing from dist`)
  return missing.length === 0
})

const { declared, runtime } = readModuleExports(
  present.map((module) => resolve(packageRoot, module.types)),
  present.map((module) => resolve(packageRoot, module.runtime))
)

for (const module of present) {
  const diff = diffExports(
    declared.get(resolve(packageRoot, module.types)) ?? [],
    runtime.get(resolve(packageRoot, module.runtime)) ?? []
  )
  if (diff.missingAtRuntime.length > 0)
    failures.push(
      `${manifest.name}/${module.specifier.slice(2)} declares but does not export: ${diff.missingAtRuntime.join(', ')} (${module.runtime})`
    )
  if (diff.undeclared.length > 0)
    failures.push(
      `${manifest.name}/${module.specifier.slice(2)} exports but does not declare: ${diff.undeclared.join(', ')} (${module.types})`
    )
}

if (failures.length > 0) {
  console.error(
    `check:lib-exports — ${failures.length} published module(s) disagree with their types:`
  )
  for (const failure of failures) console.error(`  - ${failure}`)
  console.error(
    '\nA module published through package.json "exports" must be a library entry in vite.config.ts; the entries are derived from the exports map (scripts/package-exports.ts), so check the map and the build output.'
  )
  process.exit(1)
}

console.log(
  `check:lib-exports — ${present.length} published modules export exactly what their declarations list.`
)
