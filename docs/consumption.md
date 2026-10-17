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
but it is a published package with its own versions, which is what lets the 34 themes
and the accent presets be corrected without republishing this one.

In the app's stylesheet, after Tailwind:

```css
@import 'tailwindcss';
@import '@adea-ai/ui/theme.css';
@import '@adea-ai/ui/base.css';
@import '@adea-ai/ui/fonts.css'; /* optional: the self-hosted typefaces */
/* Tailwind ignores node_modules: register the components you use plus shared helpers. */
@source '../node_modules/@adea-ai/ui/src/components/ui/button';
@source '../node_modules/@adea-ai/ui/src/lib/variants.ts';
```

If the app does not already import Tailwind, one line does everything:

```css
@import '@adea-ai/ui/globals.css';
@import '@adea-ai/ui/fonts.css';
```

Tailwind must discover the packaged class strings. Adjust these `@source` paths
relative to your stylesheet. Include each composition's nested primitives too:
`ModalDialog` needs `ui/modal-dialog`, `ui/dialog`, and `ui/button`; the appearance
editor needs `composites/appearance-editor` and `ui/{button,popover,select,switch,input}`.
The shared `lib/variants.ts` defines control sizes; overlays also need `lib/overlay.ts`
for their fills, placement, and motion.
Registering all of `src/components` is simpler but emits utilities for unused
components; selective discovery keeps CSS ownership and measured budgets explicit.
Importing `globals.css` also requires discovery of the components and helpers.

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

| Axis       | Values                                                                              | Applied as        |
| ---------- | ----------------------------------------------------------------------------------- | ----------------- |
| Appearance | `light`, `dark`, `system`                                                           | a `dark` class    |
| Theme      | any of the 34 catalogue ids                                                         | custom properties |
| Accent     | `theme`, one of six presets, a theme-carried `ansi-*` accent, or a custom `#rrggbb` | `data-accent`     |
| Typeface   | Full catalogue in UI, Content and Code (`fonts`); legacy `font` applies to UI       | `data-*-font`     |
| Density    | `comfortable`, `compact`                                                            | `data-density`    |

New font settings keep the full catalogue available in every role, and Code
uses the exact selected family. `System` uses the platform's monospace face for
Code. Older preferences with only `font` migrate that value into UI; Content
and Code keep their System defaults until the user chooses them separately.

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

### Beyond the four axes

Everything in this section is opt-in. A provider given none of these props, over a
store holding none of these fields, paints and stores exactly what it did before they
existed: `defaultThemeSelection` deliberately carries none of the newer fields, so a
consumer's stored bytes do not change.

