import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'
import { expectedId } from './packages/ui/scripts/orch-toolchain.mjs'

/**
 * Vite Task cache proof (additive, not a gate).
 *
 * Production still runs through Turbo (`turbo.json`) and `bun test`; nothing here
 * replaces either. These tasks wrap the same package scripts so `vp run` can be
 * measured against them. Run through `vp run`, never by default:
 *
 *   vp run proof:typecheck   vp run proof:registry   vp run proof:build   vp run proof:unit
 *   vp run proof:artifact (small outputs, used only by the harness)
 *
 * Automatic tracking sees what `node` reads (`tsc`, `vite`) and not what the `bun`
 * runtime itself loads (the script it is started on, its static imports, a test file).
 * Every task that starts a `bun` script or `bun test` therefore adds explicit `input`
 * globs for those files. `proof:cn-check:auto` is the negative control that keeps
 * automatic tracking only, to show the stale hit those globs prevent.
 *
 * See docs/vite-task-cache-proof.md for what was measured and what is not claimed.
 */
// Names the toolchain and platform, which the fingerprint cannot see (a `bun` or `node`
// binary is not an input). CI sets it; locally it is empty.
const toolchain = ['PROOF_TOOLCHAIN']

const bunLoaded = [
  'packages/ui/scripts/**',
  'packages/ui/package.json',
  'packages/ui/cn.config.ts',
  'bunfig.toml',
]

// Orchestration tasks (`orch:*`). They mirror the Turbo graph in `turbo.json` for this repository
// (`build`, `typecheck`, `lint`, `test`, with `test` after the library `build` the way
// `dependsOn: ["^build"]` orders it) and run the same package scripts, so Bun keeps running the
// tests. They are additive: nothing in CI or `verify` calls them yet, and the root `turbo` scripts
// are unchanged. Names are prefixed because a task may not share a name with a root script.
//
// `auto` tracking sees what `node`, `tsc` and `vite` read. Files that `bun` or `oxlint` load
// themselves are listed explicitly (see `bunLoaded` above), and so is everything a task reads
// through a glob or a package boundary that a read-trace would otherwise have to discover.
// The actual Node, Bun and platform identity of this invocation's `orch:*` tasks, computed each time `vp`
// loads this file and written into their command text, so it is part of every cache key. The uncached
// `orch:toolchain` task checks it against the PATH the tasks really get, before any of them runs. See
// packages/ui/scripts/orch-toolchain.mjs; nothing here is shared between invocations.
const toolchainId = expectedId(dirname(fileURLToPath(import.meta.url)))
const libSources = [
  'packages/ui/src/**',
  'packages/ui/tests/**',
  'packages/ui/public/r/**',
  'packages/ui/registry.json',
  'packages/ui/design-system/**',
  'packages/ui/tsconfig*.json',
  'packages/ui/vite.config.ts',
  'packages/ui/components.json',
  'tsconfig.json',
  'bun.lock',
]
const workshopSources = [
  'apps/storybook/**',
  '!apps/storybook/node_modules/**',
  '!apps/storybook/storybook-static/**',
  '!apps/storybook/test-results/**',
  '!apps/storybook/playwright-report/**',
]
const lintConfig = ['.oxlintrc.json']

type OrchTask = {
  command: string
  dependsOn?: string[]
  cache: { input: Array<string | { auto: boolean }>; output?: string[]; env?: string[] }
}

/**
 * Adds the toolchain identity to a cached `orch:*` task: the id is part of its command text, and the task
 * runs after `orch:toolchain` has checked it.
 */
const orch = (task: OrchTask) => ({
  ...task,
  command: `ORCH_TOOLCHAIN=${toolchainId} ${task.command}`,
  dependsOn: ['orch:toolchain', ...(task.dependsOn ?? [])],
})

