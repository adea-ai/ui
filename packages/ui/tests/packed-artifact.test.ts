import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { sharedPackedUiArchive } from '../scripts/packed-artifact.mjs'

function withArchive(callback: (archive: string, digest: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'adea-packed-artifact-test-'))
  try {
    const archive = join(directory, 'package.tgz')
    const bytes = Buffer.from('verified package fixture')
    writeFileSync(archive, bytes)
    callback(archive, createHash('sha256').update(bytes).digest('hex'))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('packed checks keep local npm-pack behavior when no shared archive is configured', () => {
  expect(sharedPackedUiArchive({})).toBeNull()
})

test('accepts only the shared archive with the expected SHA-256 digest', () => {
  withArchive((archive, digest) => {
    expect(
      sharedPackedUiArchive({ ADEA_PACKED_UI_TARBALL: archive, ADEA_PACKED_UI_SHA256: digest })
    ).toBe(archive)
  })
})

test('rejects an incomplete shared-archive configuration', () => {
  expect(() => sharedPackedUiArchive({ ADEA_PACKED_UI_TARBALL: '/tmp/package.tgz' })).toThrow(
    'requires both path and SHA-256 digest'
  )
})

test('rejects malformed and mismatched archive digests', () => {
  withArchive((archive) => {
    expect(() =>
      sharedPackedUiArchive({ ADEA_PACKED_UI_TARBALL: archive, ADEA_PACKED_UI_SHA256: 'sha256' })
    ).toThrow('digest is malformed')
    expect(() =>
      sharedPackedUiArchive({
        ADEA_PACKED_UI_TARBALL: archive,
        ADEA_PACKED_UI_SHA256: '0'.repeat(64),
      })
    ).toThrow('digest mismatch')
  })
})

test('rejects a missing archive even when its digest is well formed', () => {
  expect(() =>
    sharedPackedUiArchive({
      ADEA_PACKED_UI_TARBALL: '/tmp/adea-packed-archive-does-not-exist.tgz',
      ADEA_PACKED_UI_SHA256: '0'.repeat(64),
    })
  ).toThrow('does not exist')
})
