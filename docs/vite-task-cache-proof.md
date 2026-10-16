# Vite Task cache proof

Whether Vite+ (`vp run`, Vite Task) can cache this repository's production tasks as
safely as Turbo does, measured on a scratch local cache. It is a proof, not a
migration: **Turbo and `bun test` are unchanged, no existing gate reads any of this,
and no parity with Turbo is claimed.** Nothing here uses a remote cache, Cloudflare, a
secret or a credential.

## What is in the change

| File                                                     | Role                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json`, `bun.lock`                               | `vite-plus` pinned exactly at `1.3.0` (the `latest` dist-tag on the official npm registry, published 2026-10-16).                                                                                            |
| `vite.config.ts`                                         | Six `vp` tasks: `proof:typecheck`, `proof:registry`, `proof:build`, `proof:unit` wrap existing package scripts; `proof:artifact` is used only by the harness; `proof:cn-check:auto` is the negative control. |
| `packages/ui/scripts/vite-task-cache-proof.ts`           | The harness. Every claim below is an assertion in it; run it with `bun packages/ui/scripts/vite-task-cache-proof.ts [scenario ...]`.                                                                         |
| `packages/ui/scripts/vite-task-cache-proof-artifact.mjs` | Writes a small, seed-dependent output tree for `proof:artifact`, so a restored cache entry can be checked byte for byte.                                                                                     |
| `.github/workflows/vite-task-cache-proof.yml`            | Opt-in, non-required Actions job. Runs on `workflow_dispatch` and when a ready pull request touches the proof's own files.                                                                                   |

The `orch:*` tasks and `vp:*` scripts added to `vite.config.ts` and the root `package.json` are described under
[Orchestration tasks](#orchestration-tasks-orch). They are additive and unrelated to the harness.

`turbo.json` is untouched, so the production graph (`build` with `^build`, the declared
outputs) is exactly what it was. The tasks wrap `packages/ui` scripts directly and do
not reproduce Turbo's package graph.

Run it: `bun install --frozen-lockfile`, then the harness from any checkout.

### What the harness does to your checkout: nothing

The checkout it is started from is read and never mutated. Every scenario runs in a
disposable `git worktree` of that checkout's committed HEAD, created under the OS temp
directory with its own `bun install` and removed at the end. Uncommitted changes are not used
and not touched, and the starting checkout's `node_modules/.vite/task-cache` (a real directory
or a symlink) is never read, moved or removed. Edits to tracked files and the task-cache
symlink happen only inside a disposable root, and:

- every mutating helper refuses a path outside the harness's scratch directory;
- what `useCache` replaces is recorded per root: a symlink keeps its target, a real directory
  is renamed aside, and a name collision throws before anything is removed;
- cleanup undoes only recorded mutations, so a run that never called `useCache` (the static
  `actions` check) removes nothing.
- every `vp` subprocess gets a sanitized environment. Vite Task reads an undocumented
  `VITE_CACHE_PATH` (found in the binary and confirmed: with it set, entries went to that directory and
  the scratch symlink stayed empty) ahead of the `node_modules/.vite/task-cache` symlink, so an inherited
  value would have sent the proof to an external cache. `VITE_CACHE_PATH` and `VP_REMOTE_CACHE*` are removed
  centrally, for tasks, killed runs and the nested harness alike;
- the run is bounded: a single `vp` run is killed after 5 minutes, the whole harness after 60, writers that keep
  failing end their scenario instead of being waited on forever, and `finally` stops and awaits background
  writers (letting a writer finish its round so its exit still counts, killing only one that outlasts a grace
  period) before the worktrees and scratch files are removed. SIGINT and SIGTERM run the same cleanup.

The `safety` scenario proves it against a dirty fixture checkout (tracked edits, a changed
file mode, an untracked file, and a pre-existing task cache as a symlink, and as a real
directory with an older backup beside it): a normal run, an `actions`-only run and a run that
fails right after its first edit (`PROOF_INJECT_FAILURE=1`) all leave every edit, mode,
untracked file, symlink target, cache directory and backup byte for byte as they were.
The same scenario sets `VITE_CACHE_PATH`, `VP_REMOTE_CACHE` and `VP_REMOTE_CACHE_URL` in the harness's
environment and checks that an external sentinel cache stays untouched while the scratch cache receives the
entries (cold run executes, warm run hits). With the sanitizing disabled, that check fails. A restore run whose
writers always fail (`PROOF_INJECT_WRITER_FAILURE=1`) must end non-zero, report the failed exits, and leave no
worktree behind.
Before this change the harness ran `git checkout --` on the checkout it was started from and
removed an existing cache symlink without restoring it; the earlier head `e75aebb` was run
against a throwaway dirty worktree and confirmed to wipe a pre-existing edit and the symlink.

## Results

Run on linux-x64, bun 1.4.2, node 22.22.0 (the sandbox's node; the repository pins 24.18.0, see the
gaps), `vp` 1.3.0, harness head `41244ac`, started from a disposable copy of that commit so the
real checkout was never involved. **175 assertions, 0 failures**, about 12 minutes. The expectations pin
vite-plus's behaviour at this version, so an upgrade that changes any of it fails the harness.
The figures in the evidence below that quote counts come from the earlier 120-assertion run unless
they are restated here.

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
6. **SQLite snapshots under concurrent and interrupted runs: database integrity proven, restored replay
   proven on a small sample.** The database is `journal_mode=wal`.
   - Builds killed with SIGKILL (process group) at 1.5 s, 8 s, 16.5 s and 17.8 s, and 25 rounds of three
     concurrent writers with two of the three killed at staggered points: `integrity_check` was `ok` every time,
     the next run succeeded, `dist` was complete, and the run after that was a hit. A partial build was never
     replayed. The writer that was not killed in each round must exit 0, and the harness fails if it does not.
   - Snapshots of the live cache taken every 15 ms for 20 s while four writers ran back to back
     (253 snapshots per method, at least 50 required, every writer required to exit 0): `VACUUM INTO` from a
     read-only connection, 0 torn and 0 failed; a copy of the whole directory, 0 torn; **a copy of `cache.db`
     alone, 2 torn** (`database disk image is malformed`). Counts vary run to run: earlier runs tore the bare
     copy 2 to 3 times of about 263, and 2 of 266 directory copies could not be taken because a file vanished
     mid-copy. A run with no database, no live writers or too few snapshots now fails instead of passing.
   - **Restored-cache replay (`restore` scenario).** SQLite integrity says nothing about the archives a
     database row points at, so each copy is restored into a fresh cache directory and replayed in a second
     worktree: every entry that had finished before the copy started is run again and what it leaves is compared
     with the bytes a fresh uncached run produces. Three writers in three worktrees (a shared output directory
     would let concurrent runs archive each other's files, which the first draft of this scenario did), 12
     copies per method taken during writes (11 for the directory copy), 3 replays per copy:

     | Copy method                                | Status        | Replayed hits               | Wrong | Unusable |
     | ------------------------------------------ | ------------- | --------------------------- | ----- | -------- |
     | `VACUUM INTO`, then archives               | supported     | 36 of 36                    | 0     | 0        |
     | archives, then `VACUUM INTO`               | reported only | 36 of 36                    | 0     | 0        |
     | `cache.db` file, then archives (no `-wal`) | reported only | 36 of 36                    | 0     | 0        |
     | directory copy during writes               | reported only | 33 of 33 (1 copy not taken) | 0     | 0        |

     Only `VACUUM INTO` then archives is held to a full result: every entry that had finished before the copy must
     replay as a hit with identical bytes (at least 8 copies, zero misses, zero unusable). The other methods are
     only held to never serving wrong bytes; their hits, misses and unusable replays are reported, not required,
     because they are not documented transports for a live cache (a bare database copy was torn in the snapshot
     run). A directory copy is supported after the writers stop, which the next paragraph covers.

     A copy taken after the writers stopped replayed every sampled entry as a hit with identical bytes. After
     eight writers killed at staggered points (four at a time, one per worktree) and four that finished, a copy
     of the stopped cache replayed all four finished entries as hits with identical bytes, and none of the eight
     killed entries was stored (all were misses, none wrong or unusable). **This is a 12-copy sample per
     method, not a rate**: it shows no case of a restored entry serving wrong bytes and none of an unreadable
     database, but the 253-copy snapshot run tore a bare `cache.db` copy twice, so copying the database file
     alone while writers are active stays unsupported. The supported transports are a copy after every
     `vp run` has exited (what the Actions save step does) or `VACUUM INTO` plus the archives.
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

## Orchestration tasks (`orch:*`)

The same `vp` runner now also orchestrates the ordinary checks, as an **additive** layer. Nothing in
`validation.yml`, `verify` or any required lane calls it, `turbo.json` and `bun.lock` are unchanged, and the root
`turbo` scripts (`build`, `lint`, `typecheck`, `test`, `test:unit`) still decide what is required. Bun still runs
every test; there is no Vitest here.

| Script (`bun run …`) | Runs (`vp run …`)                                                         | Mirrors in Turbo                           |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| `vp:build`           | `orch:build` → `orch:ui:build`                                            | `turbo run build --filter=@adea-ai/ui`     |
| `vp:typecheck`       | `orch:typecheck` → `orch:ui:typecheck`, `orch:storybook:typecheck`        | `turbo run typecheck`                      |
| `vp:lint`            | `orch:lint` → `orch:ui:lint`, `orch:storybook:lint`, `orch:root:lint`     | `turbo run lint && oxlint --deny-warnings` |
| `vp:test`            | `orch:test` → `orch:ui:test`, `orch:storybook:test`, `orch:test:coverage` | `turbo run test && bun run test:coverage`  |
| `vp:verify`          | test, lint, typecheck, build in that order                                | the four above (not the rest of `verify`)  |

Design, each point measured:

- **Task names are prefixed.** A task and a root script may not share a name, so the scripts are `vp:*` and the
  tasks `orch:*`. The `proof:*` tasks stay for the harness.
- **Vite+ 1.3.0 has no command-less task.** A task that only lists `dependsOn` fails to load
  ("data did not match any variant of untagged enum UserTaskDefinition"), so the aggregate tasks run their
  children with `vp run … && vp run …`. Each child is still its own cached task and the aggregate is not.
- **Ordering follows reads, not just Turbo's graph.** `orch:storybook:test` depends on `orch:ui:build`, as
  `test` has `dependsOn: ["^build"]`. Auto tracking also showed the workshop's `oxlint` and `tsc` reading
  `packages/ui/dist` (touching one dist file was a miss for the workshop lint only), which `turbo.json` does not
  declare for `lint` or `typecheck`. Those two tasks therefore depend on `orch:ui:build` here.
- **Bun-loaded files are explicit inputs** (`bunLoaded`, plus `libSources`), the finding above.
  `orch:ui:build` declares `packages/ui/dist/**` as output, as `turbo.json` does.
- **The toolchain is detected, not labelled, and held per invocation.** The `proof:*` tasks separate toolchains
  only where `PROOF_TOOLCHAIN` is set (finding 5 above). The `orch:*` tasks do not use it. Each time `vp` loads
  `vite.config.ts`, `packages/ui/scripts/orch-toolchain.mjs` finds the `node` and `bun` on the PATH the tasks
  will get (the workspace `node_modules/.bin`, then the package-manager `bun`, then the shell's) and builds an
  id from the platform, the glibc version, and each binary's `--version` output and sha256 (no path, so the same
  bytes elsewhere keep their entries), for example `linux-x64.glibc2.39.node24.18.0-41a74efb34cb.bun1.4.0-ec3dacd9560f`.
  The id is written into the text of every cached `orch:*` command as `ORCH_TOOLCHAIN=<id> bun run …`, which
  Vite Task fingerprints as an environment value, so a different Node, Bun or platform is a miss
  (`env 'ORCH_TOOLCHAIN' changed`) and each toolchain keeps its own entry. Nothing is shared between
  invocations: the id is part of that invocation's own task graph. (A first version wrote it to one file in
  `node_modules/.cache`; a second `vp` invocation on another toolchain could replace that file between the first
  one's prerequisite and its cache lookup, so the first stored its result under the second's identity. The
  `orch-concurrent` scenario reproduces that on the first version and passes now.)
  Every invocation also runs the uncached `orch:toolchain` task first, with the PATH the tasks really get. It
  recomputes the id and exits non-zero unless it equals the one in the commands, or if either binary is
  missing, prints no version or fails; then no dependent task runs or touches the cache. Things worth knowing:
  - `vp` puts `node_modules/.bin` first on a task's PATH, then a package-manager `bun` it manages from the
    `packageManager` field (`~/.local/share/vite-plus/package_manager/bun/1.4.0`), then the shell's PATH. The
    `bun` that runs the tasks is therefore not necessarily the one a shell prints; the id is built where the
    tasks look. (The first local qualification put a separately downloaded `bun` first in the shell PATH; the
    tasks ran on the managed one.)
  - The hash of each binary is remembered by path, size and modification time in
    `node_modules/.cache/orch-toolchain-memo.json` (written atomically; a hash is not remembered if the file
    changed while it was read), which makes a warm run cost well under a second instead of 5 s. A binary
    replaced with different bytes of the same size and the same modification time would not be noticed. This
    file only caches hashes; it is not an identity and no task reads it.
  - The check runs once per invocation, before the first dependent task. A binary replaced after it and before a
    task starts is not noticed, and a cache **hit** is never re-verified. `vp run --ignore-depends-on` skips the
    check (and the ordering above); the id in the commands is still per invocation, but do not use the flag for
    qualification.
  - Vite Task also fingerprints the resolved program path of a command, so a different `bun` at a different path
    is a miss for that reason too; the id is what separates two toolchains at the same path, as an in-place
    upgrade would.
- **`coverage/` and lint.** `bun test --coverage` always creates the root `coverage/` (`--coverage-dir` and a
  text-only reporter did not avoid it in bun 1.4.0), `oxlint` lists the workspace root, and a directory appearing
  or disappearing changes every lint fingerprint; a negated glob does not hide it. `vp:verify` therefore runs the
  tests before lint so a cold and a warm run lint in the same state. Run on its own after a clean checkout, the
  first `vp:lint` after the first `vp:test` is one extra miss.

### Local qualification

linux-x64, `node` 24.18.0 first on the shell PATH, `vp` 1.3.0, base `ae730b0`, repair head as recorded in the
receipts, a scratch cache (`VITE_CACHE_PATH`, a temporary directory). **`PROOF_TOOLCHAIN` was unset** (the script
prints `PROOF_TOOLCHAIN=unset`), so this is the ordinary workflow. The id in the commands was
`linux-x64.glibc2.39.node24.18.0-41a74efb34cb.bun1.4.0-ec3dacd9560f` (the managed `bun`, see above). Every exit
code was 0. The figures below, and the full harness result further down, were measured on commit `49930a6` with
a clean worktree (the receipts record the commit, its tree and `git status --porcelain`); the commits after it
change only this file.

| Run                          | `orch:test`         | `orch:lint` | `orch:typecheck` | `orch:build` |
| ---------------------------- | ------------------- | ----------- | ---------------- | ------------ |
| Cold (wall time)             | 57.0 s, 0 of 4 hits | 6.3 s\*     | 42.9 s\*         | 0.5 s\*      |
| Warm                         | 0.8 s, 4 of 4 hits  | 0.7 s, 4/4  | 0.6 s, 3/3       | 0.5 s        |
| After `rm -rf dist coverage` | 0.8 s, 4 of 4 hits  | 0.8 s, 4/4  | 0.6 s, 3/3       | 0.5 s        |

\* includes hits on `orch:ui:build`, which an earlier task in the same run had already executed.
`packages/ui/dist` hashed identically cold, warm and restored (`b730e14a81500076`, a hash over the sorted file
hashes). `bun run vp:verify` on the warm cache: 2.9 s, exit 0. (The counts include the uncached `orch:toolchain`
run that precedes each lane.)

Mutations on a clean tree (all reverted): appending a comment to `packages/ui/src/lib/version-notes.ts` missed
every lint and typecheck task and the build, and the tests then failed for the right reason (the committed
registry copy in `public/r` no longer matched, exit 1), not from a stale hit; appending to the bun-loaded
`packages/ui/scripts/check-cn-tables.ts` missed all four test tasks; a `debugger` statement in `src` was a miss and
`orch:ui:lint` exited 1. Reverting the source edit re-executed (A→B→A: one entry per key, see above), so a
branch that alternates with `main` keeps missing.

The `orch-toolchain` harness scenario (`bun packages/ui/scripts/vite-task-cache-proof.ts orch-toolchain`, in a
disposable worktree, `PROOF_TOOLCHAIN` removed from the environment) covers the toolchain: a cold run executes
and a warm run on the same toolchain hits; setting `PROOF_TOOLCHAIN` to any value is still a hit; a `node`
wrapper (same version, other bytes) misses (`env 'ORCH_TOOLCHAIN' changed`) and returning to the original `node`
hits its own entry; a `bun` wrapper at a new path misses, and the same path reporting another version misses
again; a `bun` that exits 1 stops the run with the `orch-toolchain:` error before the cached task runs.
The `orch-concurrent` scenario starts a slow invocation (`orch:storybook:lint`, which builds first) and, six
seconds in, a second one on another `node` (a wrapper first on its PATH only); both finish, and then each finds
its own entry (hit) while the first does not reuse the second's. Run against the first version of this repair
(one shared identity file) the same scenario fails: the first invocation's warm run is a miss
(`'node_modules/.cache/orch-toolchain.json' modified`), because its result had been stored under the other
toolchain's identity. With the id removed from the commands, the same-path `bun` version change would be a
stale hit, which is the defect the repair began from.

The full harness, started on `49930a6` with `PROOF_TOOLCHAIN` unset and `node` 24.18.0 first on the PATH, has 197
assertions (the 175 above plus 22 for `orch-toolchain` and `orch-concurrent`): 197 ok, 0 FAIL, exit 0. The `proof:*`
negative controls are unchanged: in the `tools` scenario a `bun` or `node` with other bytes is still a stale hit
under the `proof:*` tasks, and a changed `PROOF_TOOLCHAIN` is still a miss.

### Not done, and not claimed

- **No hosted proof.** No Actions run, cold, warm or restored, exists for `orch:*`; this was run locally only. The
  trusted-writer pattern in `vite-task-cache-proof.yml` covers the `proof:*` tasks only.
- **The required lanes still run Turbo.** Code Foundry v1.48.1 is already published with Vite+ support, but
  `validation.yml` is still pinned to 1.44.3. What remains before a required lane can use `vp run` is
  consumer synchronization (updating this repository's pin and its workflows to the published version) and
  qualification of the resulting lanes. That is separate from this change; no lane is moved here.
- **Coverage is not Turbo parity.** Turbo's `--filter`, `--affected`, remote cache, `verify:changed` and the
  storybook, Playwright and `check:packed-*` lanes are not mirrored; `build-storybook` is not an `orch` task.
- **Cache keys are per task, not per package.** A change to an unrelated file under `libSources` invalidates the
  whole lane; the explicit globs are deliberately wide because narrower ones missed reads in the past.

## Gaps and what is not claimed

- **Not parity with Turbo.** Turbo's warm path is faster, there is no affected-package selection, and the
  tasks wrap `packages/ui` scripts instead of reproducing the workspace graph (`dependsOn: ["^build"]`).
- **Stale-hit risk is structural.** Any task whose tool reads files outside automatic tracking can replay a
  stale result until its inputs are declared. A new task needs a negative control before it is trusted.
- **Toolchain and platform separation.** For `orch:*` it is detected (see above). For the `proof:*` tasks it is
  still declared: it holds only where `PROOF_TOOLCHAIN` is set, and the `tools` scenario keeps their negative
  controls (a `bun` or `node` with other bytes is a stale hit there). Nothing here ran on macOS or Windows.
- **One entry per key.** No A to B to A reuse for file changes; alternating source states keep missing.
- **No deduplication of concurrent identical runs.**
- **File-copy snapshots of the database can be torn while writers are active.** `VACUUM INTO` was
  never torn in either run; a bare `cache.db` copy was. The kills at 16.5 s and 17.8 s landed before the build finished, so a kill inside the final
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
- **Restore coverage is a sample.** 12 copies per method and one interrupted-writer round; it does not
  bound the rate of a bad restore, and it exercises `proof:artifact`, not a multi-archive build entry.
- **What CI runs.** The workflow runs `proof:registry`, `proof:build` and `proof:typecheck`, each twice, and
  checks that the second run hits. It does **not** run the harness: the 175 assertions, the safety, restore,
  snapshot and divergence scenarios, and the static `actions` check are a local command. Nothing in CI proves
  any claim in this document beyond "a second identical run hits". The workflow also has not run yet.
- **Remote cache.** None configured. Cloudflare is deferred; no infrastructure, access or credential exists.
