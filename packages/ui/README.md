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

## Native select

Use `NativeSelect` for a compact list of known choices that should keep native
keyboard, form submission, option, and label behavior:

```tsx
import { NativeSelect } from '@adea-ai/ui/components/ui/native-select'
import { Label } from '@adea-ai/ui/components/ui/label'

<Label for="relationship-kind">Relationship kind</Label>
<NativeSelect
  id="relationship-kind"
  name="relationshipKind"
  value={kind()}
  onChange={handleChange}
  options={[
    { value: 'all', label: 'All relationships' },
    { value: 'derived', label: 'Derived' },
  ]}
/>
```

`NativeSelect` renders a real `<select>` and passes native props and children
through. Use `value` with `onChange` for a controlled selection, or `defaultValue`
to initialize an uncontrolled one. Use `Select` for searchable, runtime, or
longer lists that need a custom popover.

`InputControl` is the styled native input without suggestion-list behavior. Use
`Input` when a form should offer native datalist suggestions; custom values
remain valid and submit unchanged.
The library owns the datalist and unique association; a suggestion does not
restrict the submitted value. Native `required`, `pattern`, form, event, and
ref props still apply to the input.

`ThreadPanel.headerActions` accepts shared controls for host actions such as
marking a thread unread. Closing the thread remains a separate labelled,
tooltip-backed control. Hosts retain read-marker and message authority.

`AccountMenu` owns the trigger tooltip, menu keyboard behavior, and session row.
Pass `size` to match its host control size. Use an item's `onSelect` for an
immediate action, or `onSelectAfterClose` to open a dialog after the menu has
finished closing. The latter receives the connected trigger button for dialog
focus restoration and is cancelled if the menu unmounts. Authentication,
updates, navigation, and other effects remain host callbacks.

`SidebarNavTitle` accepts polymorphic `as` for a host's title heading.
Use `SidebarNavSection.headingAs` (h1 through h6) for section headings.
Sections may be uncontrolled with `defaultOpen` or controlled with `open` and
`onOpenChange`. Put disclosure-button attributes and host-owned row interactions
in `triggerProps`; its `onClick` and `onKeyDown` run before shared behavior, and
`preventDefault()` cancels the corresponding toggle or Alt+Arrow reorder callback.
`triggerProps.onReorder` receives `up` or `down`; the host remains responsible for
updating its hierarchy and preserving stable row identity.
Disclosure buttons stay inside their heading and trailing actions stay outside
it, preserving hierarchy and independent keyboard actions.

`Board` checks the caller's legal-move predicate before settling a pointer drop.
Ctrl/Cmd + arrow moves skip disabled columns without wrapping at the edges.
After a controlled move settles, focus follows the moved card only when the
source card owned focus; another focus or pointer action cancels restoration.

`CatalogBrowser` presents a host-owned searchable catalog with ordered category
groups, discover/installed tabs, bounded group expansion, optional filters and
supplemental tabs. Give `entries` the full set of detail records so opening an
item remains stable when a query or tab filters the visible `groups`. The host
owns catalog verification, filtering, installed state, permission decisions,
errors, and actions. Selecting an item opens its host-rendered detail and
returns focus to the originating result when Back is chosen. `CatalogDetail`
provides the shared item summary/action frame and `CatalogDetailSection` gives
host-specific permissions or metadata a shared section surface. Supply
`resultsRegionLabel` and `detailRegionLabel` to name their keyboard-focusable,
shared `ScrollArea` regions. The results area scrolls notices along with loading,
empty, and error states even when those states contain no interactive control.

