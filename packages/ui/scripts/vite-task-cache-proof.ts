/**
 * Prove how Vite Task (`vp run`) caches this repository's production tasks.
 *
 * Run: bun packages/ui/scripts/vite-task-cache-proof.ts [scenario ...] [--out=<file>]
 *
 * Scenarios: cold-warm, outputs, worktree, divergence, environment, tools, concurrency,
 * snapshots, restore, actions, safety, tracking (default: all).
 *
 * The checkout the script is started from is never mutated. Every scenario runs in a
 * disposable `git worktree` of that checkout's committed HEAD, created under the OS temp
 * directory with its own `bun install`, and removed at the end. Uncommitted changes in the
 * starting checkout are neither used nor touched, and its `node_modules/.vite/task-cache`
 * (a real directory or a symlink) is never read, moved or removed. Edits to tracked files
 * (the tracking and divergence scenarios) and the task-cache symlink happen only inside a
 * disposable root; every mutation helper refuses a path outside the scratch directory and
 * only undoes what the harness itself recorded. The `safety` scenario proves this against a
 * dirty fixture, including a run that fails part way.
 *
 * No remote cache is configured, no credential is read, and the Turbo production graph is
 * never invoked.
 *
 * The expectations pin vite-plus's behaviour at the pinned version, so an upgrade that
 * changes any of it fails here and is read before it is trusted in CI.
 */
import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
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
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
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
/** The checkout the harness was started from. It is read, never mutated. */
const source = resolve(import.meta.dir, '..', '..', '..')
const scratch = mkdtempSync(join(tmpdir(), 'vite-task-cache-proof-'))
/** The disposable worktree every scenario runs in. */
const repo = join(scratch, 'work')
const rows: Row[] = []
const notes: string[] = []
const restores: (() => void)[] = []
const touched = new Set<string>()
const roots: string[] = [repo]
/** Set by the failure-path test: throw after the first tracked-file edit. */
const injectFailure = process.env['PROOF_INJECT_FAILURE'] === '1'
/** Set by the failure-path test: the restore scenario's writers run a task that does not exist. */
const injectWriterFailure = process.env['PROOF_INJECT_WRITER_FAILURE'] === '1'

const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

