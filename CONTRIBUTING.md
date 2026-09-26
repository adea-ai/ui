# Contributing

Thanks for helping improve the Adea design system. This project is the shared UI
layer for two desktop applications, so a change here reaches every screen of both.

## Ways to contribute

Small, focused pull requests are welcome for bug fixes, accessibility
improvements, documentation and narrowly scoped features. For a new component or a
change to the token set, open an issue first — those affect both consumers, and
worth agreeing on the shape before writing it.

## Getting set up

Requirements: **Bun 1.4** and **Node 24.18**, both pinned in `.mise.toml`.

```sh
git clone https://github.com/adea-ai/ui.git
cd ui
bun install
bunx playwright install chromium webkit
bun run storybook        # http://127.0.0.1:6006
```

Storybook is the working surface. Every component has a story next to it, and the
foundations galleries under **Foundations** are where a token change is judged.

## The loop

```sh
bun run fmt              # format with oxfmt
bun run lint             # oxlint with @shadcn/lint — zero warnings
bun run typecheck        # both packages, including stories and tests
bun run test             # unit, token and registry tests
bun run build            # the library build
bun run registry:build   # regenerate the registry after adding or moving a component
bun run registry:validate
bun run test:storybook   # accessibility and interaction checks against the built workshop
```

Run the narrowest of these while iterating, then all of them before marking a pull
request ready. A skipped check is not a passing check.

## What a component needs

A new component is one folder, `packages/ui/src/components/<layer>/<name>/`,
containing:

| File                 | What it is                                                                  |
| -------------------- | --------------------------------------------------------------------------- |
| `<name>.tsx`         | The implementation. Appearance via `cva`; behaviour from Kobalte or corvu.  |
| `<name>.stories.tsx` | The specification. Every variant, every size, and the awkward states.       |
| `<name>.mdx`         | Optional. The long-form reasoning, when the story comments are not enough.  |
| `index.ts`           | The public surface. Header comment describes the component in one sentence. |

Then:

1. Give it a public component subpath for all supported export conditions. Export
   core controls from `packages/ui/src/index.ts`; optional-peer components stay
   on their subpaths so core imports do not require their engines. Registry and
   packed-consumer tests enforce reachability.
2. Run `bun run registry:build`. The registry derives each item's files, its npm
   dependencies and its cross-component dependencies from the source — nothing is
   hand-maintained, and the committed catalogue is checked against the source.
3. Look at it in both themes and in the docs page. The toolbar toggles the real
   `.dark` class, which is what both applications use.

## Authoring rules

The rules the linter enforces — and the reasoning behind them — are written out in
[docs/conventions.md](docs/conventions.md). The short version:

- Compose design-system components with their own `variant` and `size` props. Never
  pass appearance classes to one.
- Colour, size, radius, shadow and elevation come from a token. Declare the token
  in `theme.css` and in `src/lib/tokens.ts` before using it.
- Use `@kobalte/core` and `@corvu/*` for behaviour. React libraries will not run
  here, and `no-restricted-imports` blocks them.
- Use `cn('base', { 'state': condition })` for conditional classes. A template
  literal is invisible to the linter.
- Every icon-only control needs an accessible name.

## Changing a token

A token's _value_ is one line. Its _meaning_ is the manifest entry, the galleries
and the contrast tests. All of them move together:

1. Edit `packages/ui/src/styles/theme.css`.
2. Update the entry in `packages/ui/src/lib/tokens.ts` if the meaning changed.
3. Run `bun run test`. The token suite asserts that the file and the manifest agree,
   and measures 30 text pairings against their real surfaces — a change that drops
   one below its floor fails.
4. Look at **Foundations** in Storybook, in both themes.

Where a light-theme and dark-theme value both exist, they are solved rather than
chosen: the comments in `theme.css` record which surface fixed each number.

## Pull requests

- Branch from `main` using `feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*` or
  `test/*`.
- Use a Conventional Commit subject. Release Please derives the version and the
  changelog from these, so `feat:` and `fix:` are load-bearing.
- Open the pull request as a **draft**. Run the local suite, finish review
  preparation, then mark it ready — validation runners are allocated on the ready
  transition.
- Keep it focused. A pull request that adds a component and reorganises the token
  file is two pull requests.
- Conversation resolution is required before merge, and `main` requires a linear
  history. Topic branches are squash-merged.

## Reporting a problem

For an accessibility defect, say which assistive technology and which browser or
engine you used — the two applications ship on different engines, and a defect in
one is often not a defect in the other. For a visual defect, a screenshot in both
themes is worth more than a description.

## Licence

By contributing you agree that your work is licensed under the Apache License 2.0,
as described in [LICENSE](LICENSE). If your contribution is derived from another
project, say so in the pull request and in [NOTICE](NOTICE) — this repository
carries an attribution for the design language it was drawn from and expects the
same standard for anything added.