export default defineConfig({
  run: {
    tasks: {
      // Not cached: it runs on every invocation, with the PATH the tasks get, and exits non-zero unless the
      // `node`, `bun` and platform it finds are the ones named in the other tasks' commands (or if it cannot
      // identify them). Then no dependent task runs or touches the cache.
      'orch:toolchain': {
        command: `node packages/ui/scripts/orch-toolchain.mjs --expect ${toolchainId}`,
        cache: false,
      },
      'orch:ui:typecheck': orch({
        command: 'bun run --cwd packages/ui typecheck',
        cache: { input: [{ auto: true }, ...libSources] },
      }),
      'orch:storybook:typecheck': orch({
        command: 'bun run --cwd apps/storybook typecheck',
        dependsOn: ['orch:ui:build'],
        cache: {
          input: [{ auto: true }, ...libSources, ...workshopSources],
        },
      }),
      'orch:typecheck': { command: 'vp run orch:ui:typecheck && vp run orch:storybook:typecheck' },
      'orch:ui:lint': orch({
        command: 'bun run --cwd packages/ui lint',
        cache: { input: [{ auto: true }, ...libSources, ...lintConfig] },
      }),
      'orch:storybook:lint': orch({
        command: 'bun run --cwd apps/storybook lint',
        // Auto tracking showed the workshop's `oxlint` resolving imports into
        // `packages/ui/dist`, which `turbo.json` does not declare for `lint`.
        dependsOn: ['orch:ui:build'],
        cache: {
          input: [{ auto: true }, ...workshopSources, ...lintConfig],
        },
      }),
      'orch:root:lint': orch({
        command: 'oxlint --deny-warnings',
        cache: {
          input: [
            { auto: true },
            '**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}',
            '!**/node_modules/**',
            '!**/dist/**',
            '!**/storybook-static/**',
            ...lintConfig,
          ],
        },
      }),
      'orch:lint': {
        command: 'vp run orch:ui:lint && vp run orch:storybook:lint && vp run orch:root:lint',
      },
      'orch:ui:build': orch({
        command: 'bun run --cwd packages/ui build',
        // The outputs `turbo.json` declares for `build`, so a hit restores `dist`.
        cache: {
          input: [{ auto: true }, ...bunLoaded, ...libSources],
          output: ['packages/ui/dist/**'],
          env: ['NODE_ENV'],
        },
      }),
      'orch:build': { command: 'vp run orch:ui:build' },
      'orch:ui:test': orch({
        command: 'bun run --cwd packages/ui test',
        cache: { input: [{ auto: true }, ...bunLoaded, ...libSources] },
      }),
      // `bun test tests/unit` in the workshop, after the library build (`^build`).
      'orch:storybook:test': orch({
        command: 'bun run --cwd apps/storybook test',
        dependsOn: ['orch:ui:build'],
        cache: {
          // `bun test` reads and rewrites the root `coverage/` (bunfig.toml); it is a product
          // of `orch:test:coverage`, not an input, and tracking it made this task miss on order.
          input: [{ auto: true }, ...bunLoaded, ...libSources, ...workshopSources, '!coverage/**'],
        },
      }),
      'orch:test:coverage': orch({
        // `bun` always creates the root `coverage/` (bunfig `coverageDir`; neither
        // `--coverage-dir` nor a text-only reporter avoids it in bun 1.4.0). `oxlint` lists the
        // workspace root, so that directory appearing or disappearing is one lint miss (a
        // negated glob does not hide a directory's existence). `vp:verify` therefore runs the
        // tests before lint, so a cold and a warm run both lint with `coverage/` present.
        command: 'bun test --conditions=browser packages/ui/tests --coverage',
        cache: {
          input: [{ auto: true }, ...bunLoaded, ...libSources, 'bunfig.toml'],
          output: ['coverage/**'],
        },
      }),
      'orch:test': {
        command: 'vp run orch:ui:test && vp run orch:storybook:test && vp run orch:test:coverage',
      },
      'proof:typecheck': {
        command: 'bun run --cwd packages/ui typecheck',
        cache: { env: toolchain },
      },
      'proof:registry': {
        command: 'bun run --cwd packages/ui registry:validate',
        cache: { input: [{ auto: true }, ...bunLoaded], env: toolchain },
      },
      'proof:cn-check:auto': {
        command: 'bun run --cwd packages/ui cn:check',
      },
      'proof:build': {
        command: 'bun run --cwd packages/ui build',
        // The same outputs `turbo.json` declares for `build`, so a hit restores `dist`.
        cache: {
          input: [{ auto: true }, ...bunLoaded],
          output: ['packages/ui/dist/**'],
          env: ['NODE_ENV', ...toolchain],
        },
      },
      // Small, seed-dependent outputs: lets the restore scenario check that a replayed
      // cache entry yields the right bytes, not merely that its database opens.
      'proof:artifact': {
        command: 'node packages/ui/scripts/vite-task-cache-proof-artifact.mjs',
        cache: { env: toolchain, output: ['packages/ui/.proof-artifact/**'] },
      },
      'proof:unit': {
        command: 'bun run --cwd packages/ui test',
        cache: {
          env: toolchain,
          input: [
            { auto: true },
            ...bunLoaded,
            'packages/ui/src/**',
            'packages/ui/tests/**',
            'packages/ui/public/r/**',
          ],
        },
      },
    },
  },
})
