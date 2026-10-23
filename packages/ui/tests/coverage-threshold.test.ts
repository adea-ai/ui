import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('the repository coverage settings reject under-covered code and accept complete coverage', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ui-coverage-threshold-'))
  try {
    // Exercise the actual configuration: unsupported threshold keys must not
    // silently turn a green test command into a coverage waiver.
    writeFileSync(
      join(directory, 'bunfig.toml'),
      readFileSync(new URL('../../../bunfig.toml', import.meta.url), 'utf8')
    )
    writeFileSync(
      join(directory, 'subject.ts'),
      'export function first() {\n return 1\n}\nexport function second() {\n return 2\n}\n'
    )
    const run = (complete: boolean) => {
      writeFileSync(
        join(directory, 'subject.test.ts'),
        'import { expect, test } from "bun:test"\n' +
          'import { first, second } from "./subject"\n' +
          'test("fixture", () => { expect(first()).toBe(1); ' +
          (complete ? 'expect(second()).toBe(2); ' : '') +
          '})\n'
      )
      return spawnSync(process.execPath, ['--no-env-file', 'test', '--coverage'], {
        cwd: directory,
        encoding: 'utf8',
        timeout: 5_000,
      })
    }
    const underCovered = run(false)
    expect(underCovered.error).toBeUndefined()
    expect(underCovered.status).toBe(1)
    expect(underCovered.stdout + underCovered.stderr).toContain('1 pass')
    expect(underCovered.stdout + underCovered.stderr).toContain('0 fail')

    const complete = run(true)
    expect(complete.error).toBeUndefined()
    expect(complete.status).toBe(0)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
