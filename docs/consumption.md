# Consumption

How Adea, Cortana, or anything else takes this design system.

There are two ways in, and they are not alternatives — the package is the default,
and the registry is how you take a piece without the rest.

---

## 1. The package

```sh
bun add @adea-ai/ui
```

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

Then toggle the theme:

```ts
document.documentElement.classList.toggle('dark', isDark)
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

The package ships both a compiled build and its source, selected by the bundler:

- `import` (default) → `dist/*.js`, a compiled ESM copy. Any bundler, any runner.
- `solid` / `development` → `src/*`. Vite with `vite-plugin-solid` resolves these,
  so an app gets real source with working HMR and no double-compile.

Both are the same code. An app whose bundler does not understand custom conditions
gets the compiled build and loses nothing but source-level HMR.

### Peer dependencies

`solid-js` is a peer. Every other dependency is bundled by _reference_, not inlined
— the library externalises every bare import, so a second copy of Kobalte cannot
appear in a consumer's bundle.

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

**Check the contrast afterwards.** Run the token suite with your overrides in place,
or measure by hand — the floors the system guarantees are 7:1 for body text and
4.5:1 for everything else, and a hue change moves them.

---

## 4. Changing density

`--radius-lg` is the radius knob: move that one value and the other four rungs
follow.

```css
:root {
  --radius-lg: 0.5rem; /* a tighter, more squared system */
}
```

Density is a set of tokens rather than a single one, because a control's height and
its padding are separate decisions:

```css
:root {
  --control-height-md: 2.25rem; /* 36px controls instead of 32px */
  --control-padding-md: 0.875rem;
  --row-height-md: 2.25rem;
}
```

Everything that reads those tokens — Button, Input, Select, Toggle, list rows, table
rows — moves together. That is the point of the ladder.

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

Adea currently carries `packages/ui` with an overlapping set of components. The
adoption path is:

1. Add `@adea-ai/ui` to the application.
2. Replace imports component by component, starting with the shell: `AppShell`,
   `SideRail`, `SidebarNav`, `TopBar`, `StatusBar`, `Panel`. The layout is where the
   visual difference between the applications is largest and where the shared
   geometry does the most work.
3. Move any component-specific styling into a variant here rather than keeping it in
   the application. If a local component needs a look the system does not have, that
   look belongs in the system.
4. Delete the local package once nothing imports it.

The two applications must not both exist as component libraries in the long run —
the point of this repository is that they are one.