function git(cwd: string, ...gitArgs: string[]): string {
  const result = spawnSync('git', gitArgs, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${gitArgs.join(' ')}: ${result.stderr}`)
  return result.stdout
}

/** A detached worktree of `from`'s HEAD at `path`, removed again by the cleanup. */
function addWorktree(from: string, path: string): string {
  git(from, 'worktree', 'add', '--detach', '--quiet', path, 'HEAD')
  restores.push(() => {
    git(from, 'worktree', 'remove', '--force', path)
  })
  if (!roots.includes(path)) roots.push(path)
  return path
}

function install(root: string): number | null {
  return spawnSync('bun', ['install', '--frozen-lockfile'], { cwd: root, stdio: 'ignore' }).status
}

function cacheLink(root: string): string {
  return join(root, 'node_modules', '.vite', 'task-cache')
}

/** What `node_modules/.vite/task-cache` was before the harness first touched `root`. */
type Original = { kind: 'none' } | { kind: 'link'; target: string } | { kind: 'dir'; aside: string }
const originals = new Map<string, Original>()

/** Refuse to mutate anything that is not inside the harness's own scratch directory. */
function assertDisposable(root: string): void {
  const rel = relative(scratch, resolve(root))
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel))
    throw new Error(`refusing to mutate ${root}: it is not inside the scratch directory`)
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

const present = (path: string) => existsSync(path) || isLink(path)

/**
 * Point `root`'s task cache at `dir`. What was there first is recorded once and put back by
 * `restoreCache`: a symlink keeps its target, a real directory is renamed aside. A collision
 * (the aside name is taken) throws before anything is removed.
 */
function useCache(root: string, dir: string): void {
  assertDisposable(root)
  const link = cacheLink(root)
  mkdirSync(join(root, 'node_modules', '.vite'), { recursive: true })
  mkdirSync(dir, { recursive: true })
  if (!originals.has(root)) {
    if (!present(link)) originals.set(root, { kind: 'none' })
    else if (isLink(link)) {
      originals.set(root, { kind: 'link', target: readlinkSync(link) })
      rmSync(link)
    } else {
      const aside = `${link}.proof-backup`
      if (present(aside)) throw new Error(`${aside} already exists; refusing to replace ${link}`)
      renameSync(link, aside)
      originals.set(root, { kind: 'dir', aside })
    }
  } else if (isLink(link)) rmSync(link)
  else if (present(link)) throw new Error(`${link} is unexpectedly not the harness symlink`)
  symlinkSync(dir, link)
}

/** Undo `useCache` for the roots it was applied to, and for no other root. */
function restoreCache(root: string): void {
  const original = originals.get(root)
  if (!original) return
  const link = cacheLink(root)
  if (isLink(link)) rmSync(link)
  else if (present(link)) throw new Error(`${link} is not the harness symlink; leaving it alone`)
  if (original.kind === 'link') symlinkSync(original.target, link)
  else if (original.kind === 'dir') renameSync(original.aside, link)
  originals.delete(root)
}

function freshCache(...targets: string[]): string {
  const dir = mkdtempSync(join(scratch, 'cache-'))
  for (const root of targets.length ? targets : [repo]) useCache(root, dir)
  return dir
}

type RunOptions = { root?: string; env?: Record<string, string | undefined>; args?: string[] }

/**
 * Variables that relocate the task cache or switch on a remote one. Vite Task reads
 * `VITE_CACHE_PATH` ahead of the `node_modules/.vite/task-cache` symlink, so an inherited value
 * would send the proof to an external cache; a remote-cache variable would leave the machine.
 * Every `vp` subprocess gets an environment without them.
 */
const CACHE_OVERRIDES = /^(VITE_CACHE_PATH|VP_REMOTE_CACHE(_[A-Z]+)*)$/

/** The environment for a `vp` subprocess: the inherited one, minus cache overrides, plus `extra`. */
function cleanEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = { ...process.env, NO_COLOR: '1' }
  for (const name of Object.keys(env)) if (CACHE_OVERRIDES.test(name)) delete env[name]
  for (const [name, value] of Object.entries(extra)) {
    if (CACHE_OVERRIDES.test(name)) continue
    if (value === undefined) delete env[name]
    else env[name] = value
  }
  return env as NodeJS.ProcessEnv
}

/** Every `vp` child still running, so cleanup can stop them. Each leads its own process group. */
const liveChildren = new Set<ChildProcess>()

function killGroup(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch {
    // the group ended between the check and the signal
  }
}

function killLiveChildren(): void {
  for (const child of liveChildren) killGroup(child)
}

/** A `vp` run that has not finished by now is stuck; it is killed and reported as exit -1. */
const RUN_TIMEOUT_MS = 300_000

/** Start `vp run <task>`; the promise settles when the process exits or the timeout kills it. */
function startVp(task: string, options: RunOptions = {}): Promise<Run> {
  const root = options.root ?? repo
  const env = cleanEnv(options.env)
  const started = performance.now()
  return new Promise((done) => {
    const child = spawn(
      join(root, 'node_modules', '.bin', 'vp'),
      ['run', task, ...(options.args ?? [])],
      { cwd: root, env, detached: true }
    )
    liveChildren.add(child)
    const timer = setTimeout(() => killGroup(child), RUN_TIMEOUT_MS)
    let raw = ''
    child.stdout.on('data', (chunk) => (raw += chunk))
    child.stderr.on('data', (chunk) => (raw += chunk))
    child.on('close', (code) => {
      clearTimeout(timer)
      liveChildren.delete(child)
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
  assertDisposable(root)
  const path = join(root, file)
  touched.add(`${root}\0${file}`)
  appendFileSync(path, text)
  if (injectFailure) throw new Error('injected failure after a tracked-file edit')
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
  const other = addWorktree(repo, join(scratch, 'wt-b'))
  check(s, 'second worktree installed', '0', String(install(other)))

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
  env: Record<string, string> = {},
  root = repo
): Promise<number | null> {
  const child = spawn(join(root, 'node_modules', '.bin', 'vp'), ['run', task], {
    cwd: root,
    env: cleanEnv(env),
    detached: true,
    stdio: 'ignore',
  })
  liveChildren.add(child)
  const exited = new Promise<number | null>((done) =>
    child.once('exit', (code) => {
      liveChildren.delete(child)
      done(code)
    })
  )
  await new Promise((done) => setTimeout(done, delay))
  killGroup(child)
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
    check(s, `build killed at ${delay}ms: database`, 'ok', file ? integrityOfCopy(file) : 'missing')
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
  const survivorExits: number[] = []
  for (let round = 0; round < rounds; round += 1) {
    const env = (n: number) => ({ PROOF_TOOLCHAIN: `round-${round}-${n}` })
    const [survivor] = await Promise.all([
      startVp('proof:registry', { env: env(0) }),
      killedAfter('proof:registry', 40 + ((round * 37) % 380), env(1)),
      killedAfter('proof:registry', 20 + ((round * 53) % 300), env(2)),
    ])
    survivorExits.push(survivor.exit)
  }
  check(
    s,
    `${rounds} rounds: the writer that was not killed exited 0`,
    String(rounds),
    String(survivorExits.filter((code) => code === 0).length)
  )
  const after = cacheDb(dir)
  check(
    s,
    `${rounds} rounds, 2 of 3 writers killed: database`,
    'ok',
    after ? integrityOfCopy(after) : 'missing'
  )
  await vp(s, 'next run succeeds', 'proof:registry', 'hit|executed*')
  await vp(s, 'and then hits', 'proof:registry', 'hit')

  // Snapshots of the cache directory while four writers run back to back.
  const live = freshCache()
  const loop = { running: true }
  const writerExits: number[] = []
  const writers = (async () => {
    for (let round = 0; loop.running; round += 1) {
      const runs = await Promise.all(
        [0, 1, 2, 3].map((n) =>
          startVp('proof:registry', { env: { PROOF_TOOLCHAIN: `snap-${round}-${n}` } })
        )
      )
      writerExits.push(...runs.map((run) => run.exit))
    }
  })()
  // Per method: how many snapshots, how many were torn (the copy opened badly or failed
  // integrity_check), and how many could not be taken at all.
  const methods = {
    'directory copy': { total: 0, torn: 0, failed: 0 },
    'database file only': { total: 0, torn: 0, failed: 0 },
    'VACUUM INTO': { total: 0, torn: 0, failed: 0 },
  }
  const reasons = new Map<string, number>()
  const tally = (method: keyof typeof methods, state: 'ok' | 'torn' | 'failed', why = '') => {
    methods[method].total += 1
    if (state !== 'ok') {
      methods[method][state] += 1
      const key = `${method}, ${state}: ${why.split('\n')[0]?.slice(0, 70)}`
      reasons.set(key, (reasons.get(key) ?? 0) + 1)
    }
  }
  const verdict = (method: keyof typeof methods, file: string) => {
    const result = integrityOfCopy(file)
    if (result === 'ok') tally(method, 'ok')
    else tally(method, 'torn', result)
  }
  try {
    const deadline = performance.now() + 20_000
    while (performance.now() < deadline) {
      const file = cacheDb(live)
      if (file) {
        const whole = mkdtempSync(join(scratch, 'snap-'))
        const bare = mkdtempSync(join(scratch, 'snap-'))
        try {
          try {
            cpSync(join(file, '..'), whole, { recursive: true })
            verdict('directory copy', join(whole, 'cache.db'))
          } catch (error) {
            tally('directory copy', 'failed', String(error))
          }
          try {
            copyFileSync(file, join(bare, 'cache.db'))
            verdict('database file only', join(bare, 'cache.db'))
          } catch (error) {
            tally('database file only', 'failed', String(error))
          }
          // SQLite's own consistent snapshot, taken from a read-only connection while vp writes.
          const target = join(bare, 'vacuum.db')
          try {
            const reader = new Database(file, { readonly: true })
            try {
              reader.run('PRAGMA busy_timeout = 5000')
              reader.run(`VACUUM INTO '${target}'`)
            } finally {
              reader.close()
            }
            verdict('VACUUM INTO', target)
          } catch (error) {
            tally('VACUUM INTO', 'failed', String(error))
          }
        } finally {
          rmSync(whole, { recursive: true, force: true })
          rmSync(bare, { recursive: true, force: true })
        }
      }
      await new Promise((done) => setTimeout(done, 15))
    }
  } finally {
    loop.running = false
    killLiveChildren()
    await Promise.allSettled([writers])
  }
  for (const [reason, n] of reasons) notes.push(`snapshots: ${n} x ${reason}`)
  for (const [method, count] of Object.entries(methods)) {
    notes.push(
      `snapshots: ${method}: ${count.total} taken during writes, ${count.torn} torn, ${count.failed} not taken`
    )
  }
  // A mid-run saver needs a method that is never torn; a file copy is reported, not required.
  check(s, 'VACUUM INTO snapshots during writes: torn', '0', String(methods['VACUUM INTO'].torn))
  check(
    s,
    'VACUUM INTO snapshots during writes: not taken',
    '0',
    String(methods['VACUUM INTO'].failed)
  )
  check(s, 'directory copies during writes: torn', '0', String(methods['directory copy'].torn))
  const settled = cacheDb(live)
  check(s, 'database after the writers stop', 'ok', settled ? integrityOfCopy(settled) : 'missing')
  // A run with no live writers or no snapshots proves nothing, so both must be positive.
  check(s, 'live writers ran', 'true', String(writerExits.length >= 8))
  check(
    s,
    'every live writer exited 0',
    '0',
    String(writerExits.filter((code) => code !== 0).length)
  )
  for (const [method, count] of Object.entries(methods)) {
    check(
      s,
      `${method}: snapshots taken during writes (at least 50)`,
      'true',
      String(count.total - count.failed >= 50)
    )
  }
}

const artifactDir = (root: string) => join(root, 'packages', 'ui', '.proof-artifact')
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

const expectedArtifacts = new Map<string, Record<string, string>>()

/** The output `proof:artifact` must produce for `token`, from a throwaway uncached run. */
function expectedArtifact(token: string): Record<string, string> {
  const known = expectedArtifacts.get(token)
  if (known) return known
  const cwd = mkdtempSync(join(scratch, 'expected-'))
  spawnSync(
    'node',
    [join(repo, 'packages', 'ui', 'scripts', 'vite-task-cache-proof-artifact.mjs')],
    { cwd, env: { ...process.env, PROOF_TOOLCHAIN: token } }
  )
  const result = manifest(artifactDir(cwd))
  expectedArtifacts.set(token, result)
  return result
}

type Verdict = 'hit' | 'miss' | 'wrong' | 'unusable'

/** Run the artifact task for `token` in `root` and compare what it left with the expected bytes. */
async function replayEntry(root: string, token: string): Promise<Verdict> {
  // Empty the directory but keep it: the fingerprint sees whether it exists, so removing it
  // would be a miss for a reason that has nothing to do with the restored cache.
  rmSync(artifactDir(root), { recursive: true, force: true })
  mkdirSync(artifactDir(root), { recursive: true })
  const run = await startVp('proof:artifact', { root, env: { PROOF_TOOLCHAIN: token } })
  if (run.exit !== 0) return 'unusable'
  if (!sameManifest(manifest(artifactDir(root)), expectedArtifact(token))) return 'wrong'
  return run.outcome === 'hit' ? 'hit' : 'miss'
}

function versionDir(dir: string): string {
  const found = readdirSync(dir).find((entry) => existsSync(join(dir, entry, 'cache.db')))
  if (!found) throw new Error(`no cache.db under ${dir}`)
  return found
}

const archives = (dir: string) => readdirSync(dir).filter((entry) => entry.endsWith('.tar.zst'))

function vacuumInto(from: string, to: string): void {
  const db = new Database(from, { readonly: true })
  try {
    db.run('PRAGMA busy_timeout = 5000')
    db.run(`VACUUM INTO '${to}'`)
  } finally {
    db.close()
  }
}

function copyArchives(from: string, to: string): void {
  for (const name of archives(from)) copyFileSync(join(from, name), join(to, name))
}

/** The ways to take a copy of a live cache directory that this scenario tests. */
const snapshotMethods: Record<string, (live: string, dest: string) => void> = {
  'directory copy': (live, dest) => cpSync(live, dest, { recursive: true }),
  'VACUUM INTO, then archives': (live, dest) => {
    const v = versionDir(live)
    mkdirSync(join(dest, v), { recursive: true })
    vacuumInto(join(live, v, 'cache.db'), join(dest, v, 'cache.db'))
    copyArchives(join(live, v), join(dest, v))
  },
  'archives, then VACUUM INTO': (live, dest) => {
    const v = versionDir(live)
    mkdirSync(join(dest, v), { recursive: true })
    copyArchives(join(live, v), join(dest, v))
    vacuumInto(join(live, v, 'cache.db'), join(dest, v, 'cache.db'))
  },
  'database file, then archives': (live, dest) => {
    const v = versionDir(live)
    mkdirSync(join(dest, v), { recursive: true })
    copyFileSync(join(live, v, 'cache.db'), join(dest, v, 'cache.db'))
    copyArchives(join(live, v), join(dest, v))
  },
}

type Tally = Record<Verdict | 'snapshots' | 'failed', number>
const emptyTally = (): Tally => ({
  hit: 0,
  miss: 0,
  wrong: 0,
  unusable: 0,
  snapshots: 0,
  failed: 0,
})

/**
 * Restore a copied cache and replay it. SQLite integrity is not enough: a copy can open and
 * still reference an archive that is missing or half written. Every entry that had finished
 * before the copy started is replayed from the restored copy in a second worktree, and what
 * it leaves is compared with the bytes a fresh run produces.
 */
async function restoreReplay(): Promise<void> {
  const s = 'restore'
  // Each concurrent writer needs its own worktree: the task's outputs are one fixed directory,
  // and two runs writing it at once would archive each other's files.
  const laneRoots = [
    repo,
    ...[1, 2, 3].map((lane) => addWorktree(repo, join(scratch, `wt-lane-${lane}`))),
  ]
  const replayRoot = addWorktree(repo, join(scratch, 'wt-replay'))
  const installs = [...laneRoots.slice(1), replayRoot].map((root) => install(root))
  check(
    s,
    'lane and replay worktrees installed',
    '0',
    String(installs.find((code) => code !== 0) ?? 0)
  )
  for (const root of [...laneRoots, replayRoot]) mkdirSync(artifactDir(root), { recursive: true })
  const live = freshCache(...laneRoots)

  const completed: string[] = []
  const writerExits: number[] = []
  const state = { running: true, stopped: 0 }
  const lanes = [0, 1, 2].map(async (lane) => {
    let consecutiveFailures = 0
    for (let n = 0; state.running && consecutiveFailures < 3; n += 1) {
      const token = `w${lane}-${n}`
      const run = await startVp(injectWriterFailure ? 'proof:does-not-exist' : 'proof:artifact', {
        root: laneRoots[lane],
        env: { PROOF_TOOLCHAIN: token },
      })
      writerExits.push(run.exit)
      if (run.exit === 0) {
        completed.push(token)
        consecutiveFailures = 0
      } else consecutiveFailures += 1
      await sleep(120)
    }
    state.stopped += 1
  })
  try {
    // Startup is bounded: writers that keep failing, or never finish, fail the scenario.
    const startupDeadline = performance.now() + 120_000
    while (completed.length < 6) {
      if (state.stopped === lanes.length || performance.now() > startupDeadline) {
        check(
          s,
          'writers produced entries (at least 6)',
          'true',
          `false (${completed.length} finished; exits ${JSON.stringify(writerExits.slice(0, 12))})`
        )
        return
      }
      await sleep(50)
    }

    const tallies = Object.fromEntries(
      Object.keys(snapshotMethods).map((name) => [name, emptyTally()])
    ) as Record<string, Tally>
    const rounds = 12
    for (let round = 0; round < rounds; round += 1) {
      await sleep(100 + ((round * 61) % 200))
      const finished = completed.slice(-3)
      for (const [name, take] of Object.entries(snapshotMethods)) {
        const tally = tallies[name]!
        const dest = mkdtempSync(join(scratch, 'restored-'))
        try {
          take(live, dest)
        } catch {
          tally.failed += 1
          continue
        }
        tally.snapshots += 1
        useCache(replayRoot, dest)
        for (const token of finished) tally[await replayEntry(replayRoot, token)] += 1
        rmSync(dest, { recursive: true, force: true })
      }
    }
    state.running = false
    await Promise.all(lanes)
    check(s, 'live writers ran (at least 20)', 'true', String(writerExits.length >= 20))
    check(
      s,
      'every live writer exited 0',
      '0',
      String(writerExits.filter((code) => code !== 0).length)
    )

    // Only `VACUUM INTO` then archives is documented as a transport for a live cache. For it,
    // every entry finished before the copy must replay as a hit with the right bytes. The other
    // methods are reported, and are held only to never serving wrong bytes.
    const supported = new Set(['VACUUM INTO, then archives'])
    for (const [name, tally] of Object.entries(tallies)) {
      const isSupported = supported.has(name)
      notes.push(
        `restore: ${name} (${isSupported ? 'supported transport' : 'not a supported transport, reported only'}): ${tally.snapshots} taken during writes (${tally.failed} not taken), replayed ${tally.hit} hit, ${tally.miss} miss, ${tally.wrong} wrong output, ${tally.unusable} unusable`
      )
      check(s, `${name}: restored entries that replayed wrong output`, '0', String(tally.wrong))
      if (!isSupported) continue
      check(
        s,
        `${name}: copies taken during writes (at least 8)`,
        'true',
        String(tally.snapshots >= 8)
      )
      check(s, `${name}: every replay was a hit`, String(tally.snapshots * 3), String(tally.hit))
      check(
        s,
        `${name}: replays that were misses or unusable`,
        '0',
        String(tally.miss + tally.unusable)
      )
    }

    // The control: a copy taken once the writers have stopped is the Actions save situation.
    const quiet = mkdtempSync(join(scratch, 'restored-'))
    snapshotMethods['directory copy']!(live, quiet)
    useCache(replayRoot, quiet)
    const verdicts: Verdict[] = []
    for (const token of completed.filter((_, index) => index % 7 === 0).slice(0, 12))
      verdicts.push(await replayEntry(replayRoot, token))
    check(s, 'quiescent copy: entries replayed', 'true', String(verdicts.length >= 6))
    check(
      s,
      'quiescent copy: every entry replayed as a hit with the right bytes',
      'true',
      String(verdicts.every((verdict) => verdict === 'hit'))
    )

    // Interrupted writers: kill some mid-run in waves, one writer per worktree, then copy once
    // everything has stopped.
    const killedLive = freshCache(...laneRoots)
    const killed = Array.from({ length: 8 }, (_, n) => `k${n}`)
    const survivors = Array.from({ length: 4 }, (_, n) => `s${n}`)
    const killedExits: (number | null)[] = []
    for (const wave of [killed.slice(0, 4), killed.slice(4)]) {
      killedExits.push(
        ...(await Promise.all(
          wave.map((token, n) =>
            killedAfter('proof:artifact', 25 + n * 45, { PROOF_TOOLCHAIN: token }, laneRoots[n])
          )
        ))
      )
    }
    const survivorExits = await Promise.all(
      survivors.map((token, n) =>
        startVp('proof:artifact', { root: laneRoots[n], env: { PROOF_TOOLCHAIN: token } }).then(
          (run) => run.exit
        )
      )
    )
    check(
      s,
      'interrupted: the writers that were not killed exited 0',
      '4',
      String(survivorExits.filter((code) => code === 0).length)
    )
    const killedDb = cacheDb(killedLive)
    check(s, 'interrupted: database', 'ok', killedDb ? integrityOfCopy(killedDb) : 'missing')
    const after = mkdtempSync(join(scratch, 'restored-'))
    snapshotMethods['directory copy']!(killedLive, after)
    useCache(replayRoot, after)
    const results: Record<string, Verdict> = {}
    for (const token of [...survivors, ...killed])
      results[token] = await replayEntry(replayRoot, token)
    check(
      s,
      'interrupted: survivors replayed as hits with the right bytes',
      'true',
      String(survivors.every((token) => results[token] === 'hit'))
    )
    check(
      s,
      'interrupted: killed entries never replayed wrong or unusable',
      'true',
      String(killed.every((token) => results[token] === 'hit' || results[token] === 'miss'))
    )
    notes.push(
      `restore: after SIGKILL at staggered points: ${killed.map((token) => results[token]).join(', ')}`
    )
  } finally {
    // Stop and await the writers and any child still running, whether the scenario passed or threw.
    state.running = false
    killLiveChildren()
    await Promise.allSettled(lanes)
  }
}

/** A comparable description of a checkout's tracked changes, untracked files and cache entry. */
function exactState(root: string): string {
  const files = git(root, 'ls-files', '-m', '-o', '--exclude-standard').split('\n').filter(Boolean)
  const parts = files.toSorted().map((file) => {
    const path = join(root, file)
    return `${file} ${statSync(path).mode.toString(8)} ${createHash('sha256').update(readFileSync(path)).digest('hex')}`
  })
  const cache = cacheLink(root)
  const cacheKind = isLink(cache)
    ? `link->${readlinkSync(cache)}`
    : existsSync(cache)
      ? `dir:${readdirSync(cache).toSorted().join(',')}`
      : 'absent'
  const aside = `${cache}.proof-backup`
  const asideKind = present(aside) ? `dir:${readdirSync(aside).toSorted().join(',')}` : 'absent'
  return [
    git(root, 'status', '--porcelain'),
    ...parts,
    `cache ${cacheKind}`,
    `aside ${asideKind}`,
  ].join('\n')
}

function tracked(file: string, text: string): void {
  writeFileSync(file, text)
}

/** Fixtures for the cache helpers, in the scratch directory, with sentinel files. */
function fixtureRoot(name: string): string {
  const root = join(scratch, name)
  mkdirSync(join(root, 'node_modules', '.vite'), { recursive: true })
  return root
}

function sentinelDir(path: string, text: string): string {
  mkdirSync(path, { recursive: true })
  tracked(join(path, 'sentinel'), text)
  return path
}

const sentinel = (path: string) =>
  existsSync(join(path, 'sentinel')) ? readFileSync(join(path, 'sentinel'), 'utf8') : 'missing'

function throws(fn: () => void): boolean {
  try {
    fn()
    return false
  } catch {
    return true
  }
}

/**
 * Regression tests for the harness's own data safety: pre-existing edits, cache symlinks and
 * cache directories survive a normal run, an actions-only run and a run that fails part way.
 */
async function safety(): Promise<void> {
  const s = 'safety'

  // The helpers refuse a root outside the scratch directory (a stand-in for the user's checkout).
  const foreign = mkdtempSync(join(tmpdir(), 'vite-task-cache-proof-foreign-'))
  try {
    const target = sentinelDir(join(foreign, 'target'), 'foreign target')
    mkdirSync(join(foreign, 'node_modules', '.vite'), { recursive: true })
    symlinkSync(target, cacheLink(foreign))
    writeFileSync(join(foreign, 'tracked.txt'), 'user edit')
    check(
      s,
      'useCache refuses a root outside the scratch directory',
      'true',
      String(throws(() => useCache(foreign, join(scratch, 'x'))))
    )
    check(
      s,
      'edit refuses a root outside the scratch directory',
      'true',
      String(throws(() => edit(foreign, 'tracked.txt', 'x')))
    )
    check(
      s,
      'the refused root is unchanged',
      `link->${target}|user edit|foreign target`,
      `${isLink(cacheLink(foreign)) ? `link->${readlinkSync(cacheLink(foreign))}` : 'changed'}|${readFileSync(join(foreign, 'tracked.txt'), 'utf8')}|${sentinel(target)}`
    )
    restoreCache(foreign)
    check(
      s,
      'restoreCache on a root it never used leaves its symlink',
      'true',
      String(isLink(cacheLink(foreign)))
    )
  } finally {
    rmSync(foreign, { recursive: true, force: true })
  }

  // A pre-existing symlink keeps its target.
  const linked = fixtureRoot('fx-link')
  const linkTarget = sentinelDir(join(scratch, 'fx-link-target'), 'link target')
  symlinkSync(linkTarget, cacheLink(linked))
  useCache(linked, join(scratch, 'fx-link-scratch'))
  restoreCache(linked)
  check(
    s,
    'a pre-existing symlink is restored to its own target',
    linkTarget,
    isLink(cacheLink(linked)) ? readlinkSync(cacheLink(linked)) : 'not a link'
  )
  check(s, 'the symlink target kept its contents', 'link target', sentinel(linkTarget))

  // A pre-existing real directory is moved aside and put back.
  const real = fixtureRoot('fx-dir')
  sentinelDir(cacheLink(real), 'real cache')
  useCache(real, join(scratch, 'fx-dir-scratch'))
  restoreCache(real)
  check(
    s,
    'a pre-existing cache directory is put back',
    'real cache',
    !isLink(cacheLink(real)) ? sentinel(cacheLink(real)) : 'a link'
  )

  // A name collision fails before anything is removed.
  const collide = fixtureRoot('fx-collision')
  sentinelDir(cacheLink(collide), 'current cache')
  sentinelDir(`${cacheLink(collide)}.proof-backup`, 'older backup')
  check(
    s,
    'a backup collision throws',
    'true',
    String(throws(() => useCache(collide, join(scratch, 'fx-col-scratch'))))
  )
  restoreCache(collide)
  check(s, 'the collision kept the current cache', 'current cache', sentinel(cacheLink(collide)))
  check(
    s,
    'the collision kept the older backup',
    'older backup',
    sentinel(`${cacheLink(collide)}.proof-backup`)
  )

  // An inherited cache override must not reach `vp`: Vite Task reads VITE_CACHE_PATH ahead of
  // the scratch symlink, so an external cache would be used and mutated.
  const external = sentinelDir(join(scratch, 'external-cache'), 'external cache')
  const inherited = {
    VITE_CACHE_PATH: process.env['VITE_CACHE_PATH'],
    VP_REMOTE_CACHE: process.env['VP_REMOTE_CACHE'],
    VP_REMOTE_CACHE_URL: process.env['VP_REMOTE_CACHE_URL'],
  }
  process.env['VITE_CACHE_PATH'] = external
  process.env['VP_REMOTE_CACHE'] = 'write'
  process.env['VP_REMOTE_CACHE_URL'] = 'http://127.0.0.1:9'
  try {
    const sanitized = cleanEnv({ VITE_CACHE_PATH: external })
    const leaked = ['VITE_CACHE_PATH', 'VP_REMOTE_CACHE', 'VP_REMOTE_CACHE_URL'].filter(
      (name) => name in sanitized
    )
    check(
      s,
      'the child environment has no cache override or remote-cache variable',
      'none',
      leaked.join() || 'none'
    )
    const scratchCache = freshCache()
    mkdirSync(artifactDir(repo), { recursive: true })
    await vp(s, 'with VITE_CACHE_PATH inherited: cold', 'proof:artifact', 'executed*', {
      env: { PROOF_TOOLCHAIN: 'override-probe', VITE_CACHE_PATH: external },
    })
    await vp(s, 'with VITE_CACHE_PATH inherited: warm', 'proof:artifact', 'hit', {
      env: { PROOF_TOOLCHAIN: 'override-probe' },
    })
    await killedAfter('proof:artifact', 5, { PROOF_TOOLCHAIN: 'override-kill' })
    check(
      s,
      'the external cache received nothing',
      'external cache|sentinel',
      `${sentinel(external)}|${readdirSync(external).join()}`
    )
    check(
      s,
      'the scratch cache received the entries',
      'true',
      String(cacheDb(scratchCache) !== undefined)
    )
  } finally {
    for (const [name, value] of Object.entries(inherited)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }

  // A user checkout with edits, an untracked file, a changed mode and a cache symlink.
  const user = addWorktree(repo, join(scratch, 'user'))
  check(s, 'fixture checkout installed', '0', String(install(user)))
  for (const file of [
    'packages/ui/scripts/check-cn-tables.ts',
    TRACKED_SCRIPT,
    SOURCE_FILE,
    'packages/ui/tests/font-zoom.test.ts',
  ])
    appendFileSync(join(user, file), `\n// user edit: ${file}\n`)
  spawnSync('chmod', ['755', join(user, SOURCE_FILE)])
  tracked(join(user, 'packages', 'ui', 'UNTRACKED_NOTE.txt'), 'untracked user file\n')
  const harness = join(user, 'packages', 'ui', 'scripts', 'vite-task-cache-proof.ts')
  const inner = (harnessArgs: string[], env: Record<string, string> = {}) =>
    spawnSync('bun', [harness, ...harnessArgs], {
      cwd: user,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout: 600_000,
      killSignal: 'SIGKILL',
    })

  // 1: an actions-only run does not touch an existing cache symlink (it never used one).
  const userCacheTarget = sentinelDir(join(scratch, 'user-cache-target'), 'user cache target')
  mkdirSync(join(user, 'node_modules', '.vite'), { recursive: true })
  symlinkSync(userCacheTarget, cacheLink(user))
  const beforeActions = exactState(user)
  const actionsOnly = inner(['actions', `--out=${join(scratch, 'inner-actions.json')}`])
  check(s, 'actions-only run on a dirty checkout: exit', '0', String(actionsOnly.status))
  check(
    s,
    'actions-only run: edits, untracked file, mode and cache symlink unchanged',
    'true',
    String(exactState(user) === beforeActions)
  )

  // 2: a full scenario run on the dirty checkout, with a symlinked cache.
  const beforeRun = exactState(user)
  const innerExternal = sentinelDir(join(scratch, 'inner-external-cache'), 'inner external cache')
  const run = inner(['tracking', `--out=${join(scratch, 'inner-tracking.json')}`], {
    VITE_CACHE_PATH: innerExternal,
  })
  check(
    s,
    'tracking run with VITE_CACHE_PATH set: the external cache is untouched',
    'inner external cache|sentinel',
    `${sentinel(innerExternal)}|${readdirSync(innerExternal).join()}`
  )
  check(s, 'tracking run on a dirty checkout: exit', '0', String(run.status))
  check(
    s,
    'tracking run: edits, untracked file, mode and cache symlink unchanged',
    'true',
    String(exactState(user) === beforeRun)
  )
  check(
    s,
    'tracking run: symlink target kept its contents',
    'user cache target',
    sentinel(userCacheTarget)
  )

  // 3: a run that fails right after its first edit, with a real cache and a backup already in place.
  rmSync(cacheLink(user))
  sentinelDir(cacheLink(user), 'user real cache')
  sentinelDir(`${cacheLink(user)}.proof-backup`, 'user older backup')
  const beforeFailure = exactState(user)
  const failure = inner(['tracking', `--out=${join(scratch, 'inner-failure.json')}`], {
    PROOF_INJECT_FAILURE: '1',
  })
  check(s, 'injected failure: the run exits non-zero', 'true', String(failure.status !== 0))
  check(
    s,
    'injected failure: the failure came from the injection',
    'true',
    String(/injected failure/.test(failure.stderr))
  )
  check(
    s,
    'injected failure: edits, untracked file, mode, cache and backup unchanged',
    'true',
    String(exactState(user) === beforeFailure)
  )
  check(
    s,
    'injected failure: the cache kept its contents',
    'user real cache',
    sentinel(cacheLink(user))
  )
  check(
    s,
    'injected failure: the backup kept its contents',
    'user older backup',
    sentinel(`${cacheLink(user)}.proof-backup`)
  )

  // 4: writers that always fail: the restore scenario ends promptly, reports the failed exits and
  // leaves nothing behind.
  const writersStarted = performance.now()
  const writersFail = inner(['restore', `--out=${join(scratch, 'inner-writers.json')}`], {
    PROOF_INJECT_WRITER_FAILURE: '1',
  })
  check(s, 'failing writers: the run ends non-zero', 'true', String(writersFail.status !== 0))
  check(
    s,
    'failing writers: the run ended within 5 minutes',
    'true',
    String(performance.now() - writersStarted < 300_000)
  )
  const writersReport = existsSync(join(scratch, 'inner-writers.json'))
    ? readFileSync(join(scratch, 'inner-writers.json'), 'utf8')
    : ''
  check(
    s,
    'failing writers: the failed exits are reported',
    'true',
    String(/writers produced entries/.test(writersReport) && /finished; exits/.test(writersReport))
  )
  const leftovers = git(user, 'worktree', 'list')
    .split('\n')
    .filter((line) => /vite-task-cache-proof-/.test(line) && !line.startsWith(scratch))
  check(s, 'failing writers: no disposable worktree is left behind', '0', String(leftovers.length))
  check(
    s,
    'failing writers: the dirty checkout is unchanged',
    'true',
    String(exactState(user) === beforeFailure)
  )
  notes.push(
    'safety: the dirty fixture checkout is a worktree of the disposable one; the harness under test treated it as the user checkout'
  )
}

/** Static evidence that the Actions workflow keeps cache writes to trusted runs. */
function actions(): Promise<void> {
  const s = 'actions'
  const file = join(
    existsSync(repo) ? repo : source,
    '.github',
    'workflows',
    'vite-task-cache-proof.yml'
  )
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
  restore: restoreReplay,
  actions,
  safety,
}

async function main(): Promise<void> {
  const version = spawnSync(join(source, 'node_modules', '.bin', 'vp'), ['--version'], {
    encoding: 'utf8',
    env: cleanEnv(),
  })
  notes.push(`vp: ${version.stdout.trim().split('\n')[0]}`)
  notes.push(
    `platform: ${process.platform}-${process.arch}, bun ${Bun.version}, node ${spawnSync('node', ['--version'], { encoding: 'utf8' }).stdout.trim()}`
  )
  notes.push(`base: ${git(source, 'rev-parse', 'HEAD').trim()}`)
  if (git(source, 'status', '--porcelain').trim())
    notes.push(
      'the starting checkout has uncommitted changes: they are not used and not touched, the run covers its committed HEAD'
    )

  const names = chosen.length ? chosen : Object.keys(scenarios)
  for (const name of names) {
    if (!scenarios[name])
      throw new Error(`unknown scenario ${name}; known: ${Object.keys(scenarios).join(', ')}`)
  }
  // The static workflow check is the only scenario that needs no installed worktree.
  if (names.some((name) => name !== 'actions')) {
    addWorktree(source, repo)
    check('setup', 'disposable worktree installed', '0', String(install(repo)))
  }
  for (const name of names) {
    console.error(`# ${name}`)
    await scenarios[name]!()
  }
}

let cleanedUp = false

/** Stop children, undo recorded mutations, remove the disposable worktrees and the scratch files. */
function cleanup(): void {
  if (cleanedUp) return
  cleanedUp = true
  killLiveChildren()
  // Undo only what the harness recorded, and only inside the scratch directory.
  for (const entry of touched) {
    const [root, file] = entry.split('\0') as [string, string]
    try {
      assertDisposable(root)
      git(root, 'checkout', '--', file)
    } catch (error) {
      console.error('cleanup:', error)
    }
  }
  for (const root of originals.keys()) {
    try {
      restoreCache(root)
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
  try {
    git(source, 'worktree', 'prune')
  } catch (error) {
    console.error('cleanup:', error)
  }
  writeFileSync(join(scratch, 'results.json'), JSON.stringify({ notes, rows }, null, 2))
  // Everything else in the scratch directory is disposable, caches and replayed outputs included.
  for (const entry of readdirSync(scratch)) {
    if (entry !== 'results.json') rmSync(join(scratch, entry), { recursive: true, force: true })
  }
}

// The whole run is bounded, and an interrupt cleans up too.
const RUN_BUDGET_MS = 60 * 60_000
const giveUp = (reason: string, code: number) => () => {
  console.error(`# ${reason}; cleaning up`)
  cleanup()
  process.exit(code)
}
setTimeout(giveUp(`the run exceeded ${RUN_BUDGET_MS / 60_000} minutes`, 124), RUN_BUDGET_MS).unref()
process.once('SIGINT', giveUp('interrupted', 130))
process.once('SIGTERM', giveUp('terminated', 143))

let failed = false
try {
  await main()
} catch (error) {
  failed = true
  console.error(error)
} finally {
  cleanup()
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