| Capability               | Where                                                          | Default                               | What it does                                                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence seam         | `persistence` prop                                             | `localStoragePersistence(storageKey)` | Where the preference is kept. `read()` is synchronous, runs once and must not throw; `write(next)` runs only from `setSelection`, never on mount or from `preview`. `storageKey` is then ignored. |
| Extra themes             | `themes` prop                                                  | none                                  | Variants a host adds to the catalogue (imported themes), as an array or a function read reactively. The catalogue wins an id collision. A `ThemeVariant.tokens` map is written verbatim.          |
| Unknown theme id         | `resolveVariant`                                               | same-appearance default               | A stored id no variant holds paints the default of its appearance and stays in the selection untouched.                                                                                           |
| Preview                  | `preview(draft)` / `previewing()`                              | none                                  | Paints the document from a draft laid over the stored selection without persisting it. `selection()` still answers with what is stored; `preview(undefined)` or `setSelection` ends it.           |
| Token transform          | `transformTokens` prop                                         | none                                  | Rewrites the inline properties of each pass before they are written. `tokensAsHex` is the one shipped.                                                                                            |
| Transition suppression   | `disableTransitionOnChange` prop                               | `false`                               | Switches CSS transitions off for the frames that carry a change. Adds a `<style>` element for two frames per change.                                                                              |
| Accent roles             | `ThemeSelection.accent`                                        | `theme`                               | A preset id, an `ansi-<slot>` theme accent, `theme`, or a custom `#rrggbb`. Writes `--primary`, `--primary-foreground`, `--primary-hover` and `--ring`; never `--primary-subtle`.                 |
| Accent contrast floor    | `accentContrastFloor` prop                                     | absent                                | Absent, presets are painted verbatim and only a custom colour is held to 3:1. A number holds presets to that ratio too, repairing to the nearest passing colour.                                  |
| Per-element accent       | `accentRolesFor(accent, variantId?)`                           | none                                  | The roles an accent paints over a variant, gated by the same floor, for `paintAccentRoles` on one element. `undefined` means "keep the inherited accent".                                         |
| Surface and translucency | `surface` prop; `ThemeSelection.surface`, `reduceTransparency` | off                                   | `opaque`, `frosted` or `translucent`, resolved against the OS Reduce Transparency setting and the host's capability. See below.                                                                   |
| Terminal pin             | `ThemeSelection.terminalThemeId`                               | follows the interface                 | `theme` or absent follows the interface variant; a variant id pins that theme's `--terminal-*` palette over it, so a light interface can carry a dark terminal.                                   |
| Font zoom                | `fontZoom` prop; `zoomFonts(intent)`                           | off                                   | Cmd or Ctrl with `=`, `+`, `-`, `0` step the three text sizes together instead of the browser's page zoom. `zoomFonts('in' \| 'out' \| 'reset')` does it from a menu and persists.                |
| Palette source           | `palette` prop                                                 | `inline`                              | `inline` writes every role onto `<html>` at mount. `stylesheet` leaves a catalogue variant to `theme-variants.css`. See below.                                                                    |
| Editor roles             | `editorRoles` prop                                             | `syntax`                              | The projection behind the `--editor-*` ramp: `syntax` is the catalogue's quiet roles, `floor` holds all sixteen to 4.5:1 on the canvas.                                                           |
| Versioned storage        | `createVersionedPersistence(schema, codec)`                    | none                                  | A persistence over a host's own versioned JSON document, with quarantine of unreadable records. See below.                                                                                        |
| Boot script options      | `themeScript(options)`                                         | string form                           | Paints a versioned document's attributes before first paint. See "Avoiding the flash".                                                                                                            |
| Optional context         | `useOptionalTheme()`                                           | n/a                                   | The context, or `undefined` outside a provider, for a component that works with or without one.                                                                                                   |

Three details are easy to get wrong:

- **Surface.** The axis is written only when the `surface` prop is on or the selection
  already carries a `surface`; otherwise a provider adds no `data-surface`, no media
  query listener and no stored field. The prop takes `true` or
  `{ nativeTranslucency }` (a boolean or a function, for a capability learned after
  mount). Without native translucency a `translucent` preference paints the tokenized
  `frosted` surface. The OS setting or `reduceTransparency` forces `opaque`.
  `effectiveSurface()` and `reduceTransparencyActive()` report the outcome of the
  committed selection; the stored value is a preference, never the outcome.
- **Accent grammar.** A custom colour is stored lower case and raised to the contrast
  floor when it is painted, never when it is stored. A `#rrggbb` accent is reported as
  `data-accent="custom"`, because the hex itself is the worst possible attribute
  content. A theme accent (`ansi-blue`) the current pair does not offer falls back to
  the variant's own primary.
- **Editor roles.** `floor` applies to catalogue variants. A host's own `themes` keep
  their `editor` and `tokens`.

#### Persisting a host's own document

`localStoragePersistence` stores the selection as it is. A host that already has a
versioned document, a legacy key to migrate from or its own field names describes the
document once, as a `ThemeStorageSchema`, and supplies a codec for the fields:

```tsx
import { createVersionedPersistence, type ThemeStorageSchema } from '@adea-ai/ui'

export const appearanceSchema = {
  key: 'my-app.appearance',
  version: 2,
  appearanceField: 'mode',
  legacyAppearanceKey: 'my-app.theme',
  libraryKey: 'my-app.themes',
} satisfies ThemeStorageSchema

const persistence = createVersionedPersistence(appearanceSchema, {
  decode: (record) => ({ appearance: record.mode as 'light' | 'dark' | 'system' /* … */ }),
  fromLegacy: (value) => (value === 'dark' ? { appearance: 'dark' } : undefined),
  defaults: () => ({ accent: 'violet' }),
  encode: (next, previous) => ({ ...previous, version: 2, mode: next.appearance /* … */ }),
})
```

The engine owns storage; the codec owns the product schema:

- A record of the wrong shape or any version other than `schema.version` is
  quarantined byte for byte into `recoveryKey` (default `${key}.recovery`) at read
  time, before anything can overwrite it, and `defaults()` answers.
