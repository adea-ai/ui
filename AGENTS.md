# Agent instructions

This is the repository-level operating contract for coding agents working in
`adea-ai/ui`. It complements [CONTRIBUTING.md](CONTRIBUTING.md).

## Mission

Keep this design system **the only place** in the Adea organisation where a UI
component, a colour, a size or a shadow is decided. Adea and Cortana consume it;
neither re-implements any part of it.

That goal has a practical consequence for every change: if a task can be solved by
adding a variant, a size or a token, it must not be solved by editing a consumer —
and if a consumer already has a local copy of something in here, removing that copy
is the work.

## Read before acting

1. This file and `CONTRIBUTING.md`.
2. `packages/ui/src/styles/theme.css` — the token set. Most questions about what a
   colour or a size should be are already answered there.
3. `packages/ui/src/lib/tokens.ts` — what each token means, and which vary by theme.
4. `docs/conventions.md` — the component-authoring rules the linter enforces.
5. The component you are about to touch, including its `.stories.tsx`. The story is
   the specification.

## The invariants

These are not style preferences. Each is enforced by a test, a lint rule or the
build, and breaking one is a failing check rather than a review comment.

| Invariant                                                                       | Enforced by                                          |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Every token in `theme.css` is documented in `src/lib/tokens.ts`, and vice versa | `tests/tokens.test.ts`                               |
| Every text pairing in the system is measurable and measured                     | `tests/tokens.test.ts` (30 contrast assertions)      |
| A component never restyles another component                                    | `@shadcn/lint` via `.oxlintrc.json`                  |
| No raw palette colour, arbitrary value, inline style or unreadable class        | `@shadcn/lint`                                       |
| Icon-only shared actions use `ActionButton` with a nonblank tooltip             | Opt-in `adea/require-action-button-tooltip`          |
| No React, Radix, Ark, Zag or Base UI import                                     | `no-restricted-imports`                              |
| Every public export belongs to a registry item                                  | `tests/registry.test.ts`                             |
| The committed registry matches the source                                       | `tests/registry.test.ts`                             |
| No stories or MDX are shipped as consumer source                                | `tests/registry.test.ts`                             |
| Every story is free of accessibility violations                                 | Storybook a11y + `apps/storybook/tests/a11y.spec.ts` |

## Working rules

**Add a token before adding a value.** A component that needs a size the system does
not have is usually asking for a rung on the existing ladder. If it genuinely needs
a new one, it goes in `theme.css`, in the manifest, and in the galleries in the same
commit.

**Use the primitive's behaviour.** Focus management, keyboard navigation and ARIA
wiring come from Kobalte or corvu. Where a primitive lacks coverage, say so in the
component's doc comment and describe what was implemented instead and why — that is
the one case where a hand-rolled control is correct.

For consumers that enable `adea/require-action-button-tooltip`, an icon-sized or
statically proven icon-only shared `Button` must use `ActionButton` and a nonblank
`tooltip`, while keeping its accessible name. The rule recognizes imported
`lucide-solid` icons, raw SVG, fragments and icon-only spans; visible text remains
a labelled button. Dynamic children, custom component wrappers, spans with
content-override props and prop spreads that may supply children are deliberately
left for review because lint cannot know what they render.

**Write stories that would catch a regression.** A story that only proves a
component renders is not a specification. Prefer the awkward states: an
indeterminate checkbox, an invalid field, a rail collapsed, a menu with a submenu,
an empty table.

**Comment the decision, not the code.** Comments here explain constraints a reader
could not derive: why the popover's trigger is the row itself, why a dialog has no
corner close button, why the dark theme's accent carries a black label. A comment
that restates the next line is noise and will be asked for in review.

**One component, one folder.** `src/components/<layer>/<name>/` holds
`<name>.tsx`, `<name>.stories.tsx`, `<name>.mdx` (optional) and `index.ts`. The
index exports the public surface; anything not in it is private to the folder.

## Commands

```sh
bun run storybook            # the review surface — required for any visual change
bun run fmt                  # oxfmt, write
bun run format:check         # oxfmt, check
bun run lint                 # oxlint with @shadcn/lint, zero warnings
bun run typecheck            # both packages, including stories and tests
bun run build                # the library build, then declarations
bun run test                 # unit + registry + token tests
bun run registry:build       # regenerate registry.json and public/r
bun run registry:validate    # assert the registry is valid and current
bun run test:storybook       # the accessibility and interaction lane
bun run verify:changed       # only the checks your branch's changes reach (see below)
```

