# @adea-ai/ui

The shared Solid component library for Adea and Cortana. Applications retain
their domain compositions, persistence, services, and native capabilities.

```sh
bun add @adea-ai/ui
```

SolidJS, Tailwind v4, Kobalte, corvu. No runtime dependency on a framework of
its own — `solid-js` is a peer, and the four heavy optional peers (`chart.js`,
`embla-carousel`, `embla-carousel-solid`, `solid-chartjs`) are marked optional
so installing the library does not drag in a charting or carousel engine you
never use.

## The short version

Import the stylesheet, wrap your app in the provider, done.

```tsx
import { ThemeProvider } from '@adea-ai/ui/components/theme'
import '@adea-ai/ui/globals.css'

export function App() {
  return (
    <ThemeProvider>
      <YourApp />
    </ThemeProvider>
  )
}
```

`ThemeProvider` is what applies a theme, an accent and a typeface, and what
persists the choice. Without it you get the two default variants and nothing
else.

Folder subpaths such as `@adea-ai/ui/components/ui/button` resolve the folder's
public index under the types, Solid source, development, and compiled conditions.
The package includes source for Solid compilation and Tailwind discovery, and
compiled JavaScript plus declarations for other supported consumers. License and
donor notices travel in `dist/LICENSE` and `dist/NOTICE`.

Tailwind ignores dependency directories by default. Register the component
directories your application uses in its stylesheet, relative to that stylesheet:

```css
@import 'tailwindcss';
@import '@adea-ai/ui/theme.css';
@import '@adea-ai/ui/base.css';
@source '../node_modules/@adea-ai/ui/src/components/ui/button';
```

`globals.css` combines Tailwind, base styles, and theme tokens. Fonts require a
separate explicit `@adea-ai/ui/fonts.css` import. The packed-artifact gate expands
all component and library export conditions and rejects leaked story/test files,
including declaration output.

## Breaking root-export migration

Chart and Carousel exports now live exclusively on their component subpaths.
Core root imports work without their optional peers. Replace root imports:

```tsx
import { Button } from '@adea-ai/ui'
import { LineChart } from '@adea-ai/ui/components/ui/chart'
import { Carousel, CarouselSlide } from '@adea-ai/ui/components/ui/carousel'
```

Install `chart.js` and `solid-chartjs` for charts, or `embla-carousel` and
`embla-carousel-solid` for carousels. All chart helpers and types move with the
chart entry; all carousel helpers and types move with the carousel entry.
Folder export conditions, registry distribution and component behavior remain
available. This is an intentional breaking export change, recorded in release
notes through the breaking Conventional Commit, rather than a silent patch.

## Theming

The catalogue is 27 themes across two appearances, grouped into families. The
provider takes an initial selection and every axis is a plain value:

```tsx
<ThemeProvider
  initial={{
    appearance: 'system', // 'light' | 'dark' | 'system'
    lightThemeId: 'adea-light',
    darkThemeId: 'adea-dark',
    accent: 'theme', // or 'violet' | 'blue' | 'green' | 'amber' | 'cyan' | 'pink'
    font: 'space-grotesk', // or 'system' | 'geist' | 'geist-mono' | 'jetbrains-mono'
  }}
>
```

| Axis       | Values                                             | How it is applied                                              |
| ---------- | -------------------------------------------------- | -------------------------------------------------------------- |
| Appearance | `light`, `dark`, `system`                          | a `dark` class plus `color-scheme` on `<html>`                 |
| Theme      | any of the 27 catalogue ids                        | the variant's tokens, written as custom properties on `<html>` |
| Accent     | `theme` (follow the variant) or one of six presets | a `data-accent` attribute on `<html>`                          |
| Typeface   | five options                                       | a `data-font` attribute on `<html>`                            |

Read and change the current selection with `useTheme()`:

```tsx
const { selection, resolvedAppearance, setSelection, themes } = useTheme()
setSelection({ accent: 'amber' })
```

Two components ship for the settings surface: `AppearancePanel` is the whole
appearance view, and `ThemeToggle` is the light/dark switch on its own.

### Avoiding the flash

A themed app has to know the appearance before the first paint, or it paints
once in the wrong mode. `themeScript` emits the inline script that does it:

