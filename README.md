# Adea UI

The design system shared by **Adea** and **Cortana**.

One themed component library, one token set, one shell layout — so two separate
desktop applications read as one product. Neither application implements its own
components.

```sh
bun install
bun run build            # the library and declarations
bun run storybook:build  # the full workshop bundle
bun run storybook        # the workshop: every component, every variant, both themes
```

`build` produces the publishable library. CI builds the workshop once in its
dedicated gate and shares that artifact across the ten browser shards.
`bun run verify` includes both builds and the package checks. Workshop prop
documentation is extracted from local components; dependency TSX is excluded
from extraction while its imported types remain available.

Draft pull requests allocate no Registry or Workshop runners. Mark a prepared
pull request ready to run the complete gates; later ready-PR updates rerun them.
Returning to draft cancels the active gate run. PR and `main` push gates follow
the changed paths: documentation outside the published package skips the heavy
lanes, distribution metadata selects Registry, and browser harness changes
select their affected lanes. Component, token, dependency, workflow and unknown
paths retain full coverage. PRs use the immutable merge-base diff; pushes use
the immutable before/after tree diff, including every commit in a batched push.
Deleted and renamed source paths count. Missing, zero or unavailable refs retain
all gates. The required Workshop aggregate rejects failed or cancelled lanes;
it accepts a skip only when change classification explicitly excluded that lane.

---

## What this is

A custom themed and designed component library **built on top of shadcn/ui**, on
SolidJS and Kobalte. It is not a fork of fifty shadcn primitives, and it is not a
set of hand-rolled controls: shadcn supplies the token vocabulary and the variant
convention, Kobalte and corvu supply the accessible behaviour, and every visual
decision lives in one place.

- **74 registry items** — 59 primitives, 7 window-layout regions, 6 composites, and
  the conversation module — plus the app-layer shapes both applications share:
  board, detail panel, status, entity icon, code, diff, update.
- **One token file.** Semantic OKLCH colours, an eight-rung type scale, a six-rung
  control ladder, radius, elevation, motion and a z-index stack. Contrast is
  _measured_ in tests, not reviewed by eye.
- **Four user-facing axes** — appearance, theme, accent and typeface — plus density,
  each a value on `ThemeProvider` and a set of tokens. Twenty-seven themes ship in
  the catalogue, every one validated against WCAG AA floors; the two defaults are
  held to AAA.
- **Dark-first**, with light as an equal — not a lesser inversion.
- **The shell is a component.** Side rail, sidebar, top bar, status bar, panels and
  their geometry are tokens, so the two applications cannot drift apart by pixels.
- **Tree-shaking is measured, not claimed.** Importing one component costs 18–32 kB
  gzipped against 275 kB for the library, and the gate fails if that stops being
  true. The chart splits from itself: one chart type is 10 kB cheaper than seven.
- **Storybook 10** with per-story accessibility checks, MDX documentation and token
  galleries. It is the review surface; if a component is not in it, it is not done.
- **A shadcn registry** of 74 items, so a consumer can take one component without
  adopting the package — or install the whole thing from npm.

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

Then wrap the app in the provider:

```tsx
import { ThemeProvider } from '@adea-ai/ui'

export function App() {
  return (
    <ThemeProvider>
      <YourApp />
    </ThemeProvider>
  )
}
```

`ThemeProvider` is what applies a theme, an accent and a typeface, and what persists
the user's choice. Toggling `dark` on `<html>` by hand still works, and gets you the
two default variants — but no palette beyond them, no accent, no typeface.

