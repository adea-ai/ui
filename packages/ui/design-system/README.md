**Adea UI** is one themed component library, one token set and one shell layout, shared by **Adea** and **Cortana**, so two desktop apps read as one product. It is built on shadcn/ui's token names, SolidJS with Kobalte and corvu, and OKLCH colour. The values come from `@adea-ai/themes`.

Three decisions make an interface recognisably this system: **a tinted canvas with the accent as a separate axis**, **dark-first**, and **compact density**.

## Content fundamentals

- The product is a tool used in long sessions. Copy is plain, short and in sentence case: "Delete this thread?", "Workspace settings", "Updated 3 minutes ago".
- Address the user as _you_ and describe actions with verbs on the button ("Delete", "Choose theme"), not "OK".
- No emoji in the interface. Status is carried by a word or an icon _and_ a colour, never colour alone.
- Ids, paths, commands and anything compared character by character go in mono (`code`).

## Colour

- Paint in ladder order: `surface-sunken` (code wells, empty states) → `background` (the canvas) → `card` (raised panels) → `popover` (dialogs, menus) → `chrome` (top bar, rail). `surface-hover` and `surface-active` are fills painted _onto_ a surface.
- **A card always carries `border`.** In light, `card` is a 3.5% step off a white canvas, too little to read as an edge, so a borderless card disappears.
- Colour beyond the canvas has exactly two roles:
  - **`primary`**: the one interactive colour, the thing to press. The user's accent choice (`data-accent` = violet, blue, green, amber, cyan or pink, swatched as `accent-*`) replaces `primary`, `primary-hover` and `ring`. Never hard-code a hue.
  - **Status**: `success`, `warning`, `destructive` and `info`, with `*-subtle` tints for alert backgrounds. They carry meaning and are never decoration.
- Always label a `primary` fill with `primary-foreground`. The label flips polarity: white on the deep light-mode violet, near-black on the bright dark-mode one.
- Set body text in `foreground` (7:1+ on every surface it lands on) and secondary text in `muted-foreground` (4.5:1+). These pairings are asserted in tests, which is why the values look odd. Don't adjust one by eye.
- Use `chart-1` … `chart-6` in order for series. They are the status hues plus blue and violet.

## Typography

- **Space Grotesk** (`sans`) is the interface face. **JetBrains Mono** (`mono`) is for code, terminals, ids and paths. Typeface is a user preference (`data-font` = system, geist, geist-mono or jetbrains-mono). When the UI font is mono, `--ui-tracking` and `--ui-word-spacing` tighten chrome labels.
- **14px (`text-sm`) is the default**, not 16px: body at 400, labels and control text at 500 (`text-sm-label`), emphasis at 600 (`text-sm-strong`).
- **Use `Heading` and `Text`; never hand-write a size and a weight.** A call site names a role and the rung, weight, leading and tracking follow from it.
- `Heading` sizes, all at 600: `display` (`text-3xl`, an app-level headline, once per app at most), `title` (`text-2xl`, a landing title or headline figure), `page` (`text-xl`, a page title and a stat value), `section` (`text-lg`, a section heading inside a page), `card` (`text-base`, card, dialog and settings-section titles), `subsection` (`text-sm`, a sheet or compact panel heading).
- `Text` variants: `body` (`text-sm` 400), `label` (500), `strong` (600), `caption` (`text-xs` metadata), `micro` (`text-2xs` 500, keyboard keys and the status bar), `code` (mono `text-xs`). `tone="muted"` for secondary text.
- Size is visual and the element is the outline: each `Heading` size has a default element (`h1` for display/title/page, `h2` section, `h3` card, `h4` subsection); pass `as` when the outline differs.
- Weights stop at **600**. On a dark surface a bold word blooms.
- The fonts ship with the package (`@adea-ai/ui/fonts.css`, self-hosted variable faces), so an app never fetches a font at runtime or reflows after first paint.

## Density and spacing

- Two control heights carry the product: **28px `control-height-sm`** in toolbars and **32px `control-height-md`** in forms. Never set a 40px control or a 16px body next to them.
- Rows are 32px by default (`row-height-md`). `data-density="compact"` moves the control and row ladders one rung tighter. `control-height-2xl` (48px) is the touch target and never shrinks.
- The shell is a component, and its geometry is tokens: `rail-width` 56px (expanded 236px), `sidebar-width` 256px, `panel-width` 390px, `topbar-height` 48px, `statusbar-height` 28px.

## Shape and elevation

- Radii: `radius-sm` 6px for kbd and menu items, `radius-md` 8px for controls and badges, `radius-lg` 10px for cards, `radius-xl` 14px for dialogs.
- Elevation comes from the surface ladder first and shadows second: `shadow-sm` for cards, `shadow-md` for menus, `shadow-lg` for dialogs. Overlays stack on named rungs only (`z-dialog` < `z-menu` < `z-tooltip` < `z-toast`).

## Motion

Motion tokens have no swatch on this page, so here they are:

| Token             | Value                            | For                                                   |
| ----------------- | -------------------------------- | ----------------------------------------------------- |
| `duration-fast`   | 120ms                            | A state change the user is watching: hover, toggle.   |
| `duration-normal` | 200ms                            | An arrival: an entrance, a disclosure.                |
| `duration-slow`   | 320ms                            | A layout settle.                                      |
| `ease-out`        | `cubic-bezier(0.16, 1, 0.3, 1)`  | Everything with a direction: fast start, long settle. |
| `ease-in-out`     | `cubic-bezier(0.65, 0, 0.35, 1)` | Loops with no start or end: shimmer, skeleton.        |