- `fromLegacy` is called only while the main key is absent, and the legacy key is
  never deleted.
- `defaults()` is optional. It answers for a fresh install, an unreadable record or
  blocked storage, so a host can start from its own accent. Absent, the provider's
  defaults apply.
- `encode(next, previous)` receives the record last read or written, so a codec can
  carry a field the selection does not model. Nothing is written until `setSelection`
  asks, and neither method throws.

Because the same schema object feeds `themeScript`, the boot script and the provider
cannot disagree about a key, a version or a field name.

### Avoiding the flash

A themed app has to know the appearance before its first paint, or it paints once in
the wrong mode. `themeScript` emits the inline script that does it, and the storage
key must match the provider's:

```tsx
<head>
  <script innerHTML={themeScript('my-app-appearance')} />
</head>
```

The string form serves a provider that stores an unversioned `localStorage[key]`
document. It sets the `dark` class, `color-scheme`, `data-accent` and `data-density`,
and its output does not change between releases. It does not apply the variant's
roles: the default theme in `theme.css` covers the first paint and the provider
writes the rest at mount.

A host whose HTML is built rather than rendered (a Vite `index.html`, a desktop shell
whose content security policy allows no inline script) needs the string in Node, at
build time, and writes it to a file the page loads with `<script src>`. The provider
entries cannot be imported there, because they load Solid's client runtime. Import
`themeScript` from `@adea-ai/ui/components/theme/script` instead: the same function,
in a module that holds nothing else.

For a host with a versioned document, pass the same schema the persistence uses plus
what to paint:

```tsx
<script
  innerHTML={themeScript({
    ...appearanceSchema,
    defaultAccent: 'violet',
    surface: true,
    palette: 'stylesheet',
  })}
/>
```

