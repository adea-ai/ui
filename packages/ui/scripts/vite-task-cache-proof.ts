/**
 * Prove how Vite Task (`vp run`) caches this repository's production tasks.
 *
 * Run: bun packages/ui/scripts/vite-task-cache-proof.ts [scenario ...] [--out=<file>]
 *
 * Scenarios: cold-warm, outputs, worktree, divergence, environment, tools, concurrency,
 * snapshots, actions,
 * tracking (default: all). Needs a clean working tree and an installed `vite-plus`;
 * the tracking scenario edits and restores a tracked script, the divergence scenario
 * edits and restores a script and a source file.
 *
 * Every run reads and writes a scratch cache directory under the OS temp directory, linked
 * in as `node_modules/.vite/task-cache` for the duration. No remote cache is configured, no
 * credential is read, and the Turbo production graph is never invoked. A pre-existing local
 * task cache is moved aside and put back at the end.
 *
 * The expectations pin vite-plus's behaviour at the pinned version, so an upgrade that
 * changes any of it fails here and is read before it is trusted in CI.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { Database } from 'bun:sqlite'

type Outcome = 'hit' | 'executed'
type Run = {
  outcome: Outcome
  /** The reason vp prints for a miss, when it prints one. */
  reason: string
  ms: number
  exit: number
  raw: string
}
type Row = {
  scenario: string
  step: string
  task: string
  expected: string
  observed: string
  ms: number
  ok: boolean
}

const args = process.argv.slice(2)
const outFile = args.find((arg) => arg.startsWith('--out='))?.slice('--out='.length)
const chosen = args.filter((arg) => !arg.startsWith('--'))
const repo = resolve(import.meta.dir, '..', '..', '..')
const scratch = mkdtempSync(join(tmpdir(), 'vite-task-cache-proof-'))
const rows: Row[] = []
const notes: string[] = []
const restores: (() => void)[] = []
const touched = new Set<string>()
const roots: string[] = [repo]

const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

