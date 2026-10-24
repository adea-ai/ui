import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expectedId, identity, idOf, UNIDENTIFIED, verify } from '../scripts/orch-toolchain.mjs'

const memoPath = (root: string) => join(root, 'node_modules', '.cache', 'orch-toolchain-memo.json')
const repositoryMemo = fileURLToPath(
  new URL('../../../node_modules/.cache/orch-toolchain-memo.json', import.meta.url)
)
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`

function runtime(directory: string, name: 'node' | 'bun', version: string, probe?: string) {
  mkdirSync(directory, { recursive: true })
  const executable = join(directory, name)
  writeFileSync(
    executable,
    `#!/bin/sh\ncase "$1" in\n--version) printf '%s\\n' ${quote(version)} ;;\n-p) printf '%s\\n' ${quote(probe ?? executable)} ;;\n*) exit 1 ;;\nesac\n`,
    { mode: 0o755 }
  )
  return executable
}

function fixture(run: (root: string, bin: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'ui-toolchain-behavior-'))
  const bin = join(root, 'bin')
  const previousPath = process.env.PATH
  const previousMemo = existsSync(repositoryMemo) ? readFileSync(repositoryMemo) : undefined
  try {
    runtime(bin, 'node', 'v24.18.0')
    runtime(bin, 'bun', '1.4.4')
    run(root, bin)
  } finally {
    if (previousPath === undefined) delete process.env.PATH
    else process.env.PATH = previousPath
    if (previousMemo === undefined) rmSync(repositoryMemo, { force: true })
    else writeFileSync(repositoryMemo, previousMemo)
    rmSync(root, { recursive: true, force: true })
  }
}

function output(run: () => number) {
  const messages: string[] = []
  const errors: string[] = []
  const previousLog = console.log
  const previousError = console.error
  try {
    console.log = (...values: unknown[]) => messages.push(values.map(String).join(' '))
    console.error = (...values: unknown[]) => errors.push(values.map(String).join(' '))
    return { status: run(), messages, errors }
  } finally {
    console.log = previousLog
    console.error = previousError
  }
}

test('cache identities are shell-safe and distinguish runtime versions and executable bytes', () => {
  const found = {
    platform: 'darwin-arm64',
    libc: 'na',
    node: { version: 'v24.18.0 build#2', sha256: '0123456789abcdef'.repeat(4) },
    bun: { version: '1.4.4+preview', sha256: 'fedcba9876543210'.repeat(4) },
  }
  expect(idOf(found)).toBe(
    'darwin-arm64.na.node24.18.0_build_2-0123456789ab.bun1.4.4_preview-fedcba987654'
  )
  expect(idOf(found)).toMatch(/^[A-Za-z0-9._-]+$/)
  expect(idOf({ ...found, bun: { ...found.bun, version: '1.4.5' } })).not.toBe(idOf(found))
  expect(idOf({ ...found, node: { ...found.node, sha256: 'f'.repeat(64) } })).not.toBe(idOf(found))
})

test('expected identities prefer workspace launchers and refuse unidentifiable runtimes', () => {
  fixture((root, bin) => {
    process.env.PATH = bin
    const workspaceBin = join(root, 'node_modules', '.bin')
    runtime(workspaceBin, 'node', 'v24.18.1')
    runtime(workspaceBin, 'bun', '1.4.5')
    const expected = expectedId(root)
    expect(expected).toContain('.node24.18.1-')
    expect(expected).toContain('.bun1.4.5-')
    expect(expected).not.toContain(root)

    writeFileSync(join(workspaceBin, 'bun'), '#!/bin/sh\nexit 7\n', { mode: 0o755 })
    expect(expectedId(root)).toBe(UNIDENTIFIED)
    expect(() => identity({ root, searchPath: workspaceBin })).toThrow('`bun --version` failed')

    process.env.PATH = ''
    expect(expectedId(join(root, 'missing'))).toBe(UNIDENTIFIED)
  })
})

test('runtime probes reject blank versions and paths that cannot identify an executable', () => {
  fixture((root, bin) => {
    runtime(bin, 'node', '')
    expect(() => identity({ root, searchPath: bin })).toThrow('`node --version` printed nothing')
    runtime(bin, 'node', 'v24.18.0', join(root, 'absent'))
    expect(() => identity({ root, searchPath: bin })).toThrow('`node` executable probe failed')
    expect(() => identity({ root, searchPath: '' })).toThrow('`node` is not on PATH')
  })
})

test('a damaged or unwritable hash memo cannot change the measured identity', () => {
  fixture((root, bin) => {
    const measured = identity({ root, searchPath: bin })
    const digest = createHash('sha256')
      .update(readFileSync(join(bin, 'bun')))
      .digest('hex')
    expect(measured.bun.sha256).toBe(digest)
    writeFileSync(memoPath(root), '{incomplete')
    expect(identity({ root, searchPath: bin })).toEqual(measured)
    expect(() => JSON.parse(readFileSync(memoPath(root), 'utf8'))).not.toThrow()

    const blocked = join(root, 'blocked')
    mkdirSync(blocked)
    writeFileSync(join(blocked, 'node_modules'), 'not a directory')
    expect(identity({ root: blocked, searchPath: bin })).toEqual(measured)
  })
})

test('verification admits only the identity written into the task cache keys', () => {
  fixture((root, bin) => {
    process.env.PATH = bin
    const expected = idOf(identity({ root, searchPath: bin }))
    expect(output(() => verify(expected))).toEqual({
      status: 0,
      messages: [`toolchain ${expected}`],
      errors: [],
    })

    const mismatch = output(() => verify(`${expected}.other`))
    expect(mismatch.status).toBe(1)
    expect(mismatch.messages).toEqual([])
    expect(mismatch.errors).toEqual([
      `orch-toolchain: the tasks run on ${expected}, but their cache keys were written for ${expected}.other`,
    ])

    const unidentified = output(() => verify(UNIDENTIFIED))
    expect(unidentified.status).toBe(1)
    expect(unidentified.messages).toEqual([])
    expect(unidentified.errors).toEqual([
      'orch-toolchain: the toolchain could not be identified when the tasks were loaded',
    ])

    process.env.PATH = ''
    const missing = output(() => verify(expected))
    expect(missing.status).toBe(1)
    expect(missing.messages).toEqual([])
    expect(missing.errors).toEqual([
      'orch-toolchain: `node` is not on PATH, so the toolchain cannot be identified',
    ])
  })
})