```tsx
<head>
  <script innerHTML={themeScript('my-app-appearance')} />
</head>
```

Pass the same key to `ThemeProvider` as `storageKey`, and the two agree.

## Fonts

Fonts are opt-in. `globals.css` does not import font assets; import
`fonts.css` explicitly when those faces are wanted:

```css
@import '@adea-ai/ui/theme.css';
@import '@adea-ai/ui/base.css';
@import '@adea-ai/ui/fonts.css'; /* omit to bring your own */
```

`--font-sans` and `--font-mono` are the two variables everything reads.

## Adding a component

`shadcn add` works against the published registry:

```sh
bunx shadcn@latest add https://adea-ai.github.io/ui/r/button.json
```

## Reviewing it

Every component, every variant and the token galleries are in the workshop:

```sh
bun run storybook
```

The toolbar switches theme, accent, typeface and density live, which is the
fastest way to see how a component behaves across the catalogue rather than in
one theme.

## Busy composer action

Square icon controls use the control-height tokens through the Tailwind `--size`
mapping; `--spacing-control-*` remains the separate inline-padding ladder.
Text controls, icon buttons and toggles share the same height in both densities.
Dimensions remain rem-based and follow the consumer's root font size. The browser
geometry lane checks all six rungs, heights and padding under both themes/densities.

`BusySendButton` translates KiroCrew's split fire/mode-picker composition. Pass
controlled `mode`, `onModeChange` and `onFire`. `disabled` prevents firing while
leaving mode choice available before typing; `selectionDisabled` gates choosing.
Inject `unavailable` reasons for unsupported or unauthorized modes: rows remain
visible, and the selected action cannot fire. Supply `alternateActionHint` only
when the host implements the described keyboard chord. The component adds no
keyboard chord, preference storage, runtime command or queue. Persistence and
same-session preference synchronization remain application-owned.

Kobalte owns the menu and focus lifecycle. Its Tab prevention lacks row cycling,
so a menu-scoped donor translation cycles enabled rows without a document listener.
Stories cover before-typing, working,
unavailable and read-only states. `bun run test:components` checks the isolated
Solid composition headlessly in Chromium and WebKit. Full Chat composition,
packed distribution and real consumer/native acceptance remain separate gates.
## Transcript follow

`ConversationSurface` follows streamed text, earlier-row growth, turn collapse
and pane resizing using the KiroCrew plain-scroller decision contract. A
deliberate upward scroll releases follow, including small moves near the bottom.
Returning to the bottom or choosing **Jump to latest** re-arms it; the action
does not estimate unread messages from pixel distance. Instant pins keep
self-scroll attribution synchronized. Keyboard jumping returns focus to the
transcript when its jump control disappears; automatic pins never move focus.

`threshold` controls jump-button visibility (80px by default), independently of
follow intent. `follow={false}` is fully inert: positioning belongs to the host,
with no observer or mount pin. Re-enabling it explicitly re-arms at the bottom;
it is not an automatic restore-and-resume flag. An optional `resetKey` also
re-arms follow when that identity changes. Canonical
session identity, durable restoration and virtualized transcript windows remain
application-owned. `ref` and `onScroll` still reach the inner scroller.

`bun run test:components` checks the built component in Chromium and WebKit.
The `SurfaceFollowing` story exercises streaming, collapse and pane resizing;
source/license/test provenance is recorded in `NOTICE`.

## Composer keyboard behavior

`MessageComposer` preserves native IME candidate commits and suppresses sending
during composition, including the 50 ms commit window when browser flags have
already cleared. A separate Enter sends after that window; Shift+Enter remains
a soft break. A host or menu that already prevented the event keeps ownership.
The selected KiroCrew textarea guard is translated to Solid ownership; it adds
no document listener or application session state. Source and license details
are retained in `NOTICE`.

Run `bun run test:components` for the built Solid component contracts in
Chromium and WebKit. The event-sequence tests exercise browser handling of
composition flags, timers and focus recovery; manual operating-system IME
acceptance and each application's mounted chat journey remain separate gates.

## Licence

Apache-2.0.

## Binary layout model checkpoint