`bun run verify:changed` diffs the working tree and commits against the merge-base
with `origin/main` (`--base=<ref>` to change it; `--plan` to print without running)
and runs only what that diff reaches: the registry rebuild plus the same
`registry.json`/`public/r` drift check CI fails on, the component shard collection
check (list only, no browser), a turbo-cached typecheck of the changed workspaces,
the unit tests that import a changed module (a whole suite only for widely read
files such as `lib/utils.ts`, `lib/tokens.ts` and `theme.css`), and format and lint
on the changed files. It never drives a browser or builds Storybook, and it prints
what it ran and skipped.

`bun run lint` is zero-warning. A `--deny-warnings` run is part of the gate, so a
warning is a failure.

## What not to do

- Do not add a second styling vocabulary. Tailwind's spacing scale plus the control
  and row tokens is the whole system.
- Do not add a dependency for something a primitive already does. `cmdk-solid`,
  Kobalte and corvu cover the interactive cases; check them before reaching for
  another library.
- Do not widen the lint exceptions in `.oxlintrc.json`. The component directory and
  the token galleries are exempt from rules that cannot apply there, and each
  exception carries a reason. A new exception needs a reason too.
- Do not commit generated output (`dist/`, `storybook-static/`, `coverage/`).
  `public/r/` and `registry.json` are deliberate exceptions: they are the
  distribution contract and are committed on purpose.
- Do not commit secrets, credentials or machine-specific paths.

## Pull requests

Branch from `main` with `feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*` or
`test/*`. Use Conventional Commit subjects — Release Please derives versions from
them. Open the pull request as a **draft** and mark it ready only once the local
suite is clean. Run `bun run verify:changed` before marking a pull request ready —
it runs the registry-drift and component-shard gates that otherwise only fail in
CI, and commit any registry files it reports.

A change to what a token means lands in the same commit as the update to
`theme.css`, the manifest, and the affected story.

<!-- code-foundry-managed: config-aware-policy -->

These instructions are the repository-level operating contract for coding agents, including Hermes, OpenCode, and other automation.

They complement `CONTRIBUTING.md`. More specific instructions in nested `AGENTS.md` files and project documentation take precedence for their directory.

<!-- /code-foundry-managed: config-aware-policy -->

<!-- code-foundry-managed: mission -->

## Mission

- Keep formatting, linting, type checking, builds, tests, and coverage reproducible locally and in CI.
- Prefer the repository's configured toolchain; `toolchain: auto` uses native
  tools unless an existing `.mise.toml` is present.
- Do not commit secrets, generated credentials, local environment files, or machine-specific paths.
- Add tests for behavior changes and keep coverage thresholds explicit in the project configuration.
- Make the smallest complete, well-tested change that solves the requested problem without disturbing unrelated work.

This repository may contain TypeScript, Rust, Python, or any combination of them. Detect the active stack from the files present; do not assume every check applies.

<!-- /code-foundry-managed: mission -->

<!-- code-foundry-managed: contributing-back -->

## Contributing back

Consumers are encouraged to help improve this open-source project. Open a small,
focused pull request for bug fixes, performance improvements, documentation, or
other narrowly scoped changes. For larger feature requests or architectural
changes, create an issue first so the proposal can be discussed and scoped.
Contributions should help make the tool as performant, reliable, and helpful as
possible for everyone.

<!-- /code-foundry-managed: contributing-back -->

<!-- code-foundry-managed: read-before-acting -->

## Read before acting

Before editing:

1. Read this file and `.github/CONTRIBUTING.md`.
2. Find and read any nested `AGENTS.md` that covers the files you will touch.
3. Read the nearest README, package manifest, build configuration, and relevant tests.
4. Inspect the current branch, worktree, remotes, and recent history:

   ```sh
   git status --short --branch
   git remote -v
   git log -5 --oneline
   ```

5. Identify the repository's package manager, lockfile, runtime versions, test commands, deployment assumptions, and generated files.

If the worktree is dirty, preserve existing changes and avoid overlapping edits until their ownership is clear.

<!-- /code-foundry-managed: read-before-acting -->

<!-- code-foundry-managed: priorities -->

## Priorities

When instructions conflict, use this order:

1. System and user instructions
2. This repository's instructions and explicit task scope
3. Nested directory instructions
4. Existing project conventions
5. General best practices

Ask for clarification when a missing decision would materially change the implementation. Otherwise make the smallest reasonable assumption and document it.

<!-- /code-foundry-managed: priorities -->

<!-- code-foundry-managed: safety-boundaries -->

## Safety boundaries

- Do not discard, reset, overwrite, or rewrite user-owned changes.
- Do not expose or commit secrets, credentials, tokens, private keys, local environment files, or personal machine paths.
- Do not modify production resources, repository settings, branch protections, secrets, deployments, or external systems unless explicitly requested.
- Do not add organization- or product-specific details to this reusable baseline.
- Do not change dependency managers or lockfiles unnecessarily.
- Do not bypass hooks, tests, review requirements, or required checks to hide a failure.
- Do not claim completion while required validation, review, deployment, or user decisions remain pending.
- Publishing, committing, or opening a pull request requires explicit task scope or user authorization.