- Motion is feedback, not decoration; a user never waits for an animation. Every `transition-*` utility defaults to `duration-fast` and `ease-out`.
- Nothing changes size or position on hover. Under `prefers-reduced-motion` nothing moves except the spinner — a frozen spinner reads as a hang.
- Use `Presence` for enter and exit animations so they are skipped under reduced motion.

## Accessibility

- Every text pairing is measured: body 7:1+, secondary text, labels on fills and the focus ring 4.5:1+ (3:1 for the ring) in the two defaults; WCAG AA across the rest of the catalogue.
- The focus ring (`ring`) is never suppressed. It is the only keyboard affordance in the system.
- Status never relies on hue: an alert carries a glyph and a title, a `StatusChip` a word. The **Colorblind** themes move `destructive` to orange and `success` to blue for red-green colour blindness; **High Contrast** raises every pairing.
- Every interaction is reachable twice: hover content is also behind a click, a context menu's actions also appear in a dropdown on the row.
- Reduced motion, reduced transparency and increased contrast are honoured in `base.css`; frosted surfaces fall back to a solid fill.

## Components

- Never restyle a component. Its appearance comes from its `variant` and `size` props, and `class` is for layout only (margin, width, grid placement). If an appearance is missing, extend the component.
- Behaviour comes from Kobalte and corvu: focus trapping, roving tabindex, typeahead. Don't hand-roll it.
- `aria-invalid` carries an error state and the border only paints it. A collapsed rail label becomes a tooltip _and_ a visually hidden span.
- The library has four layers, which is how the cards below are grouped: **primitives** (Actions, Forms, Feedback, Data display, Navigation, Overlays, Layout, Code) that you theme with variants; the **Shell** that places regions of the window (`AppShell`, `SideRail`, `SidebarNav`, `TopBar`, `StatusBar`, `Panel`, `SplitLayout`); **Composites**, opinionated assemblies of both (`Settings`, `UpdateDialog`, `AccountMenu`); and feature modules for **Conversation** and **Theming**.

## Using the components

Import from the package and the one stylesheet, then pick appearance with props:

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@adea-ai/ui'
import '@adea-ai/ui/globals.css'
import '@adea-ai/ui/fonts.css'

;<Card>
  <CardHeader>
    <CardTitle>Release 0.55.0</CardTitle>
  </CardHeader>
  <CardContent>
    <Badge variant="success">Published</Badge>
    <Button size="sm">View notes</Button>
  </CardContent>
</Card>
```

- One `default` (primary) button per view. Use `ghost` for toolbar and row actions, `outline` on surfaces that already have a fill, and `destructive` only for the action that destroys something.
- Use `Badge` for a non-interactive label and `StatusChip` for a state plus its reason. If it can be clicked, it is a `Button` with `size="2xs"`.
- Use `Switch` for a setting that applies immediately and `Checkbox` for a value applied when a form is submitted.
- Wrap form controls in `Field` so the label, description and error are wired for assistive tech.
- To copy a single component without the package: `bunx shadcn@latest add https://adea-ai.github.io/ui/r/<name>.json`.

## Iconography

- Glyphs come from **lucide-solid**, at the size the control sets (`[&_svg]:size-4` on an `md` button). Never pass a colour; icons inherit `currentColor`.
- Status alerts pick their own glyph from the tone. Don't put a success check on a destructive fill.
- There are no logo files yet, so the name is set in plain type. `WorkspaceMark` and `EntityIcon` draw a monogram for anything without a mark.

## Themes

`@adea-ai/themes` holds 34 OKLCH themes, each with the full set of semantic roles, 16 ANSI colours, a cursor and a selection. This system shows the six **Adea** variants:

- **Adea Light** and **Adea Dark**: the defaults, held to AAA.
- **Colorblind**: GitHub's colorblind hues. `destructive` moves to orange and `success` to blue, so status survives red-green colour blindness.
- **High Contrast**: GitHub's high-contrast palettes, re-greyed.

Switching appearance changes lightness only, so a red is the same red in both appearances of a variant. The rest of the catalogue (Catppuccin, Tokyo Night, Rosé Pine, Gruvbox, Nord, Solarized, Dracula, Kanagawa and others) is held to WCAG AA and swaps in through `ThemeProvider`. Syntax colours are `editor-*` and terminal colours are `terminal-*`.

The user-facing axes all sit on `<html>` and are values on `ThemeProvider`:

| Axis       | Attribute / class        | Values                                                                  |
| ---------- | ------------------------ | ----------------------------------------------------------------------- |
| Appearance | `.dark`                  | light, dark, system                                                     |
| Theme      | variables written inline | any of the 34 catalogue themes                                          |
| Accent     | `data-accent`            | theme (the theme's own primary), violet, blue, green, amber, cyan, pink |
| Typeface   | `data-font`              | Space Grotesk (default), system, geist, geist-mono, jetbrains-mono      |
| Density    | `data-density`           | comfortable (default), compact                                          |

Use `ThemePicker`, `ThemeModeToggle` and `AppearancePanel` to offer them; never write the attributes from a feature.
