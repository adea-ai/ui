# Adea UI

The design system shared by **Adea** and **Cortana**.

One themed component library, one token set, one shell layout — so two separate
desktop applications read as one product. Neither application implements its own
components.

```sh
bun install
bun run storybook        # the workshop: every component, every variant, both themes
```

---

## What this is

A custom themed and designed component library **built on top of shadcn/ui**, on
SolidJS and Kobalte. It is not a fork of fifty shadcn primitives, and it is not a
set of hand-rolled controls: shadcn supplies the token vocabulary and the variant
convention, Kobalte and corvu supply the accessible behaviour, and every visual
decision lives in one place.

- **53 components** — 44 primitives, 7 window-layout regions, 3 composites.
- **One token file.** Semantic OKLCH colours, an eight-rung type scale, a six-rung
  control ladder, radius, elevation, motion and a z-index stack. Contrast is
  _measured_ in tests, not reviewed by eye.
- **Dark-first**, with light as an equal — not a lesser inversion.
- **The shell is a component.** Side rail, sidebar, top bar, status bar, panels and
  their geometry are tokens, so the two applications cannot drift apart by pixels.
- **Storybook 10** with per-story accessibility checks, MDX documentation and token
  galleries. It is the review surface; if a component is not in it, it is not done.
- **A shadcn registry**, so a consumer can take one component without adopting the
  package — or install the whole thing from npm.

## Install

```sh
# The package
bun add @adea-ai/ui

# One component, copied into your project
bunx shadcn@latest add https://adea-ai.github.io/ui/r/button.json
```

Then, once, in your app's stylesheet:

```css
@import 'tailwindcss';
@import '@adea-ai/ui/theme.css';
@import '@adea-ai/ui/base.css';
@import '@adea-ai/ui/fonts.css'; /* optional: the self-hosted typefaces */
```

Or, if your app does not already import Tailwind:

```css
@import '@adea-ai/ui/globals.css';
@import '@adea-ai/ui/fonts.css';
```

Toggle the theme by putting `dark` on `<html>`:

```ts
document.documentElement.classList.toggle('dark', isDark)
```

That is the whole setup. See [docs/consumption.md](docs/consumption.md) for the
registry, the versioning contract, and how to re-hue the palette.

## Layout

```
packages/ui/
  src/styles/theme.css        every token. The single source of truth.
  src/styles/base.css         state variants, keyframes, named utilities, base layer.
  src/lib/tokens.ts           the token manifest: names, meanings, which vary by theme.
  src/lib/variants.ts         the shared size ladder and the interactive recipe.
  src/components/ui/          primitives, one folder each: component, stories, index.
  src/components/layout/      app shell, side rail, sidebar, top bar, status bar, panel, page.
  src/components/composites/  list row, settings, stat.
  registry.json               the shadcn registry catalogue.
  public/r/                   one installable payload per item.
apps/storybook/
  .storybook/                 Storybook configuration and the theme toolbar.
  styleguide/foundations/     the token galleries.
```

Stories live **next to their component**, so documentation and implementation
cannot drift apart. The `styleguide` folder holds only what needs more room than a
component folder: the token galleries, and the full-window shell compositions.

## Principles

Five rules explain most of the decisions in this codebase.

**1. A component never restyles another component.** Appearance comes from the
component's own variants and `size` props. This is enforced by `@shadcn/lint` at
the class level, not by review — see [docs/conventions.md](docs/conventions.md).

**2. Every decision is a token.** No literal colour, size, radius or shadow appears
in a component. `packages/ui/src/styles/theme.css` is the only file with a value in
it, and `src/lib/tokens.ts` is complete against it as a test.

**3. The accessible behaviour is the primitive's job.** Focus trapping, arrow keys,
typeahead, `aria-activedescendant`, roving tabindex — Kobalte and corvu already do
these correctly and are maintained. A hand-rolled version is a regression with
better styling.

**4. Describe the "why", not the "what".** Comments in this repository explain
decisions a reader could otherwise reverse: why a dialog has no corner close
button, why the rail's tooltip trigger _is_ the rail row. The rule of thumb is that
a comment restating what the code does is noise; a comment recording a constraint
the code cannot show is the point.

**5. If it is not in Storybook it is not finished.** Every story is checked for
accessibility violations, and the design system's own lint rules run over the
stories too — a demo that restyles a `Button` is caught the same way application
code would be.

## Using this with Adea and Cortana

Both applications consume `@adea-ai/ui` as a workspace or npm dependency and import
components from the package root. Neither keeps a local component library.

```tsx
import {
  AppShell,
  AppShellBody,
  AppShellMain,
  SideRail,
  SideRailContent,
  SideRailHeader,
  SideRailItem,
  SidebarNav,
  SidebarNavContent,
  SidebarNavItem,
  SidebarNavSection,
  TopBar,
  TopBarSearch,
  TopBarSection,
  TopBarTitle,
  StatusBar,
  StatusBarItem,
  StatusBarSpacer,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Button,
} from '@adea-ai/ui'
```

The full-window composition is documented in Storybook under **Layout → App
shell**, and the exact arrangement each application uses is one of its stories.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: branch from `main`, use
Conventional Commits, open a **draft** pull request, and make sure
`bun run fmt && bun run lint && bun run typecheck && bun run test &&
bun run registry:validate` is clean before marking it ready.

## Licence

Apache-2.0. See [LICENSE](LICENSE).

The visual language — the surface ladder, the accent role, the density, the radius
scale, the focus treatment — is substantially translated and modified from
[KiroCrew](https://github.com/kirodotdev/KiroCrew), which is Apache-2.0. The
translation is total: KiroCrew's React components and bespoke CSS custom properties
are re-expressed here as Solid components on Kobalte and corvu, using shadcn's
semantic token vocabulary. No KiroCrew source file is reproduced verbatim. See
[NOTICE](NOTICE) for the full attribution and for the upstream licences of the
libraries this system is built on.
