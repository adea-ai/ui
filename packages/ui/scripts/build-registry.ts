/**
 * Write the shadcn registry: the item catalogue and one payload per item.
 *
 * Run: bun run registry:build
 *
 * The derivation lives in `registry-core.ts`, which the validator runs too — so
 * the committed output is checked rather than trusted.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  publicRegistryDir,
  registry,
  registryItems,
  registryPath,
  writeServedTree,
} from './registry-core'

writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)

rmSync(publicRegistryDir, { recursive: true, force: true })
mkdirSync(publicRegistryDir, { recursive: true })
for (const item of registryItems) {
  writeFileSync(join(publicRegistryDir, `${item.name}.json`), `${JSON.stringify(item, null, 2)}\n`)
}
writeFileSync(join(publicRegistryDir, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`)

// The payloads point at files, so the files have to exist before the payloads are
// worth anything. A payload whose `files[].path` 404s is a registry that appears to
// work and installs nothing, which is the state this repository was in.
const served = writeServedTree(registryItems)

const withDeps = registryItems.filter((item) => item.dependencies.length > 0).length
const withPeers = registryItems.filter((item) => item.registryDependencies.length > 0).length

console.log(
  `registry: ${registryItems.length} items (${withDeps} with npm dependencies, ${withPeers} with a peer item)`
)
console.log(`  ${relative(process.cwd(), registryPath)}`)
console.log(
  `  ${relative(process.cwd(), publicRegistryDir)}/ (${registryItems.length} payloads + ${served.length} served files)`
)