| Option                                                                                  | What it does                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`, `version`, `appearanceField`, `legacyAppearanceKey`, `libraryKey`, `recoveryKey` | The `ThemeStorageSchema`. A document of any other `version` is not read; the legacy key is read only while the main key is absent.                                                                       |
| `defaultAccent`                                                                         | The `data-accent` painted when the document has none, an unrecognised one, or the legacy `theme` spelling. Without it those cases paint none.                                                            |
| `surface`                                                                               | Also resolves `data-surface`, `data-reduce-transparency` and `--surface-alpha`. A `translucent` preference resolves to `frosted` until the provider knows the host. Match the provider's `surface` prop. |
| `palette`                                                                               | Accepted so one options object can serve both halves. It changes nothing in the script (see below).                                                                                                      |
| `libraryVersion`                                                                        | The only `version` of the `libraryKey` document read. Default `1`.                                                                                                                                       |

The options form writes `class="dark"`, `color-scheme`, `data-theme`,
`data-appearance`, `data-accent`, a compact `data-density`, the surface attributes
when asked, the font settings (guarded to `version`) and, for a theme found in the
stored library, that theme's own tokens inline. It reads values into `dataset` and
`style`, which are property assignments, so a stored value can set an attribute and
cannot execute.

A catalogue theme other than the default pair has no inline tokens in the script, so
a page that wants its chosen palette on the first frame also loads the catalogue
stylesheet, after `theme.css` and before the app's own sheets, and mounts the
provider with `palette="stylesheet"`:

```css
@import 'tailwindcss';
@import '@adea-ai/ui/theme.css';
@import '@adea-ai/ui/theme-variants.css';
@import '@adea-ai/ui/base.css';
@import './app.css';
```

`theme-variants.css` carries one `[data-theme]` block for each of the 32 other
catalogue themes, and for the default pair only the `--terminal-*` and `--editor-*`
properties `theme.css` does not declare. With `palette="stylesheet"` the provider
writes inline only what no stylesheet can know: a host's own `themes`, the accent,
the terminal pin, `--surface-alpha` and the fonts. Switching from a host theme back
to a catalogue one removes the properties the host theme wrote.

#### Caveats

- **`palette` and `themeScript`.** The script ignores `palette` and never writes a
  catalogue palette token. A catalogue palette reaches the first frame only through
  `theme.css` (the default pair) or `theme-variants.css`. With `palette="inline"` and
  no sheet, a non-default catalogue theme appears at mount.
- **`editorRoles="floor"` with `palette="stylesheet"`.** The sheet is generated for
  `syntax`, so this pairing writes the sixteen `--editor-*` properties inline, as hex,
  over the sheet. The rest of the palette stays in the sheet.
- **oklch against hex.** The sheet's colours are `oklch()`. `tokensAsHex` and any
  `transformTokens` affect inline writes only, so a host that used to write hex for
  every theme gets `oklch()` from the sheet for the catalogue palette. Check any test
  or native consumer that reads a computed colour as hex.
- **Cascade.** A light theme's `[data-theme]` rule and a light accent's
  `[data-accent]` rule have the same specificity, and the sheet loads later. The light
  accent blocks are therefore repeated at the end of the sheet so a stored accent
  still wins. Dark accents (`.dark[data-accent]`) are more specific and are not
  repeated. Do not reorder the sheet.
- **Accent attribute.** A hex accent paints `data-accent="custom"` in the script and in
  the provider; a theme-derived `ansi-*` accent paints none in the script (the
  provider paints it inline). The legacy accent `theme` makes the script paint
  `defaultAccent`; the provider writes no `data-accent` for `theme`. A host that sets
  `defaultAccent` should have its codec store that accent for a fresh install (see
  `defaults()`), so the two agree.

### Keeping the catalogue out of the start-up chunk

`@adea-ai/ui/components/theme` imports the whole catalogue: all 34 themes, with their
roles and accent tables, are in the module graph of anything that imports it. That is
right for a host that opens its theme picker on the first screen, and wasted for one
that shows the default pair and paints a chosen palette from `theme-variants.css`.
Such a host imports the provider from the lazy subpath instead:

```tsx
import { ThemeProvider, themeScript, useTheme } from '@adea-ai/ui/components/theme/lazy'
```

`ThemeProvider` there takes the same props, provides the same context and writes the
same document as the eager one for everything the default pair covers: the default
light and dark themes, a host's own `themes`, every accent preset and custom colour,
the surface axis, fonts and density. Only the other 32 themes wait. The first time the
selection (or a preview) names one, the provider imports the catalogue in a chunk of
its own, and until it arrives:

- the document keeps what is on it (`themeScript` set it before first paint, or the
  stylesheet paints it under `palette="stylesheet"`) and nothing is written over it;
- `useTheme().variant()` is the default theme of the current appearance, and
  `useTheme().catalogueReady()` is `false`;
- a preview of a theme that has not loaded starts the load and shows when it ends.

When the chunk arrives the provider re-resolves the stored theme and paints it. If the
import fails the provider stays on the default pair, `catalogueReady()` stays `false`
and a later `loadCatalogue()` retries.

Three members of the context exist for this. `catalogueReady()` and `loadCatalogue()`
are optional on `ThemeContextValue` (the eager provider omits both, so a component
written against either provider checks `theme.catalogueReady?.() ?? true`). A picker
calls `loadCatalogue()` when it mounts: until `catalogueReady()` is `true`,
`useTheme().themes` and `allThemes()` list only the default pair. `loadThemeCatalogue()`,
exported from the same subpath, starts the same import without a provider, for a
host that wants to warm it after first paint.

Set it up as the stylesheet section above does, so the first frame never waits on the
chunk:

```tsx
import { ThemeProvider, themeScript } from '@adea-ai/ui/components/theme/lazy'

;<script innerHTML={themeScript(schemaAndDefaults)} />
;<ThemeProvider palette="stylesheet" persistence={persistence}>
  <App />
