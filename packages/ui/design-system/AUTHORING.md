# Writing a design-system card

The design-system artifact shows one card per component: a live preview and a
guideline page. This folder holds the hand-written half; `scripts/design-system/build.ts`
derives the rest (tokens, bundle, guideline pages, types, fonts) from the source.

## Where things go

| File                             | What                                                           |
| -------------------------------- | -------------------------------------------------------------- |
| `inventory.json`                 | Every `registry:ui` item and the card(s) that show it. Tested. |
| `components/<Card>/preview.html` | The live preview. Required for every card in the inventory.    |
| `components/<Card>/notes.md`     | Optional guidance appended to the generated guideline page.    |
| `components/Cover/preview.html`  | The cover above the brand book (not a component).              |
| `README.md`                      | The brand book: usage rules that name tokens.                  |
| `type.json`                      | The weight and sample for each type rung.                      |

A new component needs an inventory entry and a preview in the same pull request —
`tests/design-system.test.ts` fails otherwise.

## The preview contract

The page renders each preview in a frame that has already loaded `tokens.css` (every
token as a custom property, per theme), the fonts, `bundle.css` and `bundle.js`, and
set `data-theme` on `<html>`. `bundle.js` puts the whole package on `window.AdeaUI`,
plus Solid's `render`, `html`, `h`, `createSignal`, `createMemo`, `For`, `Index`, `Show`,
and a set of lucide-solid glyphs as `AdeaUI.Icons` (see `ICONS` in the build script —
add one there if you need it).

```html
<!-- @dsCard group="Overlays" height=320 -->
<div id="root" style="padding:16px;display:flex;flex-direction:column;gap:12px"></div>
<script>
  const { render, html, Icons, Button, Dialog, DialogTrigger, DialogContent } = window.AdeaUI
  render(
    () => html`
      <${Dialog} defaultOpen=${true}>
        <${DialogTrigger} as=${Button} variant="outline">Open<//>
        <${DialogContent}>…<//>
      <//>
    `,
    document.getElementById('root')
  )
</script>
```

Rules:

- **Line 1 is the marker.** `group` is the inventory's group; `height` is the card's
  row height in px (it grows to fit, but set it close).
- **Render the real component** from `window.AdeaUI`, never a hand-drawn copy. Use the
  props and copy from its `.stories.tsx` — the story is the specification. Show the
  default and the two or three states that matter (an invalid field, an open menu, a
  collapsed rail), not every story.
- **`html` tagged templates, not JSX.** Components are `<${Name} …>…<//>`. Non-string
  props go through `${…}`: `disabled=${true}`, `value=${[40]}`, `onChange=${fn}`. A
  bare `disabled` attribute arrives as `""`, which is falsy. Close plain elements with
  their tag (`</p>`), components with `<//>`.
- **Overlays open by default** (`defaultOpen=${true}` or `open=${true}`) so the card
  shows the surface, not just a trigger. Give the card enough `height` for the
  portal's content.
- **Layout with inline styles** and token variables (`var(--border)`,
  `var(--radius-xl)`, `var(--muted-foreground)`). Tailwind classes only work if the
  package's own source uses them; inline styles always do.
- **No network.** No `fetch`, no remote images (use `AvatarFallback`, an `EntityIcon`,
  or a `data:` URI), no `<iframe>`.
- **Real copy, in the product's voice:** sentence case, short, no lorem ipsum, no emoji.

## Gotchas

Each of these cost a debugging session while the first previews were written.

- **Give every handler a parameter.** In `solid-js/html` templates a zero-argument
  function passed as a component prop is treated as a reactive getter, not a value:
  `onClick=${() => setOpen(true)}` runs during render (and can recurse if it writes a
  signal the render reads). Write `onClick=${(_event) => setOpen(true)}` — the
  parameter is what marks it as a handler.
- **No straight double quotes in template text.** A `"` inside text in an `html`
  template can end an attribute the parser thinks is still open, and the card renders
  garbage or nothing. Use curly quotes (“ ”), or move long copy into a JS constant
  and interpolate it with `${…}`.
- **Leave the formatter off the previews.** `.oxfmtrc.json` ignores
  `packages/ui/design-system/components/**/*.html` because oxfmt rewrites the
  `html` template literals into something the template parser reads differently. Do
  not remove that ignore, and do not run the formatter on a preview by path.
- **Set the card height to cover its content.** Rows on the design-system page use
  `content-visibility: auto`, so anything below the viewport renders blank in a
  screenshot. A card whose content overflows its declared `height` loses the
  overflow in the shot; size the `@dsCard` `height` to the content (portals
  included).
- **Components with no open prop are opened by the preview script.** `AccountMenu`,
  `ContextMenu` and `Menubar` own their open state, so the preview dispatches the
  pointer events a user would (`pointerdown`/`pointerup`/`click`, or `contextmenu`
  for a context menu) after render, then calls `document.activeElement.blur()` so the
  synthetic open does not leave a keyboard focus ring in the card. See their
  `preview.html` for the exact sequence.

## Checking

```sh
bun run --cwd packages/ui build                         # declarations the build reads
bun run --cwd packages/ui design-system:build           # --partial while cards are missing
bun run --cwd apps/storybook test:design-system         # every card, light and dark
bun run --cwd apps/storybook test:design-system --grep Dialog
DESIGN_SYSTEM_SHOTS=1 bun run --cwd apps/storybook test:design-system --grep Dialog
```

The check fails on a thrown error, a console error, or an empty render. With
`DESIGN_SYSTEM_SHOTS=1` it writes `apps/storybook/test-results/design-system/<Card>-<theme>.png`
— look at them; a card that renders but looks wrong is still wrong.

## Publishing

`design-system/out/project/` is the artifact's `project/` folder. Publishing it is one
call from a Claude session to the artifact's URL; see `docs/design-system.md`.
