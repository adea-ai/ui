# Vite Task cache proof

Whether Vite+ (`vp run`, Vite Task) can cache this repository's production tasks as
safely as Turbo does, measured on a scratch local cache. It is a proof, not a
migration: **Turbo and `bun test` are unchanged, no existing gate reads any of this,
and no parity with Turbo is claimed.** Nothing here uses a remote cache, Cloudflare, a
secret or a credential.

## What is in the change

| File                                           | Role                                                                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `bun.lock`                     | `vite-plus` pinned exactly at `1.3.0` (the `latest` dist-tag on the official npm registry, published 2026-10-16).                                                     |
| `vite.config.ts`                               | Five `vp` tasks that wrap existing package scripts: `proof:typecheck`, `proof:registry`, `proof:build`, `proof:unit`, and the negative control `proof:cn-check:auto`. |
| `packages/ui/scripts/vite-task-cache-proof.ts` | The harness. Every claim below is an assertion in it; run it with `bun packages/ui/scripts/vite-task-cache-proof.ts [scenario ...]`.                                  |
| `.github/workflows/vite-task-cache-proof.yml`  | Opt-in, non-required Actions job. Runs on `workflow_dispatch` and when a ready pull request touches the proof's own files.                                            |

`turbo.json` is untouched, so the production graph (`build` with `^build`, the declared
outputs) is exactly what it was. The tasks wrap `packages/ui` scripts directly and do
not reproduce Turbo's package graph.

Run it: `bun install --frozen-lockfile`, then the harness from a clean working tree.
It moves any existing local task cache aside, points `node_modules/.vite/task-cache`
at a temporary directory, and puts everything back.

## Results

Run on linux-x64, bun 1.4.2, node 22.22.0 (the sandbox's node; the repository pins 24.18.0, see the
gaps), `vp` 1.3.0, harness head `12f6e3e`. **120 assertions, 0 failures.** The expectations pin
vite-plus's behaviour at this version, so an upgrade that changes any of it fails the harness.

### Cold and warm, with outputs restored

| Task              | Cold   | Warm  | Notes                                          |
| ----------------- | ------ | ----- | ---------------------------------------------- |
| `proof:registry`  | 0.6 s  | 0.3 s |                                                |
| `proof:build`     | 20.5 s | 1.2 s | Hit restores `packages/ui/dist` byte for byte. |
| `proof:unit`      | 19.5 s | 0.4 s | 871 `bun test` cases, replayed.                |
| `proof:typecheck` | 26.7 s | 0.4 s |                                                |

For scale, Turbo's local cache on the same machine: `turbo run build --filter=@adea-ai/ui`
cold 19.3 s, warm 0.18 s (cache hit, full replay). Turbo's warm path is faster than the
Vite Task warm build (0.3 to 1.2 s across runs).

### Evidence by requirement

1. **Identical worktree reuse: proven.** A second `git worktree` at the same commit, with its own
   `node_modules`, pointed at the same cache directory: its `proof:build` was a hit against the entry
   written by the first worktree, and its `dist` equalled the first worktree's `dist` (sha256 per file).
   The `proof:registry` entry written from the second was a hit in the first. The stored fingerprint
   lists workspace-relative paths, and the hit shows the worktree location does not matter.
2. **Divergent A to B to A: proven, and it is a limit.** The store is keyed by the command, its arguments and the
   fingerprinted environment values. Under one key there is **one** entry, holding the input fingerprint of the last
   run. After A to B on a script or a source file, going back to A is a miss and re-executes (named reason: the file
   that changed), and so is going back to B again, for a bun script (`proof:registry`) and for the build. In every
   state the rebuilt `dist` equalled the manifest recorded for that state, so there is no cross-contamination, only
   lost hits. A branch that alternates with `main` on the same cache therefore keeps missing. Different environment
   values or arguments are different keys and coexist (item 5).
3. **Concurrent writers: proven safe, not deduplicated.** Four simultaneous `proof:registry` runs on a cold
   cache all executed and exited 0 (none waited for the others), a fifth run hit, and `PRAGMA integrity_check`
   was `ok`. Three different tasks at once, and the same build from two worktrees at once, also all exited 0,
   then hit, with equal `dist`. The cost of concurrency is repeated work, not corruption.
4. **Output restoration: proven.** After `rm -rf dist` a hit restored the whole tree identically. A single
   deleted output file was restored. A single output file edited in place was **overwritten back** to the
   cached bytes by the hit.