</ThemeProvider>
```

Under the default `palette="inline"` the provider has to compute a catalogue theme's
roles, so every stored theme but the default pair waits for the import and the
document shows the default meanwhile. Use `stylesheet` with the lazy provider.

`@adea-ai/ui/lib/themes` and `builtinThemes` are unchanged: a plain array of 34
themes. A host that reads `builtinThemes` pays for the catalogue by importing it; the
lazy provider reaches it only through a dynamic import. `check:theme-startup` in this repository builds a minimal
host against both providers and fails if the lazy one pulls the catalogue into its
start-up closure: the lazy host's start-up chunk is 17.5 kB gzipped against 29.3 kB
for the eager one.

#### Imports that keep the catalogue out

A bundler places a module whole, so what a start-up path imports is decided by which
module defines it, not by which one re-exports it. These are defined in modules that do
not import the catalogue, and are safe in a lazy host's start-up:

| Import                                                                              | From                             |
| ----------------------------------------------------------------------------------- | -------------------------------- |
| `variantFromRecord(record)`, the `AdeaTheme` / `AdeaThemeRecord` types              | `@adea-ai/ui/lib/theme-records`  |
| `accents` (the six brand presets), `accentPresets` (`theme` first), `getAccent(id)` | `@adea-ai/ui/lib/accent-presets` |
| `tokensAsHex`, `terminalCssVariables`                                               | `@adea-ai/ui/lib/theme-css`      |
| `isThemeAccentId`                                                                   | `@adea-ai/ui/lib/theme-accents`  |
| `defaultLightThemeId`, `defaultDarkThemeId`, `resolveVariant`                       | `@adea-ai/ui/lib/theme-defaults` |

`@adea-ai/ui/lib/themes` re-exports every one of them, so existing imports keep working
and, with a tree-shaking bundler, still leave the table out when nothing reads it.
Import from the defining module when you want the guarantee not to depend on
the bundler's tree-shaking. `variantFromRecord` turns a record the catalogue does not hold
(an imported theme, one rebuilt from stored data) into a `ThemeVariant` for `ThemeProvider`'s
`themes`; a host used to copy it to keep the table out of start-up, and should import it
instead. It costs about 7 kB raw (2 kB gzipped) at start-up, because it projects a record
onto the shadcn vocabulary. `check:theme-startup` bundles a lazy host that imports
`variantFromRecord` and `accents` from `lib/themes` (beside `tokensAsHex`,
`isThemeAccentId` and `resolveVariant`) and another that imports them from the defining
modules (plus `getAccent`), and fails if the catalogue reaches either start-up chunk.

#### Helpers for a host that holds records

A host that reads or imports theme records, and wants `@adea-ai/ui` as its only theme
dependency, imports these. None is a start-up import: `lib/theme-projection` carries the
two default records, so load it with the importer or the appearance panel, not before
first paint. It imports no catalogue table and nothing from `lib/themes`.

| Import                                                                             | From                               |
| ---------------------------------------------------------------------------------- | ---------------------------------- |
| `defaultThemeRecord(appearance)` — `adea-light` / `adea-dark` as canonical records | `@adea-ai/ui/lib/theme-projection` |
| `themeAccentsForRecords(light, dark)` — the accents a pair of records carries      | `@adea-ai/ui/lib/theme-projection` |
| `shadcnVariables`, `shadcnDestructiveProjection`, `toXtermTheme`                   | `@adea-ai/ui/lib/theme-projection` |
| `editorRolesHex`, `syntaxRolesHex`, `oklchToHex`, `parseOklchColor`                | `@adea-ai/ui/lib/theme-projection` |

The last two rows are the catalogue's own functions, re-exported rather than wrapped, so
a host's projection of an imported theme cannot drift from the catalogue's. `variantFromRecord`
is not that projection: it keeps the error colour as `destructive`, and its editor palette
is the syntax roles rather than the floor-repaired ones, so a host that stores hex values
for imported themes projects with these helpers instead.

### The stylesheet exports

| Export               | What it is                                              | When                                             |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `globals.css`        | Tailwind, the base layer, every token.                  | The app does not import Tailwind itself.         |
| `theme.css`          | Tokens only, plus the `@theme inline` mapping.          | **Preferred.** The app already imports Tailwind. |
| `theme-variants.css` | Every catalogue theme as a `[data-theme]` block.        | After `theme.css`, with `palette="stylesheet"`.  |
| `base.css`           | State variants, keyframes, named utilities, base layer. | With `theme.css`.                                |
| `fonts.css`          | The two variable typefaces from `@fontsource-variable`. | Once, if the app wants the system's faces.       |

`theme.css` is the preferred entry for an application that has its own Tailwind
setup: importing `globals.css` as well would import Tailwind twice.

`base.css` also defines `visually-hidden` (and `visually-hidden-until-*`), the
screen-reader-only utility the components use. It is a supported utility, not an
internal one: an application that imports `base.css` or `globals.css` uses it
directly and does not redeclare it. Tailwind's own `sr-only` is equivalent, and
the components use both; reach for `visually-hidden` when the text should appear
at a breakpoint, since only it has the `-until-*` companion.

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
importing one component does not pull in the rest of the library. The table below is
written by that script (`-- --write`), and the CI gate fails when the committed figures
drift from what it measures, so they describe the current release rather than the day
they were typed:

<!-- tree-shaking:start — generated by `bun run check:tree-shaking --write`; do not edit by hand -->

| Public import                                                   | Gzipped    | What it brings                        |
| --------------------------------------------------------------- | ---------- | ------------------------------------- |
| `@adea-ai/ui` → `Button`                                        | 21.9 kB    | the floor — Solid, `clsx`, `tw-merge` |
| `@adea-ai/ui` → `Board`                                         | 22.3 kB    | nothing                               |
| `@adea-ai/ui/components/composites/list-row` → `ListRowControl` | 21.8 kB    | nothing — the row without its tooltip |
| `@adea-ai/ui` → `DiffBlock`                                     | 22.9 kB    | lucide icons                          |
| `@adea-ai/ui` → `CodeBlock`                                     | 27.3 kB    | lucide icons                          |
| `@adea-ai/ui` → `MessageRow`                                    | 26.8 kB    | nothing                               |
| `@adea-ai/ui` → `CalendarSurface`                               | 29.6 kB    | corvu calendar                        |
| `@adea-ai/ui` → `ModalDialog`                                   | 50.3 kB    | Kobalte dialog, the shared tooltip    |
| `@adea-ai/ui/components/ui/carousel` → `Carousel`               | 34.2 kB    | embla                                 |
| `@adea-ai/ui/components/composites/list-row` → `ListRow`        | 41.8 kB    | Kobalte tooltip                       |
| `@adea-ai/ui` → `NavigationMenu`                                | 56.6 kB    | Kobalte navigation menu               |
| `@adea-ai/ui/components/ui/chart` → `LineChart`                 | 89.2 kB    | chart.js, the line controller only    |
| _root plus chart and carousel entries_                          | _434.2 kB_ | — and `Button` is 5.0% of it          |

The chart splits from itself, which is why chart.js was chosen: `LineChart` is
10.5 kB smaller than importing all seven chart types together (89.2 kB against 99.7 kB), because the
controllers are imported per component while the shared scales and plugins are
registered once. The gate fails if that stops being true.

Three budgets are enforced in CI: importing `Button` must stay under 40.0 kB
and under 25.0% of the whole library, and no sampled component may exceed
180.0 kB.

<!-- tree-shaking:end -->

A size regression is silent — nothing fails, the
application just gets bigger — which is why it is a gate rather than a report.
Re-baselined 2026-10 (accent pass): the shared overlay vocabulary gained the
menu swatch tone ladder and the dialog-family surface split, so every bundle
that reaches `lib/overlay.ts` grew by its share. Measured against the previous
table: ModalDialog 48.9 → 49.6 kB, ListRow 40.5 → 41.2 kB, NavigationMenu
56.0 → 56.5 kB, the root 360.0 → 360.7 kB. `Button` — the floor — did not
move; the ratios held.

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

| Token                   | Default | What it is                            |
| ----------------------- | ------- | ------------------------------------- |
| `--rail-width`          | 56px    | The icon-only side rail.              |
| `--rail-width-expanded` | 236px   | The labelled rail.                    |
| `--sidebar-width`       | 256px   | The secondary navigation column.      |
| `--panel-width`         | 390px   | A side pane, or that pane as a sheet. |
| `--topbar-height`       | 48px    | The window title row.                 |
| `--statusbar-height`    | 28px    | The bottom readout strip.             |

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

| In adea                                   | Here                                         | What changed                                                                                 |
| ----------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `conversation-avatar`                     | `ConversationAvatar`                         | kinds `user`/`agent`/`system`, no domain type                                                |
| `message-row`                             | `MessageRow`                                 | slots for attachments, links, actions; `streaming` added                                     |
| `message-composer`                        | `MessageComposer`                            | controlled value, slots, draft survives a failed send                                        |
| `conversation-surface`                    | `ConversationSurface`                        | sticks to bottom only when already there                                                     |
| `thread-panel`                            | `ThreadPanel`                                | `aside` landmark, root message pinned                                                        |
| conversation layout CSS                   | `ConversationPane`                           | header/transcript/composer/thread slots; the thread column and its narrow overlay are shared |
| mention/attachment menu CSS               | `ComposerMenu` + `ComposerMenuItem`          | the panel and the row are shared; what the rows offer is the caller's model                  |
| `modal-dialog`                            | `ModalDialog`                                | unmounts closed, `inert` background, explicit label                                          |
| `account-menu`                            | `AccountMenu`                                | **items come from the caller**                                                               |
| `global-workspace-rail`                   | `SideRail` + `SideRailItem` + `AccountMenu`  | composition; the rail's content is domain                                                    |
| `task-board`                              | `Board`                                      | column ids and `canDrop` are the caller's                                                    |
| `task-detail`, `artifact-detail`          | `DetailPanel` + `DetailPanelSection`/`Field` | `aside` with a label, sticky header                                                          |
| `capability-card`, `agent-status`         | `StatusChip` + `StatusList`                  | six tones, `unknown` distinct from `neutral`                                                 |
| `agent-roster`, channel and room lists    | `Item` / `ListRow`                           | the row ladder                                                                               |
| `room-icon`, `plugin-logo`                | `EntityIcon`                                 | monogram fallback, tone owns its own contrast                                                |
| `version-dialog`                          | `UpdateDialog`                               | an adapter supplies the transport                                                            |
| `workspace-brand`                         | `EntityIcon` + the type scale                | an eyebrow and a title are not a component                                                   |
| `account-drawer`                          | `Drawer` + `AccountMenu`                     | a composition                                                                                |
| `settings-section`                        | `SettingsSection`                            | unchanged in intent                                                                          |
| grouped settings navigation               | `SettingsLayout` + `SettingsNavigation`      | host owns selection, hash/preferences and panel content                                      |
| `workspace-states` (empty/error/skeleton) | `Empty`, `Skeleton`                          | the empty state takes an action slot                                                         |
| `keyed-rows`                              | `keyedRows` (a util)                         | unchanged — this one is the highest-value port                                               |
| `notifications`                           | **stays in adea**                            | URL construction and preview redaction are app policy                                        |
| `on-screen-controls`                      | `SceneControls`                              | shared movement/jump/zoom arrangement and hold lifecycle; host maps callbacks to its scene   |
| `scene-settings`                          | **stays in adea**                            | Agent Sim's 3D scene settings are domain, not design                                         |
| `virtual-*`                               | **stays in adea**                            | the virtual-room transport is domain                                                         |

### Returning focus from a controlled dialog

`ModalDialog` captures the focused element before it opens and restores focus
after a conditionally mounted dialog closes. When a pointer-opened dialog may
open while the browser still has `body` focused, pass an accessor for the real,
stable opener. A host wrapper should forward this prop to `ModalDialog`:

```tsx
import { createSignal, Show } from 'solid-js'
import { ModalDialog } from '@adea-ai/ui/components/ui/modal-dialog'