<!-- /code-foundry-managed: safety-boundaries -->

<!-- code-foundry-managed: standard-workflow -->

## Standard workflow

1. Restate the desired outcome and identify the files or systems in scope.
2. Inspect before editing; preserve unrelated work.
3. Plan the smallest coherent change.
4. Implement with existing project patterns.
5. Run `npx code-foundry init` for a new checkout, or `npx code-foundry doctor` to diagnose setup drift.
6. Run focused checks while iterating.
7. Inspect the final diff for accidental changes, secrets, formatting, and generated files.
8. Run the broadest applicable validation available.
9. Report what changed, exact checks and results, skipped checks with reasons, risks, and remaining work.

For normal feature work, branch from `main` and target pull requests at `main`. Treat `main` as the protected release branch. Follow `.github/CONTRIBUTING.md` for the complete internal and external contribution flow.

<!-- /code-foundry-managed: standard-workflow -->

<!-- code-foundry-managed: git-workflow-and-merging -->

## Git workflow and merging

This repository uses the `direct` workflow: topic branches **squash** directly into `main`, and the Release Please version PR **squashes** into `main` (`release_merge_strategy: squash`). Feature and release PRs land on `main` with squash merges. No integration branch exists; all pull requests target `main`.

Merge only with the repository's canonical method. Never merge with `--admin`, never default or auto-select a merge method, and never use a method the branch ruleset does not allow. When in doubt, prefer the merge button's configured method and verify the ruleset after merging. Check `.github/CONTRIBUTING.md` for the complete flow and merge table.

### Branch and commit policy

Branch rulesets enforce deletions, force-pushes, required status checks, pull
requests, conversation resolution, and linear history where the repository's
plan supports them. Mirror those rules even where the plan cannot enforce
them:

- Branch from the default branch using
  `feat/*`, `fix/*`, `chore/*`, `refactor/*`, `docs/*`, or `test/*` names.
- Never push directly to protected branches; open a pull request.
- Use Conventional Commit subjects (`feat:`, `fix:`, `chore:`, …); Release
  Please depends on them to version releases.
- Keep pull requests focused; merge with the canonical method only after
  required checks pass.

<!-- /code-foundry-managed: git-workflow-and-merging -->

<!-- code-foundry-managed: pull-request-policy -->

## Code Foundry workflow policy (mandatory)

This repository uses the `direct` workflow. Topic pull requests target `main`.

- Open every ordinary pull request as a draft. Use `gh pr create --draft` or
  set `draft: true` in the GitHub API; never create a ready ordinary pull
  request as a shortcut.
- Keep ordinary pull requests in draft while preparing them. The generated
  Draft Guard converts ready ordinary pull requests to draft when they are
  opened or reopened, and runner-heavy validation starts only after an
  explicit `ready_for_review` transition unless `draft_protection: false` is
  configured for generated callers. That opt-out does not disable Draft Guard
  or draft-PR automation. Cloudflare reusable callers use
  `draft-protection: false`.
- Run local validation and finish review preparation before marking an ordinary
  pull request ready. Ready pull requests stay ready when new commits arrive,
  and validation reruns for the current head; draft updates allocate no
  validation runner until the pull request is ready.
- This contract is mandatory for every agent scope. Nested `AGENTS.md` files
  may add stricter rules but must not weaken or replace it.
- Release Please version pull requests are managed by the Code Foundry release
  workflow; do not manually change their draft state unless the workflow asks.

<!-- /code-foundry-managed: pull-request-policy -->

<!-- code-foundry-managed: toolchain-and-dependencies -->

## Toolchain and dependencies

- Follow `toolchain: auto` in `.github/code-foundry.yml`; use native tools by
  default and reuse mise only when the repository already has `.mise.toml`.
- If `toolchain: mise` is selected, run `mise install` before validation.
- Use the package manager indicated by the existing lockfile:
  - `bun.lock` or `bun.lockb` → Bun
  - `pnpm-lock.yaml` → pnpm
  - `yarn.lock` → Yarn
  - `package-lock.json` → npm
- Use the existing Python environment and dependency manifest. Prefer a project-managed virtual environment.
- Use Cargo commands and the committed Cargo lockfile for Rust projects.
- Do not mix package managers or regenerate lockfiles as a side effect.
- Keep dependency additions narrowly scoped and explain security, licensing, and runtime impact.

<!-- /code-foundry-managed: toolchain-and-dependencies -->

