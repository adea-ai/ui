import { test, expect } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('runtime identity fingerprints executable bytes behind transparent launchers', async () => {
  const { identity } = await import('../scripts/orch-toolchain.mjs')
  const { chmodSync, symlinkSync } = await import('node:fs')
  const root = mkdtempSync(join(tmpdir(), 'ui-runtime-identity-'))
  const direct = join(root, 'direct')
  const wrapped = join(root, 'wrapped')
  for (const directory of [direct, wrapped]) mkdirSync(directory)
  try {
    for (const name of ['node', 'bun']) {
      symlinkSync(process.execPath, join(direct, name))
      const launcher = join(wrapped, name)
      writeFileSync(
        launcher,
        `#!/bin/sh\nexec '${process.execPath.replaceAll("'", "'\\''")}' "$@"\n`
      )
      chmodSync(launcher, 0o755)
    }
    const a = identity({ root, searchPath: direct })
    const b = identity({ root, searchPath: wrapped })
    expect(b).toEqual(a)
    const { createHash } = await import('node:crypto')
    const digest = createHash('sha256').update(readFileSync(process.execPath)).digest('hex')
    expect(b.bun.sha256).toBe(digest)
    expect(b.node.sha256).toBe(digest)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