```tsx
import {
  CatalogBrowser,
  CatalogDetail,
  CatalogDetailSection,
  type CatalogBrowserEntry,
  type CatalogBrowserGroup,
} from '@adea-ai/ui/components/composites/catalog-browser'

const entries: readonly CatalogBrowserEntry<VerifiedPlugin>[] = /* all detail records */ []
const groups: readonly CatalogBrowserGroup<VerifiedPlugin>[] = /* visible filtered groups */ []

<CatalogBrowser
  open={open()}
  tabs={[
    { id: 'discover', label: 'Discover' },
    { id: 'installed', label: 'Installed' },
    { id: 'navigation', label: 'Navigation', kind: 'supplemental' },
  ]}
  tab={tab()}
  tabsLabel="Catalog views"
  onTabChange={setTab}
  query={query()}
  onQueryChange={setQuery}
  searchLabel="Search catalog"
  searchPlaceholder="Search applications"
  resultsRegionLabel="Catalog results"
  resultCount={visibleCount()}
  resultLabel={(count) => `${count} applications`}
  loadingLabel="Loading catalog"
  status={catalogStatus()}
  catalogError={catalogError()}
  emptyState={emptyState()}
  groups={groups}
  entries={entries}
  selectedId={selectedId()}
  onSelect={(plugin) => setSelectedId(plugin.id)}
  onBack={() => setSelectedId(null)}
  backLabel="Back to catalog"
  detailRegionLabel="Application details"
  installedLabel="Installed"
  publishedByLabel={(publisher) => `Published by ${publisher}`}
  showMoreLabel={(hidden) => `See ${hidden[0]?.name} and more`}
  showLessLabel="Show less"
  renderIcon={(plugin) => <PluginIcon plugin={plugin} />}
  renderDetail={(plugin) => (
    <CatalogDetail
      title={plugin.name}
      description={plugin.description}
      category={plugin.category}
      publisher={plugin.publisher}
      publishedByLabel={(publisher) => `Published by ${publisher}`}
      action={<InstallButton plugin={plugin} />}
    >
      <CatalogDetailSection title="Permissions">
        <PluginPermissions plugin={plugin} />
      </CatalogDetailSection>
    </CatalogDetail>
  )}
  renderSupplementalView={(id) => (id === 'navigation' ? <NavigationSettings /> : undefined)}
/>
```

The `CatalogBrowser` story demonstrates category expansion, search, separate
installed content, a supplemental navigation surface, and host-provided details.

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

The catalogue is 34 themes across two appearances, grouped into families. The
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
| Theme      | any of the 34 catalogue ids                        | the variant's tokens, written as custom properties on `<html>` |
| Accent     | `theme` (follow the variant) or one of six presets | a `data-accent` attribute on `<html>`                          |
| Typeface   | five options                                       | a `data-font` attribute on `<html>`                            |

Read and change the current selection with `useTheme()`:

```tsx
const { selection, resolvedAppearance, setSelection, themes } = useTheme()
setSelection({ accent: 'amber' })
```

Two components ship for the settings surface: `AppearancePanel` is the whole
appearance view, and `ThemeToggle` is the light/dark switch on its own.

`SettingsLayout` composes a controlled vertical tab root, grouped `SettingsNavigation`,
and a scrollable panel viewport. Supply the selected `value`, `onChange`, navigation
groups, and matching `TabsContent` panels. The host owns URL or preference updates
and panel content; the layout contracts its rail at narrow widths, reports repeated
activation through `onReselect`, and reveals the selected row by default. Use
`SettingsNavigation` directly when you already own the surrounding tabs composition.
Shared tabs associate panels with custom trigger IDs in browser and server renders;
an explicit panel `aria-labelledby` takes precedence. Independent tab roots keep
their associations separate.

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
with no observer or mount pin. Re-enabling it explicitly re-arms at the bottom
unless the host supplies `initialReadingPosition: { top, following }`. That
snapshot is consumed only on mount, identity reset or follow re-enable; ordinary
snapshot prop changes never reposition the reader. A parked snapshot releases
follow until an explicit jump or native return to the bottom. The
`onReadingPositionChange` callback reports native offset and actual follow intent,
including small upward moves inside the jump visibility threshold. An optional
`resetKey` resets follow or consumes the current identity's snapshot. Canonical
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
and all four selected KiroCrew attribution sections must be present. This pilot adds no server
and removes its temporary consumer.

