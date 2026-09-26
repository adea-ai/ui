# @adea-ai/ui

The Adea design system: the one themed component library that Adea and Cortana
both build on. Neither app implements its own components.

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
import { ThemeProvider } from '@adea-ai/ui'
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

## Licence

Apache-2.0.

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