UI issue #22 extracts the existing attributed bb/Muxy Adea adaptation rather
than introducing another layout tree. `createLayoutState`, `splitPane`,
`movePane`, `closePane`, `undoClosePane`, `focusPane`, `swapPanes`,
`resizeSplit`, `normalizeLayout` and the reading-order helpers are pure.
Leaves extend `{kind: 'leaf', id: string}` with any host-owned payload. Closing
the last leaf calls an injected placeholder factory; it never selects a harness,
starts a terminal or deletes a project. Eight leaves/depth eight and 10–90%
ratios preserve the accepted contract. Construct or validate a tree before
editing it; the shared constructor validates visual structure and identities,
while applications still decode/scoped-persist preferences and retain unknown
future versions for recovery.

The model and maintained accessible renderer are implemented in this draft.
Stable content ownership and movement are exercised in component fixtures.
The current packed renderer release gate awaits the UI #20 size-token fix;
complete shell composition, production adoption and release remain required.
No persistent state, session services, native drag region or host framework is
imported into this model.

`bun run check:packed-layout` packs the real artifact, installs it in a disposable
consumer with peers omitted and scripts disabled, and exercises the direct model
subpath in native Node and the Solid source condition. It verifies zero runtime
imports and a 3 KiB gzip model budget (measured baseline: 2,455 bytes). This is
model-subpath evidence; it does not waive UI #16's package attribution/conditional
export corrections or the separate root compatibility gate.

### Controlled appearance editor

`AppearanceEditor` and `AppearancePopover` retain the accepted Zeron-derived
System/Light/Dark miniature cards, independent light/dark theme rows, palette
swatches, default/preset/custom accent choices and Theme default/Frosted/Opaque
surface choices. The popup supports live host preview and Save/Cancel/Reset;
Kobalte owns radio, menu, focus and dismissal behavior. `SelectContent.portalMount`
lets a nested menu remain within its enclosing modal's accessible subtree.

Supply canonical `AdeaTheme` previews and `AdeaThemeRecord` choices from
`@adea-ai/themes`, including any validated accent overlay. The editor imports
only their types. Hosts own saved-ID recovery, validation, draft snapshots,
System appearance resolution, native transparency, live application tokens,
Save persistence and restoration on Cancel/dismissal. `saving`,
`saveDisabledReason`, `recoveryNotice`, `customAccentError`, and
`surfaceCapability` expose those outcomes; an unavailable import or Frosted
capability stays visibly unavailable. App-specific persisted versions and the
legacy `translucent` value need an app-owned adapter to the editor's `theme`
surface selection. The library does not silently migrate stored preferences.

The component browser lane uses a real Vite/Solid/Tailwind build in headless
Chromium without an app server. It checks keyboard mode selection, nested menu
accessibility and Escape, live-preview rollback, valid/invalid custom accents,
Save pending state, mobile selection and 320/768/1024/1440px layouts. A separate native Node server-render fixture verifies the composed editor without
browser or application globals. These checks
are component integration evidence; they do not certify application persistence,
native effects, packaged applications or manual assistive technology acceptance.

### Packed appearance contract

`bun run check:packed-appearance` installs the actual tarball without optional
Chart/Carousel engines, then reuses all appearance interactions in Chromium and
WebKit against compiled and Solid entries (60 cases). The same fixture verifies
Solid source SSR in native Node. Keyboard choices, live preview, save/cancel/reset,
nested dismissal, validation, pending save, narrow layouts with reachable footer actions, and automated accessibility
are covered. Production persistence, native transparency, hydration and manual AT
remain application acceptance gates.

The disposable host explicitly imports four isolated canonical theme records plus
color/CSS adapters from published `@adea-ai/themes`; the UI composition imports only
theme types. Both conditions retain one Solid runtime and one JS chunk, external CSS,
no fonts or unrelated engines, and full donor attribution. The combined host/editor
budgets are 64 KiB gzip JS and 50 KiB raw CSS; measured baselines are 62,203/62,643
gzip JS bytes and 50,060 raw CSS bytes with complete discovery of nested controls and shared helpers. This includes host theme-preview behavior,
not just the editor primitive.

Local packed interaction gates require `bunx playwright install chromium webkit`
after dependency installation. On Linux, use `--with-deps` when the required
system libraries are absent. All automation runs headless with disposable profiles.