If the app is server-rendered, inline [`themeScript`](docs/consumption.md#1-the-package)
in `<head>` so the first paint is already in the right appearance.

See [docs/consumption.md](docs/consumption.md) for the registry, the four axes, the
versioning contract, and how to re-hue the palette.

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
in a component. `packages/ui/src/styles/theme.css` is the only stylesheet with a
palette value in it — and even that file is _generated_ from `@adea-ai/themes`, so
the authoritative copy of the colours lives in that package, not here.
`src/lib/tokens.ts` is complete against the generated file as a test.

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

Both applications consume `@adea-ai/ui` and import components from the package
root. Neither keeps a local component library. The component-by-component mapping
from adea's current packages is in [docs/consumption.md](docs/consumption.md).

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

The rule the shared components follow: **the library owns the shape, the
application owns the model.** `Board` takes the caller's column ids and a `canDrop`
predicate rather than knowing what a task is; `AccountMenu` takes the caller's item
list; `EntityIcon` takes a name and an optional glyph. A component that decided its
own list, its own icons or its own column names could only serve one product.

## Where to read more

| Document                                           | What it covers                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| [docs/design-language.md](docs/design-language.md) | The visual decisions: palette, type, the control ladder, the rail   |
| [docs/conventions.md](docs/conventions.md)         | How components are written here — variants, tokens, comments        |
| [docs/consumption.md](docs/consumption.md)         | Installing, the registry, re-hueing, density, and the migration map |

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

### Binary renderer continuation (UI #22)

`SplitLayout` renders the accepted binary model with stable opaque leaf owners.
Pass an accessor-aware `renderLeaf`, labelled panes, a controlled resize callback
and optional close callback returning the surviving focus ID. Content remains
mounted across split/resize/move; the host retains runtime/session/editor identity,
authorization and persisted layout scope. Close destroys only the removed owner.
Separators use Corvu pointer/keyboard behavior with physical ARIA orientation,
10–90 percent limits and references to the visible regions. Focus restoration is
instance scoped, cancels on disposal and respects newer external focus.

Three stories cover two panes, nested directions and the eight-pane limit. Run
`bun run test:layout` for isolated headless Chromium/WebKit interaction, light/dark
automated accessibility, CSP geometry and native Node SSR evidence. This is a
renderer foundation. Optional `onMove` enables pane-title dragging with typed
closest-edge feedback. Only a live drag from this instance can invoke the host;
foreign/plaintext/stale drops are rejected, and disposal/cancellation clears feedback.
`renderPaneActions` supplies stable accessor-aware host controls. The stories show
keyboard-accessible movement through those controls, plus toolbar split and undo.
Application shortcuts and persisted transitions remain host owned. Manual assistive
technology acceptance and production Adea/Cortana adoption remain pending. Actual
packed-renderer measurements belong to the dependency integration checkpoint;
source-only changes do not refresh that evidence. The existing packed-model probe remains a pure subpath
check and does not certify the renderer or library root.

### Optional engines and breaking root-export migration

Core controls may be imported from `@adea-ai/ui` without chart/carousel peers.
Charts, chart helpers/types, carousels and carousel helpers/types are public only
through `@adea-ai/ui/components/ui/chart` and
`@adea-ai/ui/components/ui/carousel`. Install their corresponding optional peers
when using those entries. Migrate existing root imports to those subpaths; this
intentional breaking change is declared in the commit and release notes.

### Packed pane release gate

Run `bun run check:packed-layout-renderer` after the library build. It installs
the actual tarball with lifecycle scripts disabled and optional chart/carousel
engines absent, then runs the same 36 interaction/SSR cases per compiled/Solid
browser condition in headless Chromium/WebKit. Required server rendering compiles
installed Solid source and executes the result in native Node; browser-compiled
output is not treated as server code. `bun run check:packed-layout` independently
checks the explicit pure-model subpath and full packed attribution.

CSS discovery is explicit (`source(none)`): the host fixture and renderer sources,
plus the close button's complete classes returned by the installed public
`buttonVariants({ variant: 'ghost', size: 'icon-xs' })`. This includes the base,
tactile, focus, disabled, ghost and square-icon styles. The fixture uses exactly
that shared Button; host header actions are native buttons. Unused Button variants
and unrelated automatically discovered CSS are excluded. Positive browser checks
require the close button's actual token-sized square and keyboard focus ring.

The current compiled measurement is 31,797 gzip JS bytes and 33,632 raw CSS bytes,
within the unchanged 32 KiB/34 KiB caps. Gates require one Solid runtime/chunk,
unmixed browser exports, external Solid/Corvu imports, full Apache LICENSE and
donor MIT NOTICE, and no chart/carousel, terminal/editor/highlighter, conversation,
theme-engine or font assets. Earlier partial CSS measurements are historical,
not complete-control acceptance evidence. The full current run remains blocked
by the separately queued UI #20 square-control token prerequisite; it has not
passed all 72 cases or been released.

These checks are enforced by local verification, PR and publish workflows.
Install headless Chromium/WebKit with `bunx playwright install chromium webkit`
before local packed/browser verification. Actual Adea/Cortana production mounts,
full shell/persistence, hydration, native editor/terminal and manual AT remain
separate acceptance gates.