<!-- code-foundry-managed: validation -->

## Validation

Use the shared scripts when present. They detect supported tools and skip inapplicable checks:

```sh
node src/runtime.mjs ci format
node src/runtime.mjs ci lint
node src/runtime.mjs ci type_check
node src/runtime.mjs ci build
node src/runtime.mjs ci unit
node src/runtime.mjs ci integration
node src/runtime.mjs ci e2e
node src/runtime.mjs ci smoke
node src/runtime.mjs ci eval
node src/runtime.mjs ci performance
Security and dependency audits run through the GitHub Security workflow.
```

Run focused tests first, then the complete applicable set for release, security, workflow, dependency, and configuration changes.

At minimum:

- TypeScript/JavaScript: Oxfmt formatting, Oxlint linting, type-check, build, and Bun's native test runner for unit/integration tests; use the project's native browser runner for E2E tests. Repositories using a different linter or formatter keep full control through their own `lint`/`format` scripts, which the runtime honors.
- Do not add Vitest. Preserve specialized native runners such as Matchstick for The Graph and Hardhat for smart contracts.
- Rust: default rustfmt, Clippy with warnings treated as errors, check, unit/integration tests, and dependency audit
- Python: Ruff formatting and linting, compile or type checks, pytest, coverage, and dependency audit
- Mixed projects: validate each active ecosystem and its integration boundaries

If a check cannot run, state the exact reason. A skipped check is not a passing check.

The generated `.githooks/pre-commit` gate is change-aware so parallel work on a
shared checkout is not serialized behind repository-wide checks. It blocks
whitespace errors, formats and lints only staged files, runs the project's
type-check command only when typed sources or compiler configuration are
staged, and does not build unless `pre_commit_build: true` is set. Passing the
hook is not full validation: run the broader checks above before opening or
readying a pull request.

<!-- /code-foundry-managed: validation -->

<!-- code-foundry-managed: tests-and-coverage -->

## Tests and coverage

- Add or update tests for behavior changes and regressions.
- Keep unit, performance, integration, E2E, and smoke coverage in the suite where each applies.
- Preserve project-specific coverage thresholds; do not lower them to make CI green.
- Keep test data deterministic and remove secrets from logs and fixtures.
- Use the narrowest test command while iterating, then run the affected package or workspace suite.

<!-- /code-foundry-managed: tests-and-coverage -->

<!-- code-foundry-managed: github-workflows-and-configuration -->

## GitHub workflows and configuration

- Keep workflows concise, independently runnable, and safe to re-run.
- Use `push` for `main` and `pull_request` for `main` unless a workflow has a documented event-specific reason.
- Give workflows clear names and jobs concise names; avoid repeating the workflow name in the job name.
- Use per-workflow concurrency groups keyed by pull request or ref that cancel superseded pull-request runs while allowing independent workflows to run in parallel. Do not cancel in progress for pushes to `main`, release, publication, or deployment runs; let them queue.
- Do not put `always()` on heavy jobs: it keeps a cancelled run alive and holding its concurrency group. Use `!cancelled()` for jobs that must run after upstream failures, and keep `always()` for lightweight aggregate gates only.
- Keep setup language-aware and cache dependency downloads by lockfile; do not cache secrets, `node_modules`, virtual environments, or broad build output without a measured reason.
- Use least-privilege permissions and pin action versions consistently with the template.
- Keep CI, Test, Security, CodeQL, Draft Guard, Draft PR, Release PR, and Release concerns separated.
- Security and CodeQL may skip when repository visibility or GitHub plan support does not permit them. Do not make an unavailable check required.
- Optional Turborepo Remote Caching uses `TURBO_TOKEN` and `TURBO_TEAM`; do not add Vercel deployment behavior just to enable caching.
- Update branch protection when adding or renaming required job checks; verify the actual GitHub status context.

<!-- /code-foundry-managed: github-workflows-and-configuration -->

<!-- code-foundry-managed: documentation-and-generated-files -->

## Documentation and generated files

- Update documentation when behavior, setup, configuration, commands, or operational procedures change.
- Keep `.env.example` limited to variable names and safe placeholders.
- Do not commit build output, caches, coverage output, dependency directories, generated credentials, or temporary files.
- Preserve formatting and line-ending conventions from `.editorconfig` and `.gitattributes`.

<!-- /code-foundry-managed: documentation-and-generated-files -->

<!-- code-foundry-managed: completion-report -->

## Completion report

End every agent task with:

```text
Summary:
Files changed:
Validation:
Skipped checks:
Risks or follow-up:
Branch/PR:
```

Use exact command names and outcomes. Mention external changes separately from local changes, and distinguish completed work from recommendations.

<!-- /code-foundry-managed: completion-report -->