function git(cwd: string, ...gitArgs: string[]): string {
  const result = spawnSync('git', gitArgs, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${gitArgs.join(' ')}: ${result.stderr}`)
  return result.stdout
}

function cacheLink(root: string): string {
  return join(root, 'node_modules', '.vite', 'task-cache')
}

/** Point `root`'s task cache at `dir`, moving a pre-existing real cache aside once. */
function useCache(root: string, dir: string): void {
  const link = cacheLink(root)
  mkdirSync(join(root, 'node_modules', '.vite'), { recursive: true })
  mkdirSync(dir, { recursive: true })
  if (existsSync(link) || isLink(link)) {
    if (isLink(link)) rmSync(link)
    else {
      const aside = `${link}.proof-backup`
      if (!existsSync(aside)) renameSync(link, aside)
      else rmSync(link, { recursive: true, force: true })
    }
  }
  symlinkSync(dir, link)
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

function restoreCache(root: string): void {
  const link = cacheLink(root)
  if (isLink(link)) rmSync(link)
  const aside = `${link}.proof-backup`
  if (existsSync(aside)) renameSync(aside, link)
}

function freshCache(...targets: string[]): string {
  const dir = mkdtempSync(join(scratch, 'cache-'))
  for (const root of targets.length ? targets : [repo]) useCache(root, dir)
  return dir
}

type RunOptions = { root?: string; env?: Record<string, string | undefined>; args?: string[] }

/** Start `vp run <task>`; the promise settles when the process exits. */
function startVp(task: string, options: RunOptions = {}): Promise<Run> {
  const root = options.root ?? repo
  const env = { ...process.env, NO_COLOR: '1' } as Record<string, string | undefined>
  for (const [name, value] of Object.entries(options.env ?? {})) {
    if (value === undefined) delete env[name]
    else env[name] = value
  }
  const started = performance.now()
  return new Promise((done) => {
    const child = spawn(
      join(root, 'node_modules', '.bin', 'vp'),
      ['run', task, ...(options.args ?? [])],
      { cwd: root, env: env as NodeJS.ProcessEnv }
    )
    let raw = ''
    child.stdout.on('data', (chunk) => (raw += chunk))
    child.stderr.on('data', (chunk) => (raw += chunk))
    child.on('close', (code) => {
      const text = raw.replace(ansi, '')
      const hit = /cache hit, replaying/.test(text)
      const reason = /cache miss: ([^\n]*?), executing/.exec(text)?.[1] ?? ''
      done({
        outcome: hit ? 'hit' : 'executed',
        reason,
        ms: Math.round(performance.now() - started),
        exit: code ?? -1,
        raw: text,
      })
    })
  })
}

const escapeRegExp = (text: string) => text.replace(/[.+?^$()[\]\\{}]/g, '\\$&')

function record(
  scenario: string,
  step: string,
  task: string,
  expected: string,
  run: Run,
  extra = ''
): Run {
  const observed = `${run.outcome}${run.reason ? ` (${run.reason})` : ''}${extra}`
  const wanted = expected.split('|')
  const matches = (candidate: string) =>
    new RegExp(`^${escapeRegExp(candidate).replace(/\*/g, '.*')}$`).test(observed)
  const ok = run.exit === 0 && wanted.some(matches)
  rows.push({ scenario, step, task, expected, observed, ms: run.ms, ok })
  return run
}

function check(scenario: string, step: string, expected: string, observed: string): void {
  rows.push({ scenario, step, task: '-', expected, observed, ms: 0, ok: expected === observed })
}

async function vp(
  scenario: string,
  step: string,
  task: string,
  expected: string,
  options: RunOptions = {}
): Promise<Run> {
  const run = await startVp(task, options)
  return record(scenario, step, task, expected, run)
}

/** sha256 of every file under `dir`, keyed by relative path. */
function manifest(dir: string): Record<string, string> {
  const result: Record<string, string> = {}
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) walk(path)
      else
        result[relative(dir, path)] = createHash('sha256').update(readFileSync(path)).digest('hex')
    }
  }
  if (existsSync(dir)) walk(dir)
  return result
}

const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12)

function sameManifest(a: Record<string, string>, b: Record<string, string>): boolean {
  return digest(a) === digest(b) && Object.keys(a).length > 0
}

/** Apply `edit` to a tracked file and return the function that puts it back. */
function edit(root: string, file: string, text: string): () => void {
  const path = join(root, file)
  appendFileSync(path, text)
  touched.add(`${root}\0${file}`)
  return () => git(root, 'checkout', '--', file)
}

const withPath = (dir: string) => ({ PATH: `${dir}:${process.env['PATH'] ?? ''}` })
const dist = (root: string) => join(root, 'packages', 'ui', 'dist')
const TRACKED_SCRIPT = 'packages/ui/scripts/validate-registry.ts'
const SOURCE_FILE = 'packages/ui/src/lib/download.ts'

async function coldWarm(): Promise<void> {
  const s = 'cold-warm'
  freshCache()
  const tasks = ['proof:registry', 'proof:build', 'proof:unit', 'proof:typecheck']
  for (const task of tasks) {
    await vp(s, 'cold', task, 'executed*')
    await vp(s, 'warm', task, 'hit')
  }
}

async function outputs(): Promise<void> {
  const s = 'outputs'
  freshCache()
  await vp(s, 'cold build', 'proof:build', 'executed*')
  const built = manifest(dist(repo))
  check(s, 'dist written', 'true', String(Object.keys(built).length > 0))

  rmSync(dist(repo), { recursive: true, force: true })
  await vp(s, 'dist removed, rerun', 'proof:build', 'hit')
  check(s, 'dist restored byte for byte', 'true', String(sameManifest(built, manifest(dist(repo)))))

  const victim = Object.keys(built)[0]!
  rmSync(join(dist(repo), victim))
  await vp(s, 'one dist file removed, rerun', 'proof:build', 'hit')
  check(s, 'removed file restored', 'true', String(existsSync(join(dist(repo), victim))))

  appendFileSync(join(dist(repo), victim), '\n// tampered\n')
  await vp(s, 'one dist file edited, rerun', 'proof:build', 'hit')
  const repaired = sameManifest(built, manifest(dist(repo)))
  check(s, 'edited output file overwritten by the hit', 'true', String(repaired))
  notes.push(
    `outputs: a hit restores missing output files; an edited output file that is still present was ${
      repaired ? 'overwritten' : 'left as edited'
    }`
  )
}

async function worktree(): Promise<void> {
  const s = 'worktree'
  if (git(repo, 'status', '--porcelain').trim()) {
    notes.push('worktree: skipped, the working tree is not clean')
    return
  }
  const other = join(scratch, 'wt-b')
  git(repo, 'worktree', 'add', '--detach', other, 'HEAD')
  restores.push(() => git(repo, 'worktree', 'remove', '--force', other))
  roots.push(other)
  const install = spawnSync('bun', ['install', '--frozen-lockfile'], { cwd: other })
  check(s, 'second worktree installed', '0', String(install.status))

  freshCache(repo, other)
  await vp(s, 'A cold build', 'proof:build', 'executed*')
  const built = manifest(dist(repo))
  await vp(s, 'B reuses A build', 'proof:build', 'hit', { root: other })
  check(s, 'B dist equals A dist', 'true', String(sameManifest(built, manifest(dist(other)))))
  await vp(s, 'B registry cold', 'proof:registry', 'executed*', { root: other })
  await vp(s, 'A reuses B registry', 'proof:registry', 'hit')
}

async function divergence(): Promise<void> {
  const s = 'divergence'
  freshCache()
  await vp(s, 'A cold', 'proof:registry', 'executed*')
  await vp(s, 'A warm', 'proof:registry', 'hit')
  let restore = edit(repo, TRACKED_SCRIPT, '\n// cache proof: state B\n')
  await vp(s, 'B first', 'proof:registry', `executed ('${TRACKED_SCRIPT}' modified)`)
  await vp(s, 'B again', 'proof:registry', 'hit')
  restore()
  const back = await vp(s, 'back to A', 'proof:registry', 'hit|executed*')
  await vp(s, 'A again', 'proof:registry', 'hit')
  restore = edit(repo, TRACKED_SCRIPT, '\n// cache proof: state B\n')
  const second = await vp(s, 'to B a second time', 'proof:registry', 'hit|executed*')
  restore()
  notes.push(
    `divergence: after A -> B, returning to A was a ${back.outcome}; returning to B again was a ${second.outcome}`
  )

  // The same sequence on the build, where a hit also has to restore the right dist.
  freshCache()
  await vp(s, 'build A cold', 'proof:build', 'executed*')
  const stateA = manifest(dist(repo))
  restore = edit(repo, SOURCE_FILE, "\nexport const cacheProofMarker = 'B'\n")
  await vp(s, 'build B', 'proof:build', 'executed*')
  const stateB = manifest(dist(repo))
  check(s, 'the edit reached dist', 'true', String(!sameManifest(stateA, stateB)))
  restore()
  await vp(s, 'build back to A', 'proof:build', 'hit|executed*')
  check(s, 'dist is A, not B', 'true', String(sameManifest(stateA, manifest(dist(repo)))))
  restore = edit(repo, SOURCE_FILE, "\nexport const cacheProofMarker = 'B'\n")
  await vp(s, 'build to B again', 'proof:build', 'hit|executed*')
  check(s, 'dist is B, not A', 'true', String(sameManifest(stateB, manifest(dist(repo)))))
  restore()
  await vp(s, 'build A final', 'proof:build', 'hit|executed*')
  check(s, 'dist ends as A', 'true', String(sameManifest(stateA, manifest(dist(repo)))))
}

async function environment(): Promise<void> {
  const s = 'environment'
  freshCache()
  await vp(s, 'NODE_ENV=production cold', 'proof:build', 'executed*', {
    env: { NODE_ENV: 'production' },
  })
  await vp(s, 'NODE_ENV=production warm', 'proof:build', 'hit', { env: { NODE_ENV: 'production' } })
  await vp(s, 'NODE_ENV=development', 'proof:build', "executed (env 'NODE_ENV' changed)", {
    env: { NODE_ENV: 'development' },
  })
  const back = await vp(s, 'NODE_ENV=production again', 'proof:build', 'hit|executed*', {
    env: { NODE_ENV: 'production' },
  })
  notes.push(`environment: returning to the first NODE_ENV value was a ${back.outcome}`)

  freshCache()
  await vp(s, 'registry cold', 'proof:registry', 'executed*')
  await vp(s, 'untracked variable set', 'proof:registry', 'hit', {
    env: { CACHE_PROOF_UNTRACKED: 'one' },
  })
  await vp(s, 'untracked variable changed', 'proof:registry', 'hit', {
    env: { CACHE_PROOF_UNTRACKED: 'two' },
  })
  await vp(s, 'CI toggled', 'proof:registry', 'hit', { env: { CI: 'true' } })
  await vp(s, 'extra argument', 'proof:registry', 'executed*', {
    args: ['--cache-proof-arg'],
  })
}

async function tools(): Promise<void> {
  const s = 'tools'
  freshCache()
  const bun = spawnSync('which', ['bun'], { encoding: 'utf8' }).stdout.trim()
  const copyDir = join(scratch, 'bun-copy')
  const changedDir = join(scratch, 'bun-changed')
  for (const dir of [copyDir, changedDir]) mkdirSync(dir)
  copyFileSync(bun, join(copyDir, 'bun'))
  copyFileSync(bun, join(changedDir, 'bun'))
  appendFileSync(join(changedDir, 'bun'), Buffer.alloc(16))
  for (const dir of [copyDir, changedDir]) spawnSync('chmod', ['+x', join(dir, 'bun')])

  await vp(s, 'registry cold', 'proof:registry', 'executed*')
  const same = await vp(s, 'bun copy, same bytes, other path', 'proof:registry', 'hit|executed*', {
    env: withPath(copyDir),
  })
  await vp(s, 'registry reset', 'proof:registry', 'hit|executed*')
  const changed = await vp(s, 'bun with other bytes', 'proof:registry', 'hit|executed*', {
    env: withPath(changedDir),
  })
  notes.push(
    `tools: a same-bytes copy of the runtime at another path was a ${same.outcome}; a runtime with other bytes was a ${changed.outcome}${
      changed.reason ? ` (${changed.reason})` : ''
    }`
  )

  // `tsc` runs on node: does a different node binary reach the fingerprint?
  const node = spawnSync('which', ['node'], { encoding: 'utf8' }).stdout.trim()
  const nodeDir = join(scratch, 'node-changed')
  mkdirSync(nodeDir)
  copyFileSync(node, join(nodeDir, 'node'))
  appendFileSync(join(nodeDir, 'node'), Buffer.alloc(16))
  spawnSync('chmod', ['+x', join(nodeDir, 'node')])
  await vp(s, 'typecheck cold', 'proof:typecheck', 'executed*')
  const nodeRun = await vp(s, 'node with other bytes', 'proof:typecheck', 'hit|executed*', {
    env: withPath(nodeDir),
  })
  notes.push(
    `tools: a node binary with other bytes under an automatically tracked task was a ${nodeRun.outcome}${
      nodeRun.reason ? ` (${nodeRun.reason})` : ''
    }`
  )

  // The explicit separation: a declared variable that names the toolchain and platform.
  await vp(s, 'toolchain A cold', 'proof:registry', 'hit|executed*', {
    env: { PROOF_TOOLCHAIN: 'bun-1.4.0 node-24.18.0 linux-x64' },
  })
  await vp(s, 'toolchain A warm', 'proof:registry', 'hit', {
    env: { PROOF_TOOLCHAIN: 'bun-1.4.0 node-24.18.0 linux-x64' },
  })
  await vp(
    s,
    'other bun version',
    'proof:registry',
    "executed ('PROOF_TOOLCHAIN' changed)|executed (env 'PROOF_TOOLCHAIN' changed)",
    {
      env: { PROOF_TOOLCHAIN: 'bun-1.4.1 node-24.18.0 linux-x64' },
    }
  )
  await vp(s, 'other platform', 'proof:registry', "executed (env 'PROOF_TOOLCHAIN' changed)", {
    env: { PROOF_TOOLCHAIN: 'bun-1.4.1 node-24.18.0 darwin-arm64' },
  })

  // Is the platform in the stored fingerprint on its own? (It is not asserted.)
  const cache = readdirSync(cacheLink(repo)).map((entry) =>
    join(cacheLink(repo), entry, 'cache.db')
  )
  const stored = cache
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file).toString('latin1'))
  const platform = stored.some((text) => /x86_64|linux-x64|x64-gnu/.test(text))
  notes.push(
    `tools: the stored fingerprints ${platform ? 'contain' : 'do not contain'} a platform marker`
  )
}

async function concurrency(): Promise<void> {
  const s = 'concurrency'
  const dir = freshCache()
  const same = await Promise.all([1, 2, 3, 4].map(() => startVp('proof:registry')))
  same.forEach((run, index) =>
    record(s, `4 at once, run ${index + 1}`, 'proof:registry', 'hit|executed*', run)
  )
  await vp(s, 'after the 4', 'proof:registry', 'hit')

  const mixed = await Promise.all(
    ['proof:registry', 'proof:cn-check:auto', 'proof:build'].map((task) => startVp(task))
  )
  mixed.forEach((run, index) =>
    record(
      s,
      `3 tasks at once, run ${index + 1}`,
      ['proof:registry', 'proof:cn-check:auto', 'proof:build'][index]!,
      'hit|executed*',
      run
    )
  )
  for (const task of ['proof:registry', 'proof:cn-check:auto', 'proof:build'])
    await vp(s, 'after the 3', task, 'hit')

  const db = new Database(join(dir, readdirSync(dir)[0]!, 'cache.db'), { readonly: true })
  const integrity = (db.query('PRAGMA integrity_check').get() as { integrity_check: string })
    .integrity_check
  db.close()
  check(s, 'sqlite integrity_check', 'ok', integrity)

  if (roots.length > 1) {
    const other = roots[1]!
    freshCache(repo, other)
    const pair = await Promise.all([
      startVp('proof:build'),
      startVp('proof:build', { root: other }),
    ])
    pair.forEach((run, index) =>
      record(s, `two worktrees at once, ${index ? 'B' : 'A'}`, 'proof:build', 'hit|executed*', run)
    )
    await vp(s, 'A after', 'proof:build', 'hit')
    await vp(s, 'B after', 'proof:build', 'hit', { root: other })
    check(
      s,
      'A and B dist equal',
      'true',
      String(sameManifest(manifest(dist(repo)), manifest(dist(other))))
    )
  } else notes.push('concurrency: the two-worktree case needs the worktree scenario to have run')
}

/** The negative control: automatic tracking alone misses what `bun` itself loads. */
async function tracking(): Promise<void> {
  const s = 'tracking'
  freshCache()
  const script = 'packages/ui/scripts/check-cn-tables.ts'
  await vp(s, 'auto-only cold', 'proof:cn-check:auto', 'executed*')
  let restore = edit(repo, script, '\n// cache proof edit\n')
  const stale = await vp(
    s,
    'auto-only after editing the bun script',
    'proof:cn-check:auto',
    'hit|executed*'
  )
  restore()
  notes.push(
    `tracking: editing the script bun runs left an automatic-only task a ${stale.outcome} (a hit is a stale result)`
  )
  await vp(s, 'declared globs cold', 'proof:registry', 'executed*')
  restore = edit(repo, TRACKED_SCRIPT, '\n// cache proof edit\n')
  await vp(
    s,
    'declared globs after editing the bun script',
    'proof:registry',
    `executed ('${TRACKED_SCRIPT}' modified)`
  )
  restore()

  await vp(s, 'unit cold', 'proof:unit', 'executed*')
  const test = 'packages/ui/tests/font-zoom.test.ts'
  restore = edit(repo, test, '\n// cache proof edit\n')
  await vp(s, 'unit after editing a test file', 'proof:unit', `executed ('${test}' modified)`)
  restore()
}

function cacheDb(dir: string): string | undefined {
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry, 'cache.db')
    if (existsSync(file)) return file
  }
  return undefined
}

/** PRAGMA integrity_check on a private copy of the database and its WAL, never the live files. */
function integrityOfCopy(file: string): string {
  const copy = mkdtempSync(join(scratch, 'integrity-'))
  try {
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(file + suffix)) copyFileSync(file + suffix, join(copy, `cache.db${suffix}`))
    }
    const db = new Database(join(copy, 'cache.db'))
    try {
      return (db.query('PRAGMA integrity_check').get() as { integrity_check: string })
        .integrity_check
    } finally {
      db.close()
    }
  } catch (error) {
    return `unreadable: ${String(error).slice(0, 80)}`
  } finally {
    rmSync(copy, { recursive: true, force: true })
  }
}

/** Start `vp run <task>` in its own process group and SIGKILL the whole group after `delay` ms. */
async function killedAfter(
  task: string,
  delay: number,
  env: Record<string, string> = {}
): Promise<number | null> {
  const child = spawn(join(repo, 'node_modules', '.bin', 'vp'), ['run', task], {
    cwd: repo,
    env: { ...process.env, NO_COLOR: '1', ...env },
    detached: true,
    stdio: 'ignore',
  })
  const exited = new Promise<number | null>((done) => child.once('exit', (code) => done(code)))
  await new Promise((done) => setTimeout(done, delay))
  const alreadyDone = child.exitCode !== null
  if (!alreadyDone) {
    try {
      process.kill(-child.pid!, 'SIGKILL')
    } catch {
      // the group ended between the check and the signal
    }
  }
  return exited
}

/** Interrupted runs, and snapshots of the cache directory taken while writers are active. */
async function snapshots(): Promise<void> {
  const s = 'snapshots'
  const dir0 = freshCache()
  await vp(s, 'golden build', 'proof:build', 'executed*')
  const golden = manifest(dist(repo))
  const journal = (() => {
    const file = cacheDb(dir0)
    if (!file) return 'none'
    const db = new Database(file, { readonly: true })
    try {
      return String(
        (db.query('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode
      )
    } finally {
      db.close()
    }
  })()
  notes.push(`snapshots: the task cache database journal mode is ${journal}`)

  // A build killed at several points, including just before it would store its entry.
  for (const delay of [1500, 8000, 16500, 17800]) {
    const dir = freshCache()
    rmSync(dist(repo), { recursive: true, force: true })
    await killedAfter('proof:build', delay)
    const file = cacheDb(dir)
    check(s, `build killed at ${delay}ms: database`, 'ok', file ? integrityOfCopy(file) : 'ok')
    await vp(s, `build killed at ${delay}ms: next run`, 'proof:build', 'hit|executed*')
    check(
      s,
      `build killed at ${delay}ms: dist is complete`,
      'true',
      String(sameManifest(golden, manifest(dist(repo))))
    )
    await vp(s, `build killed at ${delay}ms: warm`, 'proof:build', 'hit')
  }

  // Many short writers, a share of them killed mid-write.
  const dir = freshCache()
  const rounds = 25
  for (let round = 0; round < rounds; round += 1) {
    const env = (n: number) => ({ PROOF_TOOLCHAIN: `round-${round}-${n}` })
    await Promise.all([
      startVp('proof:registry', { env: env(0) }),
      killedAfter('proof:registry', 40 + ((round * 37) % 380), env(1)),
      killedAfter('proof:registry', 20 + ((round * 53) % 300), env(2)),
    ])
  }
  const after = cacheDb(dir)
  check(
    s,
    `${rounds} rounds, 2 of 3 writers killed: database`,
    'ok',
    after ? integrityOfCopy(after) : 'ok'
  )
  await vp(s, 'next run succeeds', 'proof:registry', 'hit|executed*')
  await vp(s, 'and then hits', 'proof:registry', 'hit')

  // Snapshots of the cache directory while four writers run back to back.
  const live = freshCache()
  const loop = { running: true }
  const writers = (async () => {
    for (let round = 0; loop.running; round += 1) {
      await Promise.all(
        [0, 1, 2, 3].map((n) =>
          startVp('proof:registry', { env: { PROOF_TOOLCHAIN: `snap-${round}-${n}` } })
        )
      )
    }
  })()
  const counts = { wholeTotal: 0, wholeBad: 0, bareTotal: 0, bareBad: 0, vacTotal: 0, vacBad: 0 }
  const badStates = new Map<string, number>()
  const deadline = performance.now() + 20_000
  while (performance.now() < deadline) {
    const file = cacheDb(live)
    if (file) {
      const whole = mkdtempSync(join(scratch, 'snap-'))
      try {
        cpSync(join(file, '..'), whole, { recursive: true })
        const state = integrityOfCopy(join(whole, 'cache.db'))
        counts.wholeTotal += 1
        if (state !== 'ok') {
          counts.wholeBad += 1
          badStates.set(`directory: ${state}`, (badStates.get(`directory: ${state}`) ?? 0) + 1)
        }
        const bare = mkdtempSync(join(scratch, 'snap-'))
        copyFileSync(file, join(bare, 'cache.db'))
        const bareState = integrityOfCopy(join(bare, 'cache.db'))
        counts.bareTotal += 1
        if (bareState !== 'ok') {
          counts.bareBad += 1
          badStates.set(
            `database only: ${bareState}`,
            (badStates.get(`database only: ${bareState}`) ?? 0) + 1
          )
        }
        // SQLite's own consistent snapshot, taken from a read-only connection while vp writes.
        const target = join(bare, 'vacuum.db')
        let vacuumState = 'ok'
        try {
          const source = new Database(file, { readonly: true })
          try {
            source.run(`VACUUM INTO '${target}'`)
          } finally {
            source.close()
          }
          vacuumState = integrityOfCopy(target)
        } catch (error) {
          vacuumState = `vacuum failed: ${String(error).slice(0, 60)}`
        }
        counts.vacTotal += 1
        if (vacuumState !== 'ok') {
          counts.vacBad += 1
          badStates.set(
            `vacuum into: ${vacuumState}`,
            (badStates.get(`vacuum into: ${vacuumState}`) ?? 0) + 1
          )
        }
        rmSync(bare, { recursive: true, force: true })
      } catch {
        counts.wholeBad += 1
      } finally {
        rmSync(whole, { recursive: true, force: true })
      }
    }
    await new Promise((done) => setTimeout(done, 15))
  }
  loop.running = false
  await writers
  for (const [state, n] of badStates) notes.push(`snapshots: ${n} x ${state}`)
  check(
    s,
    `${counts.wholeTotal} directory snapshots during writes: incoherent`,
    '0',
    String(counts.wholeBad)
  )
  check(
    s,
    `${counts.bareTotal} database-only snapshots during writes: incoherent`,
    '0',
    String(counts.bareBad)
  )
  check(
    s,
    `${counts.vacTotal} VACUUM INTO snapshots during writes: incoherent`,
    '0',
    String(counts.vacBad)
  )
  const settled = cacheDb(live)
  check(s, 'database after the writers stop', 'ok', settled ? integrityOfCopy(settled) : 'ok')
}

/** Static evidence that the Actions workflow keeps cache writes to trusted runs. */
function actions(): Promise<void> {
  const s = 'actions'
  const file = join(repo, '.github', 'workflows', 'vite-task-cache-proof.yml')
  const text = readFileSync(file, 'utf8')
  const code = text
    .split('\n')
    .map((line) => line.replace(/(^|\s)#.*$/, ''))
    .join('\n')
  const doc = Bun.YAML.parse(text) as {
    on: Record<string, unknown>
    permissions: Record<string, string>
    concurrency?: unknown
    jobs: Record<
      string,
      { 'timeout-minutes'?: number; permissions?: unknown; steps: Record<string, unknown>[] }
    >
  }
  const job = Object.values(doc.jobs)[0]!
  const steps = job.steps
  const uses = steps.map((step) => String(step['uses'] ?? '')).filter(Boolean)
  const saves = steps.filter((step) => String(step['uses'] ?? '').startsWith('actions/cache/save@'))
  const cacheRestores = steps.filter((step) =>
    String(step['uses'] ?? '').startsWith('actions/cache/restore@')
  )
  const saveCondition = String(saves[0]?.['if'] ?? '')
  const triggers = Object.keys(doc.on).toSorted().join(',')
  const checkout = steps.find((step) => String(step['uses'] ?? '').startsWith('actions/checkout@'))
  const withBlock = (checkout?.['with'] ?? {}) as Record<string, unknown>
  const restoreKey = String(
    (cacheRestores[0]?.['with'] as Record<string, unknown> | undefined)?.['key'] ?? ''
  )
  const saveKey = String((saves[0]?.['with'] as Record<string, unknown> | undefined)?.['key'] ?? '')

  check(
    s,
    'triggers are only dispatch and pull_request',
    'pull_request,workflow_dispatch',
    triggers
  )
  check(
    s,
    'no pull_request_target, push or schedule',
    'false',
    String(/pull_request_target|\bpush:|schedule:/.test(code))
  )
  check(
    s,
    'workflow permissions are contents: read only',
    '{"contents":"read"}',
    JSON.stringify(doc.permissions)
  )
  check(s, 'the job asks for no extra permissions', 'undefined', String(job.permissions))
  check(
    s,
    'no secret, token or OIDC use',
    'false',
    String(/secrets\.|GITHUB_TOKEN|id-token|CLOUDFLARE|NIFTY/i.test(code))
  )
  check(
    s,
    'every action is pinned to a full commit SHA',
    'true',
    String(uses.every((item) => /@[0-9a-f]{40}$/.test(item)))
  )
  check(
    s,
    'checkout does not persist credentials',
    'false',
    String(withBlock['persist-credentials'])
  )
  check(s, 'one restore step and one save step', '1,1', `${cacheRestores.length},${saves.length}`)
  check(s, 'save needs success()', 'true', String(saveCondition.includes('success()')))
  check(
    s,
    'save refuses pull_request runs',
    'true',
    String(saveCondition.includes("github.event_name != 'pull_request'"))
  )
  check(
    s,
    'save needs the default branch',
    'true',
    String(
      saveCondition.includes(
        "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)"
      )
    )
  )
  check(
    s,
    'restore never saves and uses no save-always',
    'false',
    String(/save-always|lookup-only/.test(code))
  )
  check(
    s,
    'cache keys carry OS and architecture',
    'true',
    String(/runner\.os/.test(restoreKey) && /runner\.arch/.test(restoreKey))
  )
  check(
    s,
    'save reuses the restore step primary key',
    'true',
    String(saveKey.includes('steps.vite-task-cache.outputs.cache-primary-key'))
  )
  check(
    s,
    'a timeout and a concurrency group exist',
    'true',
    String(job['timeout-minutes'] !== undefined && doc.concurrency !== undefined)
  )
  check(
    s,
    'the cache path is only the task cache',
    'node_modules/.vite/task-cache',
    String((cacheRestores[0]?.['with'] as Record<string, unknown> | undefined)?.['path'])
  )
  notes.push(
    'actions: GitHub-side write isolation (a pull request run cannot write the default-branch cache scope) is configured here and asserted statically; it has not been exercised on a runner, so it is a gap until the workflow has run from a pull request and from the default branch'
  )
  return Promise.resolve()
}

const scenarios: Record<string, () => Promise<void>> = {
  'cold-warm': coldWarm,
  outputs,
  worktree,
  divergence,
  environment,
  tools,
  tracking,
  concurrency,
  snapshots,
  actions,
}

async function main(): Promise<void> {
  const version = spawnSync(join(repo, 'node_modules', '.bin', 'vp'), ['--version'], {
    encoding: 'utf8',
  })
  notes.push(`vp: ${version.stdout.trim().split('\n')[0]}`)
  notes.push(
    `platform: ${process.platform}-${process.arch}, bun ${Bun.version}, node ${spawnSync('node', ['--version'], { encoding: 'utf8' }).stdout.trim()}`
  )
  notes.push(`base: ${git(repo, 'rev-parse', 'HEAD').trim()}`)
  if (git(repo, 'status', '--porcelain').trim())
    notes.push('working tree was not clean at the start')

  const names = chosen.length ? chosen : Object.keys(scenarios)
  for (const name of names) {
    const run = scenarios[name]
    if (!run)
      throw new Error(`unknown scenario ${name}; known: ${Object.keys(scenarios).join(', ')}`)
    console.error(`# ${name}`)
    await run()
  }
}