function Preferences() {
  const [open, setOpen] = createSignal(false)
  const [opener, setOpener] = createSignal<HTMLButtonElement>()

  return (
    <>
      <button ref={setOpener} type="button" onClick={() => setOpen(true)}>
        Open preferences
      </button>
      <Show when={open()}>
        <ModalDialog
          open
          onClose={() => setOpen(false)}
          restoreFocusRef={() => opener()}
          title="Preferences"
        >
          {/* Preferences content */}
        </ModalDialog>
      </Show>
    </>
  )
}
```

Pass the element that should receive focus back, not a closing menu item that
will be removed or a guessed document element. The opener must still be
connected, visible, enabled, and outside inert or hidden content when the dialog
closes. A caller that prevents close autofocus owns focus restoration; the
component also leaves focus alone when a different overlay has taken control.
Use the accessor for controlled dialogs without a composed `DialogTrigger`; a
focused opener can be inferred automatically when it is available.

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

The packed core fixtures enforce complete CSS discovery, including shared helpers:
Button is 32,155 raw CSS bytes, ModalDialog is 39,385, and AppShell is 25,389.
Their CSS caps are 32/40/32 KiB respectively. Dialog's earlier partial fixture
measured 25,088 bytes because it omitted dialog/button sources and overlay helpers;
that was incomplete styling, not a usable baseline. Optional Chart/Carousel CSS
caps are 28/35 KiB. One JavaScript budget moved in the 2026-10 accent pass: the
contextual-sidebar probe bundles `lib/overlay` whole, and the swatch tone ladder
plus the dialog-surface split grew it to 43,088 bytes solid gzip against main's
43,006 — a cap that held 2 bytes of headroom. Re-baselined 42 → 43 KiB, not
relaxed.
