# Design language

Where the look comes from, and what a component author needs to know about it.

The visual language is **substantially translated and modified from
[KiroCrew](https://github.com/kirodotdev/KiroCrew)** (Apache-2.0). Of the donor
projects surveyed, its interface was the most coherent and the most usable, so it
is the reference rather than a starting point. The translation is total: KiroCrew is
React with a large bespoke stylesheet; this is Solid on Kobalte and corvu, styled
through shadcn's semantic token vocabulary in OKLCH. No source file is copied.

The architecture — one folder per component, a registry build, higher-level blocks
composed on an unmodified primitive layer — follows the
[shadcn-storybook-template](https://github.com/toolbeltross/shadcn-storybook-template)
(MIT), [Kibo UI](https://github.com/kibo-ui/kibo-ui) (MIT) and
[Dice UI](https://github.com/sadmann7/diceui) (MIT). [Origin
UI](https://github.com/origin-space/originui) (AGPL-3.0-or-later) was consulted for
visual ideas only; no code from it is reproduced, because its licence is
incompatible with this distribution.

---

## The three-part identity

What makes an interface recognisably _this_ system, rather than a themed shadcn
default, is three decisions. Everything else follows from them.

### 1. A neutral ladder, with the accent as a separate axis

The neutrals are adea's own palette and they are **pure grey** — hue 0, zero chroma.
That is the opposite of the earlier blue-tinted ladder this document used to
describe, and it is deliberate: a tinted neutral fights every third-party palette in
the catalogue, and a neutral that has to be re-solved for each theme is not a
neutral. On a large dark surface the separation comes from the surface ladder and
the elevation tokens instead, which is where it belongs.

Colour is carried by **two roles and nothing else**:

- The **accent axis** — seven presets, applied as `data-accent` on the same element
  that carries the theme. It re-colours the primary, its label, the hover rung, the
  tint and the focus ring. The default (`theme`) uses the variant's own primary,
  which in adea's palette is neutral, so the interface stays monochrome unless the
  user asks otherwise.
- The **status roles** — `success`, `warning`, `destructive`, `info` — which mean
  something and are never decorative.

That split is what lets a theme be anyone's palette without giving up the accent the
user chose, and an accent be any of seven without the theme having to know about it.
A fifth colour on a surface would make the primary stop meaning "this is the thing to
press", which is still the rule.

### 2. Dark-first

The dark theme is the one the language was drawn against, and it is the default in
Storybook. This is a consequence of the product: both applications are tools used
for long sessions, and a bright surface is tiring for that. The light theme is a
full peer — it has its own solved values rather than an inversion — but it is the
variant.

One visible consequence: **the accent flips polarity between themes.** Violet in dark
is `oklch(0.709 0.1592 293.5)` and carries a _black_ label; in light it is
`oklch(0.4907 0.2412 292.6)` and carries a _white_ one. That is why
`--primary-foreground` is a token and why a component must never hard-code a label
colour on a primary surface.

### 3. Compact density

14px is the interface default, not 16px, and the two control heights that carry the
product are **28px** (toolbars) and **32px** (forms). This is a deliberate choice
for a desktop tool used for hours: the extra rows on screen are worth more than the
extra legibility of 16px, and the type scale compensates by giving small sizes more
leading.

A component that quietly sets a 16px body or a 40px control will look wrong next to
one that does not — which is why heights and type sizes are tokens rather than
classes a caller can choose freely.

---

## The surface ladder

Five rungs, in painting order. Naming them is what keeps two applications'
sidebars from drifting a shade apart.

| Rung    | Token              | What sits on it                                                     |
| ------- | ------------------ | ------------------------------------------------------------------- |
| Sunken  | `--surface-sunken` | Code wells, inset lists, empty states — content that recedes.       |
| Canvas  | `--background`     | The page. Almost everything is drawn on this.                       |
| Raised  | `--card`           | A card or panel that sits _on_ the canvas. Always carries a border. |
| Overlay | `--popover`        | A floating surface: dialog, menu, popover.                          |
| Chrome  | `--chrome`         | The top bar and rail, tinted against the canvas.                    |

Two more fills are painted _onto_ a surface rather than being surfaces:
`--surface-hover` and `--surface-active`. They are solid in the neutral family and
translucent in the status family, because a hover fill has to work over whatever is
beneath it while a status tint has to keep its meaning.

**A card always carries its own edge.** In the light theme `--card` and
`--background` are both white, so a borderless card there is invisible. Making the
border structural rather than optional is what stops one app's cards from reading as
floating panels and another's as nothing at all.

---

## Typography

**Space Grotesk** is the interface face and the one the visual language was drawn
against, with **JetBrains Mono** for anything a user compares character by character —
code, terminals, ids, file paths. Both ship as variable fonts from
`@fontsource-variable`, so a desktop app never fetches a font at runtime and never
reflows after first paint.

The face is a **user preference**, though, and the axis has five options: Space
Grotesk, System, Geist, Geist Mono and JetBrains Mono. `--font-sans` and `--font-mono`
resolve from a selection rather than naming a face directly, which is what makes this
a preference instead of a hard-coded choice an application cannot override without
restating the stacks.

Two of those options put a monospace face in the _interface_ role, and that needs
compensating: mono is roughly 20% wider than Space Grotesk at the same size, and every
measurement in this system — control heights, the rail's label budget, a button's
padding — was taken against a proportional face. So `--ui-tracking` and
`--ui-word-spacing` tighten in those two variants and stay `normal` everywhere else.
The two families want opposite treatment: mono's space character is a full
advance-width cell, three times Space Grotesk's, so a two-word label reads as two
floating words without negative word spacing, while its glyphs carry more sidebearing
and tolerate a tighter track.

Eight rungs, each with its own line-height because the ratio is not constant:

| Token       | Size | Leading | Use                                             |
| ----------- | ---- | ------- | ----------------------------------------------- |
| `text-3xl`  | 30px | 1.2     | An empty-state headline. Once per app, at most. |
| `text-2xl`  | 24px | 1.25    | A display figure — a stat, a count.             |
| `text-xl`   | 20px | 1.35    | A page title.                                   |
| `text-lg`   | 18px | 1.4     | A section heading inside a page.                |
| `text-base` | 16px | 1.5     | Card and dialog titles.                         |
| `text-sm`   | 14px | 1.55    | **The default.** Body copy, labels, controls.   |
| `text-xs`   | 12px | 1.5     | Metadata, badges, secondary rows.               |
| `text-2xs`  | 11px | 1.45    | The floor: keyboard keys, the status bar.       |

Weights stop at 600. On a dark surface a bold word blooms, and with a variable face
the step from 500 to 600 is already a clear one — 700 buys attention by making the
text harder to read.

---

## Colour is measured, not reviewed

Every text pairing the system renders is asserted in
`packages/ui/tests/tokens.test.ts`, in both the default themes, against the surface the
text actually sits on. Body text must clear **7:1**; secondary text, labels on filled
buttons and the focus ring must clear **4.5:1** (or **3:1** for the ring, which is a
non-text indicator).

The other 25 variants in the catalogue are held to a **different and lower floor**, and
the difference is deliberate rather than an oversight: a third-party palette is somebody
else's solved set, and re-solving it to 7:1 would stop it being that palette.

Those floors live in [`@adea-ai/themes`](https://github.com/adea-ai/themes), which
normalizes the upstream palettes and runs **WCAG AA** over every one of them — 4.5:1 for
text, 3:1 for the ring — so an imported theme is _measured_ rather than assumed. At least
one of them would have failed on its own published values: Solarized Light's body text
measures 4.28:1 against its own background, and the catalogue raises its lightness rather
than shipping a theme that fails the standard.

The token values were _solved_ for those floors rather than chosen and checked. The
comments in `theme.css` record which surface fixed each number — for
`--muted-foreground` in the light theme it is the sidebar, which is the tightest of
the three surfaces that text lands on.

This is why the values are odd-looking numbers rather than round ones, and why
adjusting one by eye will fail a test rather than pass review.

---

## Motion

Three durations and two curves, on purpose. Motion in an application is feedback, not
decoration: a user should never be waiting for an animation.

- **`duration-fast` (120ms)** — a state change the user is already watching. Hover,
  press, toggle. Felt rather than seen.
- **`duration-normal` (200ms)** — an arrival. An entrance, a disclosure.
- **`duration-slow` (320ms)** — a layout settle.

`ease-out` is `cubic-bezier(0.16, 1, 0.3, 1)`: a fast start and a long settle, which
reads as decisive. Floaty motion in a tool feels like latency. `ease-in-out` is
`cubic-bezier(0.65, 0, 0.35, 1)`, and it exists for a loop with no start or end — a
shimmer, a skeleton — where a curve with a direction would read as a stutter.

What may move, and what may not:

- **May:** colour and opacity on state changes; transform on an entrance, directed
  by where the surface is anchored; height on a disclosure, measured from the
  content.
- **May not:** anything on hover that changes an element's size or position — the
  pointer is in the middle of a click; a loading state on an instant change; and
  anything at all under `prefers-reduced-motion`, except the spinner.

The spinner is the single exception. A frozen spinner reads as a hang, which is
worse for exactly the people who asked for less motion.

---

## Accessibility is structural

Not a pass at the end. The decisions that make the biggest difference are all
structural, and they are baked into the components rather than documented as
guidance:

- **Behaviour comes from Kobalte and corvu.** Focus trapping, arrow keys, typeahead,
  `aria-activedescendant`, roving tabindex, focus restoration. A hand-rolled version
  of any of these is a regression with better styling.
- **The label is never deleted, only moved.** A collapsed rail's label becomes a
  tooltip _and_ a visually hidden span. An icon-only navigation with no accessible
  names is the most common failure in desktop application chrome.
- **Every interaction is reachable twice.** A hover card's content is also behind a
  click; a context menu's actions also appear in a dropdown on the same row. Hover
  and right-click are unavailable on some inputs and undiscoverable on others.
- **`aria-invalid` carries the state, the border only paints it.** A red outline is
  invisible to a screen reader and to anyone who cannot distinguish the hue.
- **The focus ring is never suppressed.** It is the only keyboard affordance in the
  system.
- **Reduced motion, reduced transparency and increased contrast are all honoured**,
  in `base.css`, and the glass surfaces fall back to a solid fill on an engine
  without `backdrop-filter`.

Accessibility violations fail the story they appear in. See
`apps/storybook/tests/a11y.spec.ts` for the headless lane.
