import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { runCommand } from './packed-layout-process.mjs'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function isRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

async function waitForExit(pids, timeoutMs) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end && pids.some(isRunning)) await delay(20)
  assert.deepEqual(
    pids.filter(isRunning),
    [],
    'the timed-out command and its descendants must be gone before the gate continues'
  )
}

test('a timed-out packed command terminates its owned process tree', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'adea-packed-layout-process-test-'))
  const marker = join(directory, 'children.json')
  const stubbornChild = "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"
  const processTreeSetup =
    process.platform === 'win32'
      ? `import { writeFileSync } from 'node:fs'
    writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ parent: process.pid }))`
      : `import { spawn } from 'node:child_process'
    import { writeFileSync } from 'node:fs'
    const grandchild = spawn(process.execPath, ['-e', ${JSON.stringify(stubbornChild)}], { stdio: 'ignore' })
    writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ parent: process.pid, grandchild: grandchild.pid }))`
  const commandSource = `
    ${processTreeSetup}
    process.on('SIGTERM', () => {})
    setInterval(() => {}, 1000)
  `
  let processGroupId
  let descendants = []
  const cleanupFailures = []

  try {
    await assert.rejects(
      runCommand(process.execPath, ['--input-type=module', '-e', commandSource], {
        stage: 'process-group cleanup regression',
        cwd: directory,
        timeoutMs: 500,
        terminationGraceMs: 100,
        displayFile: 'node',
        displayArgs: ['--input-type=module', '-e', '<stubborn child fixture>'],
      }),
      (error) => {
        processGroupId = error.pid
        assert.equal(error.code, 'ETIMEDOUT')
        assert.equal(error.stage, 'process-group cleanup regression')
        return true
      }
    )

    const childPids = JSON.parse(readFileSync(marker, 'utf8'))
    descendants = [childPids.parent, childPids.grandchild].filter(Boolean)
    assert.ok(processGroupId, 'the timeout error identifies the owned process group')
    await waitForExit(descendants, 2_000)
    if (process.platform !== 'win32') await waitForExit([processGroupId], 2_000)
  } finally {
    if (processGroupId && process.platform !== 'win32') {
      try {
        process.kill(-processGroupId, 'SIGKILL')
      } catch (error) {
        if (error.code !== 'ESRCH') cleanupFailures.push(error.message)
      }
    }
    for (const pid of descendants) {
      if (!pid || !isRunning(pid)) continue
      try {
        process.kill(pid, 'SIGKILL')
      } catch (error) {
        if (error.code !== 'ESRCH') cleanupFailures.push(error.message)
      }
    }
    rmSync(directory, { recursive: true, force: true })
  }
  assert.deepEqual(cleanupFailures, [], 'test cleanup does not leave owned child processes')
})
