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
```

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
suite is clean.

A change to what a token means lands in the same commit as the update to
`theme.css`, the manifest, and the affected story.