let failed = false
try {
  await main()
} catch (error) {
  failed = true
  console.error(error)
} finally {
  for (const entry of touched) {
    const [root, file] = entry.split('\0') as [string, string]
    try {
      git(root, 'checkout', '--', file)
    } catch (error) {
      console.error('cleanup:', error)
    }
  }
  for (const undo of restores.toReversed()) {
    try {
      undo()
    } catch (error) {
      console.error('cleanup:', error)
    }
  }
  for (const root of roots) restoreCache(root)
  writeFileSync(join(scratch, 'results.json'), JSON.stringify({ notes, rows }, null, 2))
}

const pad = (text: string, width: number) => text.padEnd(width).slice(0, width)
for (const row of rows) {
  console.log(
    `${row.ok ? 'ok  ' : 'FAIL'} ${pad(row.scenario, 12)} ${pad(row.step, 44)} ${pad(row.task, 20)} ${String(row.ms).padStart(6)}ms  ${row.observed}${row.ok ? '' : `   (expected ${row.expected})`}`
  )
}
console.log('')
for (const note of notes) console.log(`note: ${note}`)
if (outFile) writeFileSync(resolve(outFile), JSON.stringify({ notes, rows }, null, 2))
console.log(`scratch: ${scratch}`)
if (failed || rows.some((row) => !row.ok)) process.exit(1)