5. **Tracked environment and toolchain invalidation: proven for declared variables, not for binaries.**
   - A variable listed in `cache.env` invalidates: `NODE_ENV` production to development was a miss ("env
     `NODE_ENV` changed"). Returning to production was a **hit**: the value is part of the key, so each value
     keeps its own entry, unlike a change to a file (item 2).
   - A variable that is not listed does not: three values of an arbitrary variable, and toggling `CI`, were all
     hits. An extra command-line argument re-executes.
   - **The toolchain is not in the fingerprint.** A copy of `bun` with other bytes first on `PATH` was a hit, and
     so was a `node` binary with other bytes under the automatically tracked `proof:typecheck`. The stored
     fingerprints contain no platform marker. The proof therefore declares one variable, `PROOF_TOOLCHAIN`
     (`bun-<v> node-<v> <os>-<arch>`), in every task's `cache.env`: changing the bun version or the platform
     in it is a miss ("env `PROOF_TOOLCHAIN` changed"). CI sets it from the real versions.
6. **SQLite snapshots under concurrent and interrupted runs: proven for the supported method, with one
   unsafe method found.** The database is `journal_mode=wal`.
   - Builds killed with SIGKILL (process group) at 1.5 s, 8 s, 16.5 s and 17.8 s, and 25 rounds of three
     concurrent writers with two of the three killed at staggered points: `integrity_check` was `ok` every time,
     the next run succeeded, `dist` was complete, and the run after that was a hit. A partial build was never
     replayed.
   - Snapshots of the live cache taken every 15 ms for 20 s while four writers ran back to back
     (263 snapshots per method): `VACUUM INTO` from a read-only connection, 0 torn and 0 failed; a copy of
     the whole directory, 0 torn (earlier runs of the harness saw 2 of 266 fail because a file vanished
     during the copy); **a copy of `cache.db` alone, 2 torn** (`database disk image is malformed`). So a snapshot taken
     while writers are active must use `VACUUM INTO` (with a busy timeout) or wait for the writers to stop.
     The Actions save step runs after every `vp run` has exited.
7. **Actions trusted-writer isolation: configured and asserted statically, not exercised.** The workflow
   restores in every run and saves only when the run is not a pull request and the ref is the default branch,
   so a pull request's code cannot write state a later run restores. The harness's `actions` scenario asserts:
   triggers are only `workflow_dispatch` and a path-filtered `pull_request`; no `pull_request_target`, `push`
   or `schedule`; `contents: read` and no job-level permissions; no secret, token or OIDC use; every action
   pinned to a full commit SHA; checkout without persisted credentials; exactly one restore and one save step,
   the save gated as above; keys carry OS and architecture; the cache path is only the task cache.

### A finding that changes how tasks must be declared

Automatic file tracking sees what `node` reads (`tsc`, `vite`). It does **not** see what the `bun` runtime loads
itself: the script it is started on, its imports, a test file. Measured with the negative control
`proof:cn-check:auto`: after editing `packages/ui/scripts/check-cn-tables.ts`, the task was a **hit**, which is a
stale result. Every task that starts a `bun` script or `bun test` therefore declares explicit inputs
(`{ auto: true }` plus the script, package and test globs). With them, editing a script or a test file is a miss
that names the file.

## Gaps and what is not claimed

- **Not parity with Turbo.** Turbo's warm path is faster, there is no affected-package selection, and the
  tasks wrap `packages/ui` scripts instead of reproducing the workspace graph (`dependsOn: ["^build"]`).
- **Stale-hit risk is structural.** Any task whose tool reads files outside automatic tracking can replay a
  stale result until its inputs are declared. A new task needs a negative control before it is trusted.
- **Toolchain and platform separation is declared, not detected.** It holds only where `PROOF_TOOLCHAIN` (or an
  equivalent) is set. Nothing here ran on macOS or Windows.
- **One entry per key.** No A to B to A reuse for file changes; alternating source states keep missing.
- **No deduplication of concurrent identical runs.**
- **File-copy snapshots of the database can be torn while writers are active.** Only `VACUUM INTO` was
  never torn. The kills at 16.5 s and 17.8 s landed before the build finished, so a kill inside the final
  store step was not observed.
- **Actions isolation is unexercised.** GitHub's side (a pull request run cannot write the default branch's cache
  scope) is relied on, not tested. No run of this workflow has happened yet, and a `workflow_dispatch` workflow
  may not be dispatchable from a branch until the file is on the default branch. The `pull_request` trigger
  runs it once the pull request is ready, restore-only.
- **Node version.** The harness ran under the sandbox's node 22.22.0; the repository pins 24.18.0 and the
  workflow sets it. Results under 24.18.0 are not measured here.
- **Lockfile.** Adding `vite-plus` adds 222 lines to `bun.lock`: its own packages (including all eight platform
  binaries), an aliased core under `vite-plus/vite`, and a changed hoist: `@vitest/{mocker,utils,pretty-format,spy}` and
  `@oxc-project/types` now hoist at newer versions, with the previous versions kept as nested pins for their existing
  consumers (`@vitest/browser`, `@vitest/ui`, `storybook`, `oxc-parser`). The root `vite`, `oxfmt` (0.71.0) and
  `oxlint` (1.86.0) are unchanged; `vp` carries its own `oxfmt` 0.73.0 and `oxlint` 1.88.0, which production does
  not use.
- **Remote cache.** None configured. Cloudflare is deferred; no infrastructure, access or credential exists.
