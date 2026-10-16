import { defineConfig } from 'vite-plus'

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

export default defineConfig({
  run: {
    tasks: {
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
