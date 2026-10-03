/**
 * Write the shadcn registry: the item catalogue and one payload per item.
 *
 * Run: bun run registry:build
 *
 * The derivation lives in `registry-core.ts`, which the validator runs too — so
 * the committed output is checked rather than trusted.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'
import { publicRegistryDir, registryItems, registryOutputs, registryPath } from './registry-core'

// One map of path → bytes is both what this writes and what `registry:validate`
// compares the committed tree with, so the two cannot disagree about a file.
//
// The payloads point at files, so the files have to exist before the payloads are
// worth anything. A payload whose `files[].path` 404s is a registry that appears to
// work and installs nothing, which is the state this repository was in.
const outputs = registryOutputs()

rmSync(publicRegistryDir, { recursive: true, force: true })
for (const [path, content] of outputs) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}
const served = [...outputs.keys()].filter(
  (path) => path !== registryPath && !path.endsWith('.json')
)

const withDeps = registryItems.filter((item) => item.dependencies.length > 0).length
const withPeers = registryItems.filter((item) => item.registryDependencies.length > 0).length

console.log(
  `registry: ${registryItems.length} items (${withDeps} with npm dependencies, ${withPeers} with a peer item)`
)
console.log(`  ${relative(process.cwd(), registryPath)}`)
console.log(
  `  ${relative(process.cwd(), publicRegistryDir)}/ (${registryItems.length} payloads + ${served.length} served files)`
)
