# Agent instructions

This is the repository-level operating contract for coding agents working in
`adea-ai/ui`. It complements [CONTRIBUTING.md](CONTRIBUTING.md).

## Mission

Keep this design system **the only place** in the Adea organisation where a UI
component, a size or a shadow is decided. Palette ownership belongs to
`adea-ai/themes`; UI owns the semantic token bridge and component application.
Adea and Cortana consume it;
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

| Invariant                                                                       | Enforced by                                              |
| ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Every token in `theme.css` is documented in `src/lib/tokens.ts`, and vice versa | `packages/ui/tests/tokens.test.ts`                       |
| Every text pairing in the system is measurable and measured                     | `packages/ui/tests/tokens.test.ts` (contrast assertions) |
| A component never restyles another component                                    | `@shadcn/lint` via `.oxlintrc.json`                      |
| No raw palette colour, arbitrary value, inline style or unreadable class        | `@shadcn/lint`                                           |
| Icon-only shared actions use `ActionButton` with a nonblank tooltip             | Opt-in `adea/require-action-button-tooltip`              |
| No React, Radix, Ark, Zag or Base UI import                                     | `no-restricted-imports`                                  |
| Every public export belongs to a registry item                                  | `packages/ui/tests/registry.test.ts`                     |
| The committed registry matches the source                                       | `packages/ui/tests/registry.test.ts`                     |
| No stories or MDX are shipped as consumer source                                | `packages/ui/tests/registry.test.ts`                     |
| Every story is free of accessibility violations                                 | Storybook a11y + `apps/storybook/tests/a11y.spec.ts`     |

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

**One component, one folder.** `packages/ui/src/components/<layer>/<name>/` holds
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
check (list only, no browser), the published-exports gate (a library build, run only when
a `lib/` module, `vite.config.ts` or the `exports` map changed), a turbo-cached typecheck of the changed workspaces,
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

## Repository map and visual review

- `packages/ui/src/components/`: Solid components, public folder exports and stories.
- `packages/ui/src/lib/`, `packages/ui/src/styles/`: shared helpers, variants,
  token semantics and theme bridge. Palette normalization is owned by Themes.
- `packages/ui/scripts/`: registry, packed-consumer and changed-scope checks.
- `apps/storybook/`: Workshop review and Playwright interaction/accessibility lanes.
- [docs/conventions.md](docs/conventions.md), [docs/consumption.md](docs/consumption.md)
  and [docs/design-system.md](docs/design-system.md): authoring, package/registry
  consumption and the design artifact's source map.

Use `.mise.toml` (Node 24.18.0, Bun 1.4.0) and the committed `bun.lock`.
For visual changes, inspect affected stories and Foundations galleries in Storybook;
exercise variants, sizes, awkward states, keyboard and focus behavior. Run the
appropriate `test:components`, `test:a11y` or `test:layout` lane in addition to
`verify:changed`; that command deliberately does not drive a browser. Use
`check:packed-*` scripts when changing the corresponding published consumer surface.
A token meaning change includes `theme.css`, the manifest and affected stories.
For guidance-only edits, check Markdown formatting, links and documented commands.

## Draft WIP workflow

Use one focused topic branch from `main` and one draft PR targeting `main`.
Check existing PRs before starting; reuse the suitable draft branch for the task.
Commit and push WIP to that branch throughout the task and before stopping or
handing off, then verify the remote SHA. Incomplete work and failing checks belong
in the draft PR with exact results and remaining work; they do not block WIP pushes.
Review and applicable passing checks gate readiness and merge. Use Conventional
Commit subjects; this repository uses Code Foundry's direct, squash workflow.

Proceed with ordinary authorized edits, checks, commits and draft pushes. Resolve
routine implementation choices from repository sources. Ask only when a genuinely
missing consequential decision or authority prevents the work.

## Code Foundry guidance

[.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) retains the complete contribution,
review, merge and CI contract; [docs/EXTENSIONS.md](docs/EXTENSIONS.md) explains
managed files and extension points. `.github/code-foundry.yml` is the CI source of
truth. Use the repository's pinned tools and lockfiles; keep coverage thresholds,
formatting conventions, generated-file ownership and change-aware hooks intact.
Add regression coverage for behavior changes and run focused checks while iterating.
A passing commit hook is not full validation. Report exact checks and outcomes,
skips with reasons, remaining work, and the branch/PR at handoff.

User instructions take precedence; directory guidance applies to its own scope.
Read the nearest manifest, README and affected tests, and inspect branch, worktree
and existing changes before editing. Preserve unrelated work.

<!-- code-foundry-managed: safety-boundaries -->

## Safety boundaries

- Do not discard, reset, overwrite, or rewrite user-owned changes.
- Do not expose or commit secrets, credentials, tokens, private keys, local environment files, or personal machine paths.
- Do not modify production resources, repository settings, branch protections, secrets, deployments, or external systems unless explicitly requested.
- Do not change dependency managers or lockfiles unnecessarily.
- Do not bypass hooks, tests, review requirements, or required checks to hide a failure.
- Do not claim completion while required validation, review, deployment, or user decisions remain pending.
- Publishing, committing, or opening a pull request requires explicit task scope or user authorization.

<!-- /code-foundry-managed: safety-boundaries -->