A separate packed busy-action fixture imports only `BusySendButton`. Both
conditions and engines check disabled firing with live mode selection, the scoped
Tab cycle, focus restoration, action-only execution, unavailable-mode recovery
and square-control token delivery (24 check groups, plus the conversation's 28).
Its measured gzip JS baseline is 50,308/50,429 bytes with a separate 50 KiB cap;
both fixtures share the 42 KiB raw CSS cap. Their module graphs must exclude each
other's unrelated components as well as charts, editors, terminal/highlighter,
theme JS, fonts and workshop assets. Tailwind scans the required external source
folders explicitly; this check does not assume consumer node_modules scanning.

This lane complements `check:packed-consumer`; it does not replace its required
root imports, lightweight controls, overlay and shell checks. Chart and Carousel use explicit optional-engine subpaths; core root imports do not
require their peers. The root-contract lane independently checks that API. These
composition fixtures do not certify full donor Chat, rendered Dev/Chat state
restoration or production adoption.

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
reference-only draft can send or queue without becoming steerable. Explicit false
also vetoes delivery when the draft contains text; alternate-action hints appear
only when that action is eligible. Mode selection
itself never fires. `approvalFocus` is host-derived
presentation, not a permission decision. Agent and model controls remain distinct
host contributions in `context`.

This is an unshipped release proposal for UI issue #21, dependent on the
packing/IME/follow/busy PRs #16/#18/#19/#20. It is not full donor Chat,
canonical runtime restoration or application adoption. The separately scoped,
opt-in paste-token editor for issue #532 is documented below. Sent-prompt
undo/history, manual resize, upload/skill/voice/optimizer and stop/resume
operations are not claimed by these ports. They require their own mapped reusable
behavior or application composition as the owning issues specify.

The composed-input packed fixture checks collapse/draft retention, shelf unmount,
focus restoration, failed-delivery recovery, controlled busy mode, its alternate
gesture, native IME defaults and external Tailwind styles under both exports and
both engines, including reference-only queue eligibility/steer refusal and the
pending-delivery state with its explicitly scanned spinner CSS. On the current
actual-tarball run, its gzip JS is 53,554 bytes compiled and 53,650 bytes Solid,
below the unchanged 55,296-byte cap; CSS is 41,624 bytes under the shared 43,008-byte
cap. The separate atomic fixture measures 58,922/59,043 gzip JS and 42,289 CSS.
Its measured incremental cost over the same-condition composed fixture is
5,368/5,393 gzip JS, with 751 bytes of headroom under the accepted 6 KiB feature
increment ceiling, and 665 additional CSS bytes. The gate applies the 6 KiB
limit to that paired-fixture delta; modules retained in both bundles are excluded
from the increment. The unchanged 54 KiB composed ceiling and shared 43,008-byte
CSS ceiling still apply, and no production bundle cap has changed. The gate checks
both export conditions and engines, reports native Node SSR separately, and keeps
plain/atomic module ownership separate. Selected Kiro NOTICE attributions and the
license must survive the tarball.
Native CSS content sizing replaces live-field measurement on the two verified
engines, both of which support it; legacy-engine fallback is not claimed.

The release gate `bun run check:packed-conversation` installs the actual tarball
with optional engines absent, checks compiled and Solid browser conditions in
Chromium and WebKit, and compiles installed Solid source for native Node SSR.
The expanded server output includes the input and context; collapsed output
keeps the draft preview while omitting both, and token-mode SSR retains its
highlight mirror and token text. Browser cases check opaque menu surfaces,
control sizing, streaming follow, IME ownership, draft recovery, collapse/focus,
busy actions, pending spinner styling, atomic token paste/pruning, accessible
previews and the referenced-block submit snapshot.

External CSS discovery includes the exact component files used by the fixture,
Button's `src/lib/variants.ts`, the token editor and Tooltip source, and menu
compositions' `src/lib/overlay.ts`.
`node_modules` is excluded from automatic Tailwind scanning; importing a
stylesheet alone does not discover these shared class strings. Stories are
excluded from discovery. Earlier plain and busy CSS measurements were 37,060
and 40,644 bytes; current composed and atomic fixture measurements are listed
above, all under the existing shared 43,008-byte cap. Existing gzip JS caps
remain 26, 50 and 54 KiB for the plain, busy and composed fixtures,
respectively. This fixture proves the published component contract; mounted
Adea/Cortana services, hydration and manual IME/assistive-technology acceptance
remain application evidence lanes.

`sendableActions` is the host's payload eligibility contract: explicit `false`
refuses that action even with typed text, explicit `true` supports structured
payloads without text, and omitted entries fall back to nonempty text. Selecting
an unavailable action cannot override this contract through keyboard delivery.

Local packed interaction gates require `bunx playwright install chromium webkit`
after dependency installation. On Linux, use `--with-deps` when required system
libraries are absent. Automation uses headless disposable browser contexts.

## Paste-token model (issue #532 selected unit)

`@adea-ai/ui/components/conversation` also exports the pure paste-token model:
`PasteBlock`, `isPasteBlock`, `countLines`, `shouldCollapse`, `nextSeq`,
`formatToken`, `findTokenRanges`, `tokenRangeAt`, `pruneBlocks`, `expandAll`,
`recollapsePastes`, `remapCarriedBlocks`, `stripTrailingBlankLines`, and the
threshold and marker constants. Hosts provide stable, bounded ASCII block IDs and own
draft state, persistence, message reconciliation and editor behavior. The model
does not read storage or the clipboard, upload files, edit a textarea, or
provide undo/history, previews or chips. The opt-in editor below composes this
pure model with a controlled textarea. The selected source and Apache-2.0
attribution are recorded in the issue #532 entries in `NOTICE`.

### Controlled paste-token composer (issue #532 selected editor)

`ChatComposer` keeps its plain-text API and bundle closure. Consumers that need
atomic paste editing import `AtomicChatComposer` from the direct
`@adea-ai/ui/components/conversation/atomic` subpath. It accepts host-owned
`blocks`, a synchronous `createBlockId()` and one `onChange({ text, blocks })`
callback. Paste, native typing and pruning report the complete draft together.
Submit receives one snapshot containing `text`, the selected `action` and cloned
referenced `blocks` before delivery starts. Both entries share a private
composition shell; the UI owns no paste identity, history, storage, transport or
undo state.

The selected editor collapses text-only pastes at the existing three-line or
200-character thresholds, supports raw Cmd/Ctrl+Shift+V for the next paste,
preserves standalone and Markdown quote-prefix placement, and keeps token
deletion, navigation, selection and dropped-text replacement atomic.
Double-click or touch expands a token. Copy and cut expand fully selected tokens
in order while partial selections remain native. An `aria-hidden` mirror
highlights tokens behind the single labeled textarea. Hover and caret previews
wait 300 ms, scan and show at most 1,200 characters across up to 12 lines, close
when their text/block/scope becomes stale, and stay suppressed on touch devices. Keyboard
users can open the token next to the caret or current selection with Alt+Down
Arrow and dismiss it with Escape.
The input announces that shortcut and the open preview through `aria-describedby`
while keeping focus in the textarea. The preview uses the existing tooltip
portal without intercepting textarea input.

Only `ClipboardEvent.clipboardData` text is read. Clipboard permissions,
images/files, uploads, rich editors, persistence, sent-prompt history and
application adoption remain with the host. The added `AtomicPasteTokens` story
shows the controlled contract; component browser and packed conversation gates
exercise Chromium and WebKit. The plain fixture retains its existing caps.
Atomic whole-bundle and incremental costs are reported above; the packed gate
enforces the accepted 6 KiB incremental ceiling while retaining the existing
composed and CSS ceilings. Donor source/test provenance is in the issue #532
editor entry in `NOTICE`.

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
The packed renderer gate includes the UI #20 size-token correction and the host
presentation fixture. It checks the real package in compiled and Solid
conditions; complete shell composition, production adoption and release remain
required.
No persistent state, session services, native drag region or host framework is
imported into this model.

### Host pane presentation hooks

Controlled split ratios survive host visibility changes and disposal. Corvu panel
registration and unregistration callbacks with incomplete sizes, and callbacks
from detached or hidden roots, do not become host resize requests. Real pointer
and keyboard resizing still flows through the same constrained callback.

`SplitLayout` can keep its default pane header while allowing a host to supply
inline visible content with `renderPaneLabel`, opt pane regions into keyboard
Tab navigation with `paneTabIndex={0}`, and provide a domain-specific splitter
name with `labelForSeparator`. Pane regions remain programmatically focusable
by default (`paneTabIndex={-1}`), and separators keep their orientation-based
names unless the host supplies a label.

`renderPaneLabel` receives a stable `Accessor<L>` once for each leaf owner.
Read `leaf()` inside the returned JSX so Solid tracks payload changes while the
same pane owner is retained during split and move operations. This visible
header content does not define the region's accessible name or the close
button's name: both continue to come from `labelForLeaf`, so hosts should
provide an accessible domain label there as well.

The `HostPresentation` story shows a decorative icon and host title, keyboard
pane stops, and a workspace-specific separator name. A narrow-width component
fixture also checks that a long host title does not widen its pane header.

`bun run check:packed-layout` packs the real artifact, installs it in a disposable
consumer with peers omitted and scripts disabled, and exercises the direct model
subpath in native Node and the Solid source condition. It verifies zero runtime
imports and a 3 KiB gzip model budget (measured baseline: 2,455 bytes). This is
model-subpath evidence; it does not waive UI #16's package attribution/conditional
export corrections or the separate root compatibility gate.

`bun run check:packed-paste-model` installs the actual archive with peer and
optional packages omitted. It verifies the direct
`@adea-ai/ui/components/conversation/paste-tokens` entry in native Node and the
Solid source condition, a strict clean TypeScript consumer without ambient types,
round-trip/range/pruning and invalid-metadata behavior, and exact packed
LICENSE/NOTICE fidelity. The pure compiled module retains zero runtime imports
and stays within a 3 KiB gzip budget. This gate runs in local verification, CI
and publication; textarea editing and production adoption remain separate gates.

### Controlled appearance editor

`AppearanceEditor` and `AppearancePopover` retain the accepted Zeron-derived
System/Light/Dark miniature cards, independent light/dark theme rows, palette
swatches, default/preset/custom accent choices and Theme default/Frosted/Opaque
surface choices. The popup supports live host preview and Save/Cancel/Reset;
Kobalte provides radio navigation, selection, dismissal and focus restoration. Since
its menus prevent Tab, the theme row carries Tab and Shift+Tab through the enclosing
dialog's focus order. `DropdownMenuContent.portalMount` keeps the theme menu within
its enclosing modal's accessible subtree.

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
accessibility, focus and pointer dismissal, Escape, live-preview rollback,
valid/invalid custom accents, Save pending state, mobile selection and
320/768/1024/1440px layouts. A separate native Node server-render fixture verifies the composed editor without
browser or application globals. These checks
are component integration evidence; they do not certify application persistence,
native effects, packaged applications or manual assistive technology acceptance.

### Packed appearance contract

`bun run check:packed-appearance` installs the actual tarball without optional
Chart/Carousel engines, then runs all 25 component cases in Chromium and WebKit
against compiled and Solid entries (100 execution runs total).
The same fixture verifies
Solid source SSR in native Node. Keyboard choices, live preview, save/cancel/reset,
nested dismissal, validation, pending save, narrow layouts with reachable footer actions, and automated accessibility
are covered. Production persistence, native transparency, hydration and manual AT
remain application acceptance gates.

The disposable host explicitly imports four isolated canonical theme records plus
color/CSS adapters from published `@adea-ai/themes`; the UI composition imports only
theme types. Both conditions retain one Solid runtime and one JS chunk, external CSS,
no fonts or unrelated engines, and full donor attribution. The combined host/editor
budgets are 64 KiB gzip JS and 50 KiB raw CSS; measured baselines are 63,599 gzip
JS / 50,059 raw CSS bytes for compiled and 64,126 gzip JS / 50,059 raw CSS bytes
for Solid, with complete discovery of nested controls and shared helpers. This
includes host theme-preview behavior, not just the editor primitive.

Local packed interaction gates require `bunx playwright install chromium webkit`
after dependency installation. On Linux, use `--with-deps` when the required
system libraries are absent. All automation runs headless with disposable profiles.

## Paste-token model (issue #532 selected unit)

`@adea-ai/ui/components/conversation` also exports the pure paste-token model:
`PasteBlock`, `isPasteBlock`, `countLines`, `shouldCollapse`, `nextSeq`,
`formatToken`, `findTokenRanges`, `tokenRangeAt`, `pruneBlocks`, `expandAll`,
`recollapsePastes`, `remapCarriedBlocks`, `stripTrailingBlankLines`, and the
threshold and marker constants. Hosts provide stable, bounded ASCII block IDs and own
draft state, persistence, message reconciliation and editor behavior. The model
does not read storage or the clipboard, upload files, edit a textarea, or
provide undo/history, previews or chips. Its selected source and Apache-2.0
attribution are recorded in the issue #532 entry in `NOTICE`.

## Transcript composition

`TranscriptComposition` assembles ordered host-classified rows, contiguous groups,
turn presentation and accessible fold controls. Import it from the public component
subpath:

```tsx
import {
  TranscriptComposition,
  type TranscriptCompositionRendererProps,
  type TranscriptRow,
} from '@adea-ai/ui/components/conversation/transcript-composition'

type Message = { text: string }
const rows: readonly TranscriptRow<Message>[] = [
  { id: 'question-1', value: { text: 'Inspect the cursor.' }, opensTurn: 'reset' },
  {
    id: 'tool-1',
    value: { text: 'Read the cursor.' },
    fold: 'tool',
    call: { phase: 'request', id: 'call-1' },
  },
]

function HostMessage(props: TranscriptCompositionRendererProps<Message>) {
  return <article>{props.row.value.text}</article>
}

export function TranscriptPreview() {
  return <TranscriptComposition rows={rows} renderRow={HostMessage} />
}
```

Each row needs a stable unique `id` within its transcript. The host supplies the
Solid row component and classifies turn boundaries, calls, conclusions,
always-visible actions and redacted values. The renderer does not parse protocol
payloads or decide permission, session, event, delivery or success state.

Settled tool folds start closed and unmount their hidden row payloads. Live rows
stay open until the host marks them settled; an explicit row choice survives that
running-state transition. `foldMode="prose"` folds host-marked eligible activity
before a host-designated conclusion, leaving that conclusion visible.
The `foldState="collapsed"` command keeps hidden
content mounted. It folds eligible rows before a host-marked conclusion; without
that boundary it leaves prose visible and can still collapse explicitly classified
tool calls. Always-visible rows stay in place. `disclosure` plus
`onDisclosureChange` lets an application restore explicit choices from its own
durable store using `transcriptDisclosureKey`.

`bun run check:packed-transcript` installs the actual tarball without optional
chart/carousel engines, compiles both published export conditions, and checks the
same behavior in headless Chromium, WebKit and native Node SSR. It covers row-owner
identity through loose-to-turn promotion, tool request counting, mounted prose,
keyboard disclosure, visible actions and automated accessibility. This is shared
composition evidence; bounded runtime projection, storage and production chat
integration remain application acceptance gates. Attribution for the selected
KiroCrew source contracts is recorded in the issue-specific `NOTICE` entry.

The shared `TopBar` contracts its middle track on narrow screens. Its side groups
scroll horizontally when enlarged text makes all controls wider than the viewport;
keyboard focus reveals each action. Groups opt out of native window dragging.
Use `TopBarTitle align="center"` for a centered title and layout-only visibility
classes when a title should yield space to essential controls.

### Controlled appearance mode

`ThemeModeToggle` provides the shared light/dark/system selector for hosts that
own their preference provider and storage. Pass `mode` and `onModeChange`; the
control owns roving keyboard focus, pressed state and explanatory tooltips. It
does not require or mount the shared `ThemeProvider`. `ThemeToggle` retains its
existing provider-bound API.
