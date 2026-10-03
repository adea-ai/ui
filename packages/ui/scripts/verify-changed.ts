/**
 * Run the local checks a branch's changes make necessary, and nothing else.
 *
 * Run: bun run verify:changed [--base=<ref>] [--plan]
 *
 * The changed set is everything that differs from the merge-base with the base
 * ref (default `origin/main`): committed, staged, unstaged and untracked. Each
 * check runs only when that set reaches it — see `verify-changed-plan.ts` for the
 * mapping. It deliberately includes the two gates only CI used to run, the
 * registry rebuild-and-diff and the component shard collection check, and
 * deliberately excludes anything that drives a browser or builds the workshop.
 *
 * `--plan` prints what would run and exits without running it. Every check runs
 * even after one fails, so one invocation reports every problem; the exit code is
 * non-zero if any failed.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { isGraphSource, planChecks, type Plan, type Workspace } from './verify-changed-plan'

const args = process.argv.slice(2)
const baseRef =
  args.find((arg) => arg.startsWith('--base='))?.slice('--base='.length) ?? 'origin/main'
const planOnly = args.includes('--plan')

function git(...gitArgs: string[]): string {
  const result = spawnSync('git', gitArgs, { encoding: 'utf8', cwd: repoRoot })
  if (result.status !== 0) {
    throw new Error(`git ${gitArgs.join(' ')} failed: ${result.stderr.trim()}`)
  }
  return result.stdout
}

const lines = (output: string) => output.split('\n').filter(Boolean)

const repoRoot = spawnSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).stdout.trim()
if (!repoRoot) {
  console.error('verify:changed must run inside the repository.')
  process.exit(2)
}

let mergeBase: string
try {
  mergeBase = git('merge-base', 'HEAD', baseRef).trim()
} catch {
  console.error(
    `verify:changed: no merge-base with ${baseRef}. Run \`git fetch origin\`, or pass --base=<ref>.`
  )
  process.exit(2)
}

// `--no-renames` lists a rename as its deletion and its addition, so the old path
// still selects the checks that read it.
const changed = [
  ...new Set([
    ...lines(git('diff', '--name-only', '--no-renames', mergeBase)),
    ...lines(git('ls-files', '--others', '--exclude-standard')),
  ]),
].toSorted()

if (changed.length === 0) {
  console.log(`verify:changed: nothing differs from ${baseRef} (${mergeBase.slice(0, 8)}).`)
  process.exit(0)
}

function workspaces(): Workspace[] {
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    workspaces: string[]
  }
  const found: Workspace[] = []
  for (const pattern of manifest.workspaces) {
    const parent = pattern.replace(/\/\*$/, '')
    for (const entry of readdirSync(join(repoRoot, parent)).toSorted()) {
      const manifestPath = join(repoRoot, parent, entry, 'package.json')
      if (!existsSync(manifestPath)) continue
      const { name } = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name: string }
      found.push({ dir: posix.join(parent, entry), name })
    }
  }
  return found
}

const sources = new Map<string, string>()
for (const path of lines(git('ls-files', '--cached', '--others', '--exclude-standard'))) {
  const absolute = join(repoRoot, path)
  if (isGraphSource(path) && existsSync(absolute)) sources.set(path, readFileSync(absolute, 'utf8'))
}

const plan: Plan = planChecks(changed, {
  workspaces: workspaces(),
  sources,
  exists: (path) => existsSync(join(repoRoot, path)),
})

type Outcome = { check: string; status: 'passed' | 'failed' | 'skipped'; detail: string }
const outcomes: Outcome[] = []
const bin = (name: string) => join(repoRoot, 'node_modules', '.bin', name)

function run(command: string[], cwd = '.'): boolean {
  const shown = command.map((part) =>
    part.startsWith(repoRoot) ? posix.relative(repoRoot, part) : part
  )
  console.log(`\n$ ${shown.join(' ')}${cwd === '.' ? '' : `   (in ${cwd})`}`)
  const result = spawnSync(command[0]!, command.slice(1), {
    cwd: join(repoRoot, cwd),
    stdio: 'inherit',
  })
  return result.status === 0
}

function record(check: string, ok: boolean, detail: string) {
  outcomes.push({ check, status: ok ? 'passed' : 'failed', detail })
}

function skip(check: string, detail: string) {
  outcomes.push({ check, status: 'skipped', detail })
}

const few = (paths: string[]) =>
  paths.length > 3 ? `${paths.slice(0, 3).join(', ')} +${paths.length - 3}` : paths.join(', ')

console.log(
  `verify:changed: ${changed.length} path(s) differ from ${baseRef} (merge-base ${mergeBase.slice(0, 8)})`
)

if (planOnly) {
  console.log(
    JSON.stringify(
      {
        ...plan,
        tests: plan.tests.map(({ root, files, reason }) => ({ root: root.dir, files, reason })),
      },
      null,
      2
    )
  )
  process.exit(0)
}

// --- registry: rebuild, then fail on any drift, as CI does ------------------
const REGISTRY_OUTPUTS = [
  'packages/ui/registry.json',
  'packages/ui/public/r',
  'packages/ui/src/lib/cn-tables.generated.ts',
]
if (plan.registry.length > 0) {
  const built = run(['bun', 'run', 'registry:build'])
  const drifted = [
    ...new Set([
      ...lines(git('diff', '--name-only', 'HEAD', '--', ...REGISTRY_OUTPUTS)),
      ...lines(git('ls-files', '--others', '--exclude-standard', '--', ...REGISTRY_OUTPUTS)),
    ]),
  ].toSorted()
  if (drifted.length > 0) {
    console.error(
      `\nThe registry build differs from what is committed (${drifted.length} file(s)). ` +
        'CI fails with "Registry is stale" until these are committed:'
    )
    for (const path of drifted.slice(0, 25)) console.error(`  ${path}`)
    if (drifted.length > 25) console.error(`  … and ${drifted.length - 25} more`)
  }
  record(
    'registry drift',
    built && drifted.length === 0,
    drifted.length > 0
      ? `${drifted.length} generated file(s) not committed — commit them`
      : `rebuilt for ${few(plan.registry)}`
  )
  record(
    'registry:validate',
    run(['bun', 'run', 'registry:validate']),
    'source, payloads, served tree'
  )
} else {
  skip('registry', 'no registry input changed')
}

// --- component shards: collection only, no browser ---------------------------
if (plan.componentShards.length > 0) {
  record(
    'component shards',
    run(['bun', 'scripts/check-component-shards.mjs'], 'apps/storybook'),
    `listed for ${few(plan.componentShards)}`
  )
} else {
  skip('component shards', 'no component spec or Playwright config changed')
}

// --- typecheck: turbo-cached, the changed workspaces and their dependents ----
// `--only` keeps turbo from building dependencies first: the typecheck configs
// resolve workspace packages to source, so a library build would be wasted work.
const { workspaces: typed, uncovered } = plan.typecheck
if (typed === 'all' || typed.length > 0) {
  const filters = typed === 'all' ? [] : typed.map((name) => `--filter=...${name}`)
  record(
    'typecheck',
    run([bin('turbo'), 'run', 'typecheck', '--only', ...filters]),
    typed === 'all'
      ? 'every workspace (a root tsconfig changed)'
      : `${typed.join(', ')} + dependents`
  )
} else {
  skip('typecheck', 'no TypeScript changed in a workspace')
}
if (uncovered.length > 0) skip('typecheck (outside workspaces)', few(uncovered))

// --- unit tests: only those that reach the change ----------------------------
if (plan.tests.length > 0) {
  for (const { root, files, reason } of plan.tests) {
    const targets =
      files === 'all'
        ? [`./${posix.relative(root.cwd, root.dir)}`]
        : files.map((file) => `./${posix.relative(root.cwd, file)}`)
    record(
      `tests ${root.dir}`,
      run([...root.command, ...targets], root.cwd),
      files === 'all' ? `whole suite: ${reason}` : reason
    )
  }
} else {
  skip('unit tests', 'no test reaches the change')
}

// --- format and lint: the changed files only --------------------------------
if (plan.format.length > 0) {
  record(
    'format',
    run([bin('oxfmt'), '--check', '--no-error-on-unmatched-pattern', ...plan.format]),
    `${plan.format.length} file(s)`
  )
} else {
  skip('format', 'only deletions')
}
if (plan.lint.length > 0) {
  record(
    'lint',
    run([bin('oxlint'), '--deny-warnings', '--no-error-on-unmatched-pattern', ...plan.lint]),
    `${plan.lint.length} file(s)`
  )
} else {
  skip('lint', 'no JavaScript or TypeScript changed')
}

// --- summary -----------------------------------------------------------------
const width = Math.max(...outcomes.map((outcome) => outcome.check.length))
console.log('\nverify:changed summary')
for (const { check, status, detail } of outcomes) {
  console.log(`  ${status.padEnd(7)}  ${check.padEnd(width)}  ${detail}`)
}
const failed = outcomes.filter((outcome) => outcome.status === 'failed')
if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed: ${failed.map((f) => f.check).join(', ')}`)
  process.exit(1)
}
console.log('\nAll affected checks passed.')
