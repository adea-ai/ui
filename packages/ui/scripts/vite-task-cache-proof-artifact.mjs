// Writes a deterministic, seed-dependent output tree for the `proof:artifact` task, so the
// cache proof can tell a correct restored output from a stale or truncated one. The seed is
// the declared `PROOF_TOOLCHAIN` variable. About 3 MB across nine files, no network, no input.
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

const seed = process.env.PROOF_TOOLCHAIN ?? ''
const dir = 'packages/ui/.proof-artifact'
mkdirSync(dir, { recursive: true })

let block = createHash('sha256').update(seed).digest()
const chunks = []
for (let index = 0; index < 96_000; index += 1) {
  block = createHash('sha256').update(block).digest()
  chunks.push(block)
}
writeFileSync(`${dir}/payload.bin`, Buffer.concat(chunks))
for (let part = 0; part < 8; part += 1) {
  writeFileSync(
    `${dir}/part-${part}.txt`,
    `${seed}:${part}:${createHash('sha256').update(`${seed}${part}`).digest('hex')}\n`
  )
}
