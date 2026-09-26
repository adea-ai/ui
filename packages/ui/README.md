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

The root barrel currently also resolves optional chart/carousel peers during
bundling. A clean root-import consumer without those peers fails; use dedicated
component subpaths for lightweight consumers while that compatibility contract is
being resolved. Optional installation metadata alone does not prove elimination.

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

`globals.css` pulls in all four interface faces, which is the simple path. If
you would rather not ship faces you do not use, import the stylesheets
individually:

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

## Licence

Apache-2.0.
