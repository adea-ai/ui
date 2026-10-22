# Workspace task orchestration

The root build, lint, typecheck, test and test:unit scripts run the named `orch:*`
tasks in `vite.config.ts` using Vite+ 1.3.0. Bun 1.4.4 runs the package scripts,
checks TypeScript and executes tests. Library JavaScript and declaration builds
keep their existing Vite and TypeScript emit commands.

The graph preserves the former ordering: package checks are independent, workshop
tests wait for the UI build, and coverage waits for both package test suites.
`test:unit` runs those two suites without the separate coverage lane. Development
starts the workshop directly after generating the class-name tables.

`verify:changed` selects named typecheck tasks. A library edit checks its workshop
consumer too; a workshop-only edit checks the workshop. An unknown workspace fails
explicitly instead of silently selecting no task.

Every cached orchestration task declares Bun-loaded inputs and carries the actual
Node/Bun/platform identity in its command. An uncached prerequisite verifies that
identity. Builds restore `packages/ui/dist/**`; coverage restores `coverage/**`.
The proof tasks remain explicit negative controls, outside normal scripts.

## Qualification and limits

At main `d1f38d1fef38eb32dfa7e4c7c0261d157ca54b76`, on macOS arm64,
Node 24.18.0 and Bun 1.4.3, one matched baseline run of the existing Turbo and
Vite+ build commands produced identical hashes for all 1,446 library output
files. Both test paths passed, including 872 library coverage tests, and both
lint paths passed. Single samples were 15.311/8.578 seconds for build,
30.305/44.844 seconds for test and 3.730/3.672 seconds for lint (Turbo/Vite+).
These sequential samples share generated outputs and run alongside other checks;
they establish successful execution and output equality, not a speedup.

The earlier [cache proof](vite-task-cache-proof.md) describes structural limits:
one entry per source state, broad explicit input globs, no concurrent work
deduplication, and no live database-file copying. A new task needs a mutation
check before its cached result is trusted. `PROOF_TOOLCHAIN` protects proof tasks
only; the production `orch:*` graph detects its own toolchain.

A current-head macOS cross-worktree proof initially missed because the writer
recorded `packages/ui/node_modules` with a generated `.vite-temp` entry. Task
inputs now exclude only those directory listings and ephemeral config paths;
dependency files, source globs, the lockfile and toolchain identity remain inputs.
The failed baseline still produced identical output bytes and must not be counted
as a successful cache-reuse proof.

Hosted `proof:*` success proves immediate replay only. It does not prove a
fresh-runner restore of the production graph. Hosted warm replay, restored output
hashes and the full current-head validation remain separate readiness gates.
