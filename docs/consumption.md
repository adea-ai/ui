# Consumption

How Adea, Cortana, or anything else takes this design system.

There are two ways in, and they are not alternatives — the package is the default,
and the registry is how you take a piece without the rest.

---

## 1. The package

```sh
bun add @adea-ai/ui
```

The palette itself lives in **`@adea-ai/themes`**, which arrives as a dependency of
`@adea-ai/ui`. You do not install it separately, and you do not normally import it —
but it is a published package with its own versions, which is what lets the 27 themes
and the accent presets be corrected without republishing this one.

In the app's stylesheet, after Tailwind:

```css
@import 'tailwindcss';
@import '@adea-ai/ui/theme.css';
@import '@adea-ai/ui/base.css';
@import '@adea-ai/ui/fonts.css'; /* optional: the self-hosted typefaces */
```

If the app does not already import Tailwind, one line does everything:

```css
@import '@adea-ai/ui/globals.css';
@import '@adea-ai/ui/fonts.css';
```

Then wrap the app in `ThemeProvider`. **This is not optional**, and the reason is
worth stating plainly, because the older version of this document told you to
toggle a class instead and that was wrong:

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

`ThemeProvider` is the only thing that applies a theme, an accent or a typeface. It
writes the variant's tokens onto `<html>` as custom properties and persists what the
user picks. A class toggle on its own gets you the two default variants and nothing
else — no palette beyond `adea-light`/`adea-dark`, no accent, no typeface, no
persistence.

### The four axes

Every axis is a value on the same provider, and each is stored in one preference.

| Axis       | Values                                                             | Applied as        |
| ---------- | ------------------------------------------------------------------ | ----------------- |
| Appearance | `light`, `dark`, `system`                                          | a `dark` class    |
| Theme      | any of the 27 catalogue ids                                        | custom properties |
| Accent     | `theme`, or one of six presets                                     | `data-accent`     |
| Typeface   | `space-grotesk`, `system`, `geist`, `geist-mono`, `jetbrains-mono` | `data-font`       |
| Density    | `comfortable`, `compact`                                           | `data-density`    |

```tsx
<ThemeProvider
  storageKey="my-app-appearance"
  initial={{
    appearance: 'system',
    lightThemeId: 'adea-light',
    darkThemeId: 'adea-dark',
    accent: 'theme',
    font: 'space-grotesk',
    density: 'comfortable',
  }}
>
```

Read and change the current selection with `useTheme()`:

```tsx
const { selection, resolvedAppearance, setSelection, themes } = useTheme()
setSelection({ accent: 'amber' })
```

`AppearancePanel` is the whole appearance view if you want one, and `ThemeToggle` is
the light/dark switch on its own.

### Avoiding the flash

A themed app has to know the appearance before its first paint, or it paints once in
the wrong mode. `themeScript` emits the inline script that does it, and the storage
key must match the provider's:

```tsx
<head>
  <script innerHTML={themeScript('my-app-appearance')} />
</head>
```

### The stylesheet exports

| Export        | What it is                                              | When                                             |
| ------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `globals.css` | Tailwind, the base layer, every token.                  | The app does not import Tailwind itself.         |
| `theme.css`   | Tokens only, plus the `@theme inline` mapping.          | **Preferred.** The app already imports Tailwind. |
| `base.css`    | State variants, keyframes, named utilities, base layer. | With `theme.css`.                                |
| `fonts.css`   | The two variable typefaces from `@fontsource-variable`. | Once, if the app wants the system's faces.       |

`theme.css` is the preferred entry for an application that has its own Tailwind
setup: importing `globals.css` as well would import Tailwind twice.

### The two build conditions

The package ships both a compiled browser build and its source, selected by the bundler:

- `import` (default) → `dist/*.js`, a compiled browser ESM copy.
- `solid` / `development` → `src/*`. Vite with `vite-plugin-solid` resolves these,
  so an app gets real source with working HMR and no double-compile.

The required SSR pipeline selects Solid source and compiles it for the server;
compiled browser output is not a native Node SSR entry.

### Peer dependencies

`solid-js` is a required peer. Four engine peers are optional:

| Peer                                      | Needed by  | If you do not install it |
| ----------------------------------------- | ---------- | ------------------------ |
| `solid-js`                                | everything | nothing works            |
| `chart.js` + `solid-chartjs`              | `chart`    | do not import `chart`    |
| `embla-carousel` + `embla-carousel-solid` | `carousel` | do not import `carousel` |

They are peers rather than dependencies on purpose: an application that uses
neither a chart nor a carousel should not install either. Nothing else in the
package root reaches them. Charts and carousels are available exclusively through
`@adea-ai/ui/components/ui/chart` and `@adea-ai/ui/components/ui/carousel`.

This removes their former root exports, including their helper/type exports.
Move those imports to the subpaths and install the corresponding peers. Core root
imports continue to work when optional engines are absent. npm documents that
[optional peers are not automatically installed](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#peerdependenciesmeta);
the actual packed consumer gate verifies this package can honor that contract.

Every other dependency is bundled by _reference_, not inlined — the library
externalises every bare import, so a second copy of Kobalte cannot appear in a
consumer's bundle.

### What one component costs

Measured by `bun run --cwd packages/ui check:tree-shaking`, which builds real
bundles against the built package. Each row uses the documented public entry, and
importing one component does not pull in the rest of the library:

| Public import                                     | Gzipped    | What it brings                        |
| ------------------------------------------------- | ---------- | ------------------------------------- |
| `@adea-ai/ui` → `Button`                          | 19.8 kB    | the floor — Solid, `clsx`, `tw-merge` |
| `@adea-ai/ui` → `Board`                           | 18.5 kB    | nothing                               |
| `@adea-ai/ui` → `DiffBlock`                       | 20.9 kB    | lucide icons                          |
| `@adea-ai/ui` → `CodeBlock`                       | 23.5 kB    | lucide icons                          |
| `@adea-ai/ui` → `MessageRow`                      | 24.7 kB    | nothing                               |
| `@adea-ai/ui` → `CalendarSurface`                 | 27.5 kB    | corvu calendar                        |
| `@adea-ai/ui` → `ModalDialog`                     | 31.9 kB    | Kobalte dialog                        |
| `@adea-ai/ui/components/ui/carousel` → `Carousel` | 32.2 kB    | embla                                 |
| `@adea-ai/ui` → `NavigationMenu`                  | 54.2 kB    | Kobalte navigation menu               |
| `@adea-ai/ui/components/ui/chart` → `LineChart`   | 86.2 kB    | chart.js, the line controller only    |
| _root plus chart and carousel entries_            | _287.6 kB_ | — and `Button` is 6.9% of it          |

The chart splits from itself, which is why chart.js was chosen: `LineChart` is
10.3 kB smaller than importing all seven chart types together, because the
controllers are imported per component while the shared scales and plugins are
registered once. The gate fails if that stops being true.

Two budgets are enforced in CI: a single component must stay under 40 kB, and no
component may exceed 180 kB. A regression here is silent — nothing fails, the
application just gets bigger — which is why it is a gate rather than a report.

---

## 2. The registry

For one component, without the package:

```sh
# Everything
bunx shadcn@latest add https://adea-ai.github.io/ui/r/registry.json

# One item
bunx shadcn@latest add https://adea-ai.github.io/ui/r/button.json

# The tokens, once
bunx shadcn@latest add https://adea-ai.github.io/ui/r/theme.json
```

Or from a local checkout, without a published site:

```sh
bunx shadcn@latest add ./packages/ui/public/r/button.json
```

The `theme` item is separate on purpose: a copied component is useless without the
tokens it references, and pasting fifty copies of the palette into someone's
project is not a distribution strategy.

Each item declares:

- `files` — the source, with a `target` inside `components/` or `styles/`.
- `dependencies` — npm packages the pasted file imports, with versions.
- `registryDependencies` — the other items it imports, resolved from the code.

That last field is the one that matters. `sheet` depends on `dialog` because it
reuses the dialog's overlay so the two scrims cannot diverge; installing `sheet`
alone would produce a file importing a path that does not exist. The dependency is
derived from the import graph, not maintained by hand, and
`bun run registry:validate` fails if it is ever wrong.

### What the registry deliberately does not ship

Stories and MDX are excluded from every payload. A component copied into someone's
project must not bring our documentation in as their source, and
`tests/registry.test.ts` asserts it.

---

## 3. Re-hueing the palette

The tokens are semantic and in OKLCH, so a re-hue is a small number of values rather
than a rewritten palette.

```css
/* The app's own stylesheet, after theme.css. */
:root {
  --primary: oklch(0.5 0.14 250); /* a blue accent instead of the emerald */
  --primary-foreground: oklch(1 0 0);
  --primary-hover: oklch(0.44 0.13 250);
  --ring: oklch(0.5 0.14 250);
}

.dark {
  --primary: oklch(0.77 0.15 250);
  --primary-foreground: oklch(0 0 0);
  --primary-hover: oklch(0.81 0.15 250);
  --ring: oklch(0.7 0.14 250);
}
```

Four values per theme, because the accent is used for one thing. The
`-subtle` tints, the focus glow and the chart series all derive from `--primary`
with `color-mix()`, so they follow automatically.

**Check the contrast afterwards.** Run the token suite with your overrides in place, or
measure by hand. The floors are not one number, and the difference is deliberate:

| Pairing                          | Floor | Held to                        |
| -------------------------------- | ----- | ------------------------------ |
| Body text on the two defaults    | 7:1   | AAA, in `tests/tokens.test.ts` |
| Everything else in the catalogue | 4.5:1 | WCAG AA                        |
| Large or non-essential text      | 3:1   | WCAG 1.4.3                     |

The two default variants are measured at AAA because they are the pairings a user
sees without choosing anything. The other 25 are held to AA, which is the floor
`@adea-ai/themes` admits any palette at — a stricter bar would have excluded most of
the professional palettes the catalogue is built from, several of which sit near
2:1 on their own canvas and only clear AA once normalised. A hue change moves every
one of these numbers, which is why the suite measures them rather than asserting a
palette is fine.

---

## 4. Shape and density

These are two different decisions and they used to share a section, which is how
`--radius-lg` ended up filed under "density".

**Shape** is one knob. Move it and the other four rungs follow:

```css
:root {
  --radius-lg: 0.5rem; /* a tighter, more squared system */
}
```

**Density** is a set of tokens rather than a single one, because a control's height
and its padding are separate decisions:

```css
:root {
  --control-height-md: 2.25rem; /* 36px controls instead of 32px */
  --control-padding-md: 0.875rem;
  --row-height-md: 2.25rem;
}
```

Everything that reads those tokens — Button, Input, Select, Toggle, list rows, table
rows — moves together. That is the point of the ladder.

You do not have to hand-write either. Density is a provider axis, and `compact`
moves the whole ladder one rung tighter:

```tsx
<ThemeProvider initial={{ /* … */ density: 'compact' }} />
```

That sets `data-density`, which shadows the ladder for as long as it is present.
`comfortable` is the _absence_ of the attribute, so an app that never sets it renders
exactly as it did before density was selectable — which is what keeps opting in
additive rather than a migration.

---

## 5. The shell geometry

The window layout is tokens too, so an application cannot pick its own rail width and
end up a few pixels out of step with the one beside it.

| Token                   | Default | What it is                       |
| ----------------------- | ------- | -------------------------------- |
| `--rail-width`          | 58px    | The icon-only side rail.         |
| `--rail-width-expanded` | 236px   | The labelled rail.               |
| `--sidebar-width`       | 256px   | The secondary navigation column. |
| `--topbar-height`       | 48px    | The window title row.            |
| `--statusbar-height`    | 28px    | The bottom readout strip.        |

Override them in the app's stylesheet if a product genuinely needs different
geometry. The Storybook **Layout** section shows each region at its real size.

---

## Versioning

Release Please derives the version from Conventional Commits, and the changelog
records every change by type. What the version means for a consumer:

- **Major (after 1.0)** — a token was removed or renamed, or a component's props
  changed incompatibly.
- **Minor** — a component, variant, size or token was added. `feat:`.
- **Patch** — a fix to an existing component's behaviour or appearance. `fix:`.

While the package is pre-1.0, `bump-minor-pre-major` is set: a breaking change bumps
the minor version. Read the changelog rather than assuming a caret range is safe.

A token is never _renamed_ in a patch. Its meaning can be clarified in the manifest,
and its value can move if a contrast floor demands it — but the name is API.

---

## Migrating from a local component library

Adea carries `packages/ui` (its design system) and `packages/workspace-ui` (its app
layer). Both are superseded by this package, and the mapping below is the work
already done for the app layer — every row is a port, not a plan.

The rule the ports followed: **the library owns the shape, the application owns the
model.** A component that decided its own list, its own icons or its own column
names could only ever serve one product, so those stay in the app and the library
takes the presentation plus the behaviour that is easy to get wrong.

| In adea                                   | Here                                         | What changed                                             |
| ----------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| `conversation-avatar`                     | `ConversationAvatar`                         | kinds `user`/`agent`/`system`, no domain type            |
| `message-row`                             | `MessageRow`                                 | slots for attachments, links, actions; `streaming` added |
| `message-composer`                        | `MessageComposer`                            | controlled value, slots, draft survives a failed send    |
| `conversation-surface`                    | `ConversationSurface`                        | sticks to bottom only when already there                 |
| `thread-panel`                            | `ThreadPanel`                                | `aside` landmark, root message pinned                    |
| `modal-dialog`                            | `ModalDialog`                                | unmounts closed, `inert` background, explicit label      |
| `account-menu`                            | `AccountMenu`                                | **items come from the caller**                           |
| `global-workspace-rail`                   | `SideRail` + `SideRailItem` + `AccountMenu`  | composition; the rail's content is domain                |
| `task-board`                              | `Board`                                      | column ids and `canDrop` are the caller's                |
| `task-detail`, `artifact-detail`          | `DetailPanel` + `DetailPanelSection`/`Field` | `aside` with a label, sticky header                      |
| `capability-card`, `agent-status`         | `StatusChip` + `StatusList`                  | six tones, `unknown` distinct from `neutral`             |
| `agent-roster`, channel and room lists    | `Item` / `ListRow`                           | the row ladder                                           |
| `room-icon`, `plugin-logo`                | `EntityIcon`                                 | monogram fallback, tone owns its own contrast            |
| `version-dialog`                          | `UpdateDialog`                               | an adapter supplies the transport                        |
| `workspace-brand`                         | `EntityIcon` + the type scale                | an eyebrow and a title are not a component               |
| `account-drawer`                          | `Drawer` + `AccountMenu`                     | a composition                                            |
| `settings-section`                        | `SettingsSection`                            | unchanged in intent                                      |
| `workspace-states` (empty/error/skeleton) | `Empty`, `Skeleton`                          | the empty state takes an action slot                     |
| `keyed-rows`                              | `keyedRows` (a util)                         | unchanged — this one is the highest-value port           |
| `notifications`                           | **stays in adea**                            | URL construction and preview redaction are app policy    |
| `on-screen-controls`, `scene-settings`    | **stays in adea**                            | Agent Sim's 3D scene is domain, not design               |
| `virtual-*`                               | **stays in adea**                            | the virtual-room transport is domain                     |

And the new surfaces neither application had: `CodeBlock`, `DiffBlock`,
`NavigationMenu`, `Calendar`/`DatePicker`, `Carousel`, `Chart`, plus `Board`,
`DetailPanel`, `EntityIcon`, `StatusChip` and `UpdateDialog` above.

### The adoption path

1. Add `@adea-ai/ui` to the application, and the four stylesheet imports
   (`theme.css`, `base.css`, and optionally `fonts.css`) after Tailwind.
2. Replace the shell first: `AppShell`, `SideRail`, `SidebarNav`, `TopBar`,
   `StatusBar`, `Panel`. The layout is where the visual difference between the two
   applications is largest and where the shared geometry does the most work.
3. Work down the table above. Where a local component needs a look the system does
   not have, that look belongs in a variant here rather than in the application.
4. Delete the local package once nothing imports it.

**The name collision.** `@adea-ai/ui` is already the name of adea's local
`packages/ui`. Adoption means removing the local workspace entry, so the import
specifier resolves to this package instead — which is also why the migration is
component-by-component rather than a rename: the specifier stays the same and each
import is either satisfied by this package or is not.

The two applications must not both exist as component libraries in the long run —
the point of this repository is that they are one.
