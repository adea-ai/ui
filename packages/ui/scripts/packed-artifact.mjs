import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

export function sharedPackedUiArchive(environment = process.env) {
  const archivePath = environment.ADEA_PACKED_UI_TARBALL
  const expectedSha256 = environment.ADEA_PACKED_UI_SHA256

  if (archivePath === undefined && expectedSha256 === undefined) return null
  if (!archivePath || !expectedSha256)
    throw new Error('Shared packed UI archive requires both path and SHA-256 digest')
  if (!/^[a-f0-9]{64}$/.test(expectedSha256))
    throw new Error('Shared packed UI archive SHA-256 digest is malformed')

  const resolvedPath = resolve(archivePath)
  if (!existsSync(resolvedPath) || !statSync(resolvedPath).isFile())
    throw new Error(`Shared packed UI archive does not exist: ${resolvedPath}`)

  const actualSha256 = createHash('sha256').update(readFileSync(resolvedPath)).digest('hex')
  if (actualSha256 !== expectedSha256)
    throw new Error(
      `Shared packed UI archive digest mismatch: expected ${expectedSha256}, received ${actualSha256}`
    )

  return resolvedPath
}
