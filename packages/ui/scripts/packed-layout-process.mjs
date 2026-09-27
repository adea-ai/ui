import { spawn } from 'node:child_process'

const OUTPUT_TAIL_BYTES = 12 * 1024
const STDOUT_LIMIT_BYTES = 1024 * 1024
const PROCESS_GROUP_CLEANUP_MS = 2_000

function emit(event, values = {}) {
  console.log(JSON.stringify({ event, ...values }))
}

function appendTail(current, chunk) {
  const combined = Buffer.concat([current, chunk])
  return combined.length > OUTPUT_TAIL_BYTES ? combined.subarray(-OUTPUT_TAIL_BYTES) : combined
}

function appendOutput(current, chunk, limitBytes) {
  const available = Math.max(0, limitBytes - current.length)
  const retained = chunk.subarray(0, available)
  return {
    buffer: retained.length ? Buffer.concat([current, retained]) : current,
    truncated: chunk.length > available,
  }
}

function groupExists(pid) {
  if (!pid || process.platform === 'win32') return false
  try {
    process.kill(-pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

function signalGroup(child, signal) {
  if (!child.pid) return
  try {
    if (process.platform === 'win32') child.kill(signal)
    else process.kill(-child.pid, signal)
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForGroupExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (groupExists(pid) && Date.now() < deadline) await delay(25)
  return !groupExists(pid)
}

async function killWindowsProcessTree(pid) {
  const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  let spawnError
  killer.on('error', (error) => {
    spawnError = error
  })
  const closePromise = new Promise((resolve) => {
    killer.once('close', (code, signal) => resolve({ code, signal }))
  })
  emit('packed-layout-tree-cleanup-start', {
    platform: 'win32',
    targetPid: pid,
    cleanupPid: killer.pid,
  })
  const timeout = setTimeout(() => {
    try {
      killer.kill('SIGKILL')
    } catch {
      // The cleanup child may exit between the deadline and the signal.
    }
  }, 1_000)
  const outcome = await Promise.race([
    closePromise.then((exit) => ({ kind: 'closed', exit })),
    delay(PROCESS_GROUP_CLEANUP_MS).then(() => ({ kind: 'timeout' })),
  ])
  clearTimeout(timeout)
  if (outcome.kind === 'timeout')
    throw new Error(`taskkill.exe did not close the process tree rooted at ${pid}`)
  if (spawnError) throw spawnError
  if (outcome.exit.code !== 0)
    throw new Error(
      `taskkill.exe failed for process tree ${pid} with exit code ${outcome.exit.code}`
    )
  emit('packed-layout-tree-cleanup-exit', {
    platform: 'win32',
    targetPid: pid,
    cleanupPid: killer.pid,
    exitCode: outcome.exit.code,
  })
}

async function stopOwnedProcessGroup(child, closePromise, graceMs) {
  if (!child.pid) return

  if (process.platform === 'win32') {
    try {
      await killWindowsProcessTree(child.pid)
    } catch (error) {
      try {
        child.kill('SIGKILL')
      } catch {
        // Preserve the tree-cleanup failure as the actionable error.
      }
      throw error
    }
    const closed = await Promise.race([
      closePromise.then(() => true),
      delay(PROCESS_GROUP_CLEANUP_MS).then(() => false),
    ])
    if (!closed) throw new Error(`Child process ${child.pid} did not close after taskkill.exe`)
    return
  }

  let termError
  try {
    signalGroup(child, 'SIGTERM')
  } catch (error) {
    termError = error
  }
  const stoppedOnTerm = termError ? false : await waitForGroupExit(child.pid, graceMs)
  if (!stoppedOnTerm) signalGroup(child, 'SIGKILL')

  const closed = await Promise.race([
    closePromise.then(() => true),
    delay(PROCESS_GROUP_CLEANUP_MS).then(() => false),
  ])
  if (!closed)
    throw new Error(`Child process ${child.pid} did not close after process-group SIGKILL`)

  const groupExited = await waitForGroupExit(child.pid, PROCESS_GROUP_CLEANUP_MS)
  if (!groupExited) throw new Error(`Child process group ${child.pid} remained after SIGKILL`)
}

function commandError(message, details) {
  const error = new Error(message)
  Object.assign(error, details)
  return error
}

/**
 * Run a packed-layout child with bounded output, a deadline, and owned process-group cleanup.
 * POSIX uses a detached process group; Windows uses taskkill's process-tree mode.
 */
export async function runCommand(file, args, options) {
  const {
    stage,
    cwd,
    timeoutMs,
    signal,
    terminationGraceMs = 400,
    displayFile = file,
    displayArgs = args,
    displayCwd,
    stdoutLimitBytes = STDOUT_LIMIT_BYTES,
  } = options
  if (
    !stage ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isSafeInteger(stdoutLimitBytes) ||
    stdoutLimitBytes <= 0
  )
    throw new TypeError(
      'runCommand requires a stage, positive timeoutMs, and positive stdoutLimitBytes'
    )
  if (signal?.aborted) {
    throw commandError(`${stage} cancelled before launch`, {
      name: 'PackedLayoutCommandError',
      code: 'ABORT_ERR',
      stage,
      reason: signal.reason,
    })
  }

  const startedAt = Date.now()
  const child = spawn(file, args, {
    cwd,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let stdout = Buffer.alloc(0)
  let stderr = Buffer.alloc(0)
  let stdoutTruncated = false
  let spawnError
  let stopReason
  let stopPromise
  let cleanupError
  let resolveStopRequested
  const stopRequested = new Promise((resolve) => {
    resolveStopRequested = resolve
  })
  child.stdout.on('data', (chunk) => {
    const output = appendOutput(stdout, chunk, stdoutLimitBytes)
    stdout = output.buffer
    stdoutTruncated ||= output.truncated
  })
  child.stderr.on('data', (chunk) => {
    stderr = appendTail(stderr, chunk)
  })
  child.on('error', (error) => {
    spawnError = error
  })

  const closePromise = new Promise((resolve) => {
    child.once('close', (code, exitSignal) => resolve({ code, signal: exitSignal }))
  })
  const pid = child.pid
  const command = {
    file: displayFile,
    args: displayArgs,
    cwd: displayCwd ?? (cwd ? '<cwd>' : undefined),
  }
  emit('packed-layout-child-start', { stage, command, pid, timeoutMs })

  const requestStop = (reason) => {
    if (stopPromise) return
    stopReason = reason
    stopPromise = stopOwnedProcessGroup(child, closePromise, terminationGraceMs).catch((error) => {
      cleanupError = error
    })
    resolveStopRequested()
  }
  const onAbort = () => requestStop({ kind: 'aborted', reason: signal.reason })
  signal?.addEventListener('abort', onAbort, { once: true })
  const timeout = setTimeout(() => requestStop({ kind: 'timeout' }), timeoutMs)

  const completion = await Promise.race([
    closePromise.then((exit) => ({ exit })),
    stopRequested.then(async () => {
      await stopPromise
      if (cleanupError) return { exit: { code: null, signal: null } }
      return { exit: await closePromise }
    }),
  ])
  const exit = completion.exit
  clearTimeout(timeout)
  signal?.removeEventListener('abort', onAbort)

  if (stopPromise) await stopPromise
  else if (process.platform !== 'win32' && groupExists(pid)) {
    try {
      await stopOwnedProcessGroup(child, closePromise, terminationGraceMs)
    } catch (error) {
      cleanupError = error
    }
  }

  const elapsedMs = Date.now() - startedAt
  const diagnostic = {
    stage,
    command,
    pid,
    exitCode: exit.code,
    signal: exit.signal,
    elapsedMs,
    stdoutTruncated,
  }
  if (spawnError || exit.code !== 0 || stopReason || cleanupError || stdoutTruncated) {
    const stdoutText = stdout.toString('utf8').trim()
    const stderrText = stderr.toString('utf8').trim()
    const errorCode = cleanupError
      ? 'ECHILD_CLEANUP'
      : stopReason?.kind === 'timeout'
        ? 'ETIMEDOUT'
        : stopReason?.kind === 'aborted'
          ? 'ABORT_ERR'
          : stdoutTruncated
            ? 'EOUTPUTLIMIT'
            : 'ECHILD'
    const message = cleanupError
      ? `${stage} child cleanup failed${stopReason ? ` after ${stopReason.kind}` : ''}: ${cleanupError.message}`
      : stopReason?.kind === 'timeout'
        ? `${stage} timed out after ${timeoutMs}ms`
        : stopReason?.kind === 'aborted'
          ? `${stage} cancelled by ${signal.reason?.message ?? 'the caller'}`
          : stdoutTruncated
            ? `${stage} stdout exceeded its ${stdoutLimitBytes} byte capture limit`
            : `${stage} failed${exit.code === null ? ` (${exit.signal ?? 'no exit status'})` : ` with exit code ${exit.code}`}`
    const failure = commandError(message, {
      name: 'PackedLayoutCommandError',
      ...diagnostic,
      code: errorCode,
      cause: cleanupError ?? spawnError,
      stdout: stdoutText,
      stderr: stderrText,
    })
    emit('packed-layout-child-failure', {
      ...diagnostic,
      error: message,
      stdoutTail: stdoutText,
      stderrTail: stderrText,
    })
    throw failure
  }

  emit('packed-layout-child-exit', { ...diagnostic, result: 'success' })
  return { stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'), pid, elapsedMs }
}

/** Install graceful cancellation so SIGTERM/SIGINT clean the active child group and temp dir. */
export function installCancellationHandlers() {
  const controller = new AbortController()
  const handlers = new Map()
  for (const signalName of ['SIGTERM', 'SIGINT']) {
    const handler = () => {
      emit('packed-layout-cancel', { signal: signalName })
      controller.abort(new Error(`received ${signalName}`))
    }
    handlers.set(signalName, handler)
    process.on(signalName, handler)
  }
  return {
    signal: controller.signal,
    dispose() {
      for (const [signalName, handler] of handlers) process.removeListener(signalName, handler)
    },
  }
}
