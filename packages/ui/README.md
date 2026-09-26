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

## Packed conversation pilot

After building, run `bun run check:packed-conversation` to pack the actual npm
artifact and install it into a disposable consumer without optional heavy peers.
The composition imports the documented conversation subpath and builds under
both default compiled and Solid source conditions. Headless Chromium and WebKit
check failed-draft retention, recovery, native IME candidate defaults and commit
latch, reader intent, keyboard jump focus and external Tailwind utility delivery.
The output records retained module paths, JS/gzip/CSS totals, font exclusion and
one Solid runtime. Its first measured baseline was 23,880/23,936 gzip JS bytes
(compiled/Solid) and 40,203 raw CSS bytes. The fixture gates 26 KiB gzip JS and
42 KiB raw CSS, alongside independent module exclusions. The packed Apache license
and all three selected KiroCrew attribution sections must be present. This pilot adds no server
and removes its temporary consumer.

A separate packed busy-action fixture imports only `BusySendButton`. Both
conditions and engines check disabled firing with live mode selection, the scoped
Tab cycle, focus restoration, action-only execution, unavailable-mode recovery
and square-control token delivery (24 check groups, plus the conversation's 28).
Its measured gzip JS baseline is 50,308/50,470 bytes with a separate 50 KiB cap;
both fixtures share the 42 KiB raw CSS cap. Their module graphs must exclude each
other's unrelated components as well as charts, editors, terminal/highlighter,
theme JS, fonts and workshop assets. Tailwind scans the required external source
folders explicitly; this check does not assume consumer node_modules scanning.

This lane complements `check:packed-consumer`; it does not replace its required
root imports, lightweight controls, overlay and shell checks. The known optional
chart/carousel root-export compatibility decision remains unresolved. A passing
subpath pilot does not certify root resolution, native SSR, the full Chat donor
composition, rendered Dev/Chat state restoration or production adoption.

## Licence

Apache-2.0.

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

## Composed Chat input pilot

`ChatComposer` translates the pinned Kiro composer hierarchy: knowledge context,
follow-ups and adjacent band, approval/notices, staged content, input/action
rows and the context shelf. It composes the existing IME and busy-action units.
Its optional controlled `collapse` contract unmounts input and shelf and replaces
them with a labeled bar showing the waiting draft's first line. Collapse keeps
the host draft and caret selection; `controlRef` exposes instance-scoped
`focus()`/`expandAndFocus()` instead of a global shortcut or broadcast.

The host supplies `value`, `onValueChange` and `onSubmit({text, action})`; it owns
attachments and runtime authority and clears its draft only after confirmation.
The shared input guards pending delivery, reports failure, visibly blocks
unsupported delivery and fences local feedback on `resetKey`. Enter follows the
controlled busy mode, while Ctrl/Cmd+Enter requests the other supported busy
action. `sendableActions` declares non-text payload eligibility per action: a
reference-only draft can send or queue without becoming steerable. Mode selection
itself never fires. `approvalFocus` is host-derived
presentation, not a permission decision. Agent and model controls remain distinct
host contributions in `context`.

This is an unshipped composition pilot for UI issue #21, dependent on the original
packing/IME/follow/busy PRs in this integration branch. It is not full donor Chat,
canonical runtime restoration or application adoption. The donor's paste-token
editor, sent-prompt undo/history, manual resize, upload/skill/voice/optimizer and
stop/resume operations are not claimed by these ports. They require their own
mapped reusable behavior or application composition as the owning issues specify.

The composed-input packed fixture checks collapse/draft retention, shelf unmount,
focus restoration, failed-delivery recovery, controlled busy mode, its alternate
gesture, native IME defaults and external Tailwind styles under both exports and
both engines, including reference-only queue eligibility/steer refusal and the
pending-delivery state with its explicitly scanned spinner CSS. Its measured gzip JS baseline is 53,345/53,437 bytes with a 54 KiB cap
and 33,201 raw CSS bytes under the shared 42 KiB cap. The three fixtures total 96
check groups, retain one Solid runtime/JS chunk each, and exclude unrelated units.
All four selected Kiro NOTICE sections and the license must survive the tarball.
Native CSS content sizing replaces live-field measurement on the two verified
engines, both of which support it; legacy-engine fallback is not claimed.

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

This is an unshipped model checkpoint, not the full shell renderer. The
maintained accessible renderer, stable content ownership, composed shell story,
consumer interactions, production adoption and release remain required stages.
No persistent state, session services, native drag region or host framework is
imported into this model.

`bun run check:packed-layout` packs the real artifact, installs it in a disposable
consumer with peers omitted and scripts disabled, and exercises the direct model
subpath in native Node and the Solid source condition. It verifies zero runtime
imports and a 3 KiB gzip model budget (measured baseline: 2,455 bytes). This is
model-subpath evidence; it does not waive UI #16's package attribution/conditional
export corrections or the separate root compatibility gate.
