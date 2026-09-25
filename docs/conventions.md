# Conventions

The component-authoring rules, and why each one exists. Most are enforced by
`@shadcn/lint` through `.oxlintrc.json`; the rest are enforced by types or by tests.

---

## 1. Never restyle a design-system component

The single most important rule. A design-system component's appearance comes from
its own `variant` and `size` props. `class` on one of them is for **layout**:
margin, width, positioning, grid placement.

```tsx
// Correct: the appearance is a named variant.
<Button variant="destructive" size="sm" class="w-full">Delete</Button>

// Wrong: a colour, a padding and a radius applied from outside.
<Button class="bg-red-600 px-4 rounded-md">Delete</Button>
```

Two reasons, and the second is the one that matters:

1. It keeps the system coherent. A component that can be restyled at every call
   site has no appearance of its own, and twenty call sites will drift.
2. **A variant is discoverable by an agent, a class is not.** `@shadcn/lint` reads
   the `cva` definitions and can tell a caller "use the `destructive` variant". It
   cannot tell them what a class they invented should have been. In a codebase
   written largely by agents, a rule that comes with the fix is worth far more than
   a rule that only rejects.

`no-restyle` runs with `allow: ['layout', 'conventional-*', 'dev-*', ...]`. The
named CSS hooks are the sanctioned escape hatch for a genuine one-off; see
`packages/ui/src/styles/`. Add a hook there rather than restyling a component
inline.

---

## 2. Colour, size, radius, shadow and elevation are tokens

No literal value appears in a component. The rule set:

| Rule                     | Catches                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `no-raw-colors`          | `bg-red-500`, `text-emerald-700`, and undeclared tokens        |
| `no-arbitrary-values`    | `p-[13px]`, `w-[37%]`                                          |
| `no-inline-styles`       | `style={{}}` and `<style>` elements                            |
| `no-unknown-classes`     | `rounded-huge`, `hovr:flex` — a class Tailwind cannot generate |
| `require-static-classes` | `` `bg-${color}` `` — a class the linter cannot read           |

`require-static-classes` is the one that surprises people. The linter has to be able
to read a class to check it against the theme, so a template literal is not a style
preference — it is a class that all the other rules become blind to. Use `cn`'s
object form:

```tsx
// Readable by the linter.
cn('base', { 'is-open': open(), 'is-disabled': disabled() })
// Invisible to every rule above.
`base ${open() ? 'is-open' : ''}`
```

Colours come from `theme.css`, declared as `--color-*` in the `@theme inline` block
before use. Even `white` and `black` go through the scrim tokens
(`bg-scrim/*`, `text-scrim-foreground`, `border-scrim-edge`), which are
theme-invariant on purpose rather than free-form.

---

## 3. Behaviour comes from a primitive

Kobalte (`@kobalte/core`) and corvu (`@corvu/*`) supply the accessible behaviour:
focus traps, arrow keys, typeahead, `aria-activedescendant`, roving tabindex, focus
restoration, drag physics. `no-restricted-imports` blocks React, Radix, Ark, Zag,
Base UI and friends — they will not run in a Solid codebase.

Where a primitive lacks coverage, the component implements it, and its doc comment
says so and explains what was done instead. That is the only case where a
hand-rolled control is correct, and the comment is what makes it reviewable.

```tsx
/**
 * SideRailItem.
 *
 * The row *is* the tooltip trigger — not a wrapper around it. That is forced by
 * the platform rather than chosen: `pointerenter` and `focus` do not bubble, so a
 * trigger element wrapping the real row would never see either.
 */
```

---

## 4. The shared ladders

Components do not invent sizes. Two ladders cover the system:

**Control sizes** — `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, in `controlSize` from
`#lib/variants`. Every pressable and editable thing steps through them, so a Button
and a Select at the same size are the same height.

**Icon sizes** — the same rungs prefixed `icon-`, which are the height with an equal
width. An icon button in a toolbar lines up with the text buttons beside it because
it is the same rung, not because two authors agreed on a class.

A component that needs a size outside the ladder is usually two components. If it
genuinely needs one, the rung goes in `theme.css` and in `src/lib/tokens.ts`.

---

## 5. Folder per component

```
src/components/<layer>/<name>/
  <name>.tsx           implementation
  <name>.stories.tsx   the specification
  <name>.mdx           optional long-form reasoning
  index.ts             the public surface
```

`index.ts` exports everything public, including the `cva` variants — a caller
composing a trigger with a Kobalte `as` prop needs them. Anything not exported from
`index.ts` is private to the folder.

The three layers:

| Layer        | What it is                           | Examples                                     |
| ------------ | ------------------------------------ | -------------------------------------------- |
| `ui`         | A primitive you theme with variants. | `button`, `select`, `dialog`, `table`        |
| `layout`     | A region of the window.              | `app-shell`, `side-rail`, `top-bar`, `panel` |
| `composites` | An opinionated assembly of both.     | `settings`, `stat`, `list-row`               |

The layer is a reading aid: it tells you what kind of thing you are importing
before you open it.

---

## 6. Comment the decision, not the code

A comment earns its place by recording a constraint a reader could not derive from
the code. Anything else is noise that will be stale within a release.

```tsx
// Noise: restates the line.
// Set the radius token.

// Worth keeping: records a constraint and a consequence.
// The light theme's `--card` and `--background` are both white, so a borderless
// card there is invisible. That is why the border is structural.
```

The doc comment at the top of a component should say what it is _for_ and when to
reach for a different one. `Select` versus `Combobox` versus `RadioGroup`, `Switch`
versus `Checkbox`, `Dialog` versus `Sheet` versus `Drawer` — those choices are where
a reader gets stuck, and they are what the comment is for.

---

## 7. Icons

`lucide-solid`, sized by the component's own `size` rung through a
`[&_svg]:size-*` selector. A caller never sets an icon's size.

Every icon-only control needs an accessible name — `aria-label`, or a visually
hidden span when the label is also visible elsewhere:

```tsx
<Button size="icon-sm" aria-label="More actions">
  <MoreHorizontal />
</Button>
```

This is the finding the accessibility lane catches most often, and it is a real
defect: an icon with no name is unreachable by a screen reader and by voice control.

---

## 8. Overlays name a rung

Overlays stack on `--z-drawer` / `--z-dialog` / `--z-menu` / `--z-tooltip` /
`--z-toast`, referenced as `z-(--z-dialog)`. A one-off `z-[120]` is how two overlays
end up fighting, and the failure only reproduces when both happen to be open.

The order encodes containment: a menu is above a dialog because a dialog can contain
a menu; a tooltip is above a menu because a menu item can carry one; a toast is above
everything, so a notification is never hidden by a dialog the user just opened.

---

## 9. Stories are the specification

A story that only proves a component renders is not a specification, and it will not
catch the regression it exists for. Prefer the awkward states:

- A checkbox in its indeterminate state, not just checked and unchecked.
- A field that is invalid, with the message wired through `aria-describedby`.
- A rail collapsed, and a tooltip on one of its rows.
- A table with more columns than the pane can show.
- A menu with a submenu, and a dialog containing a menu.

The story's comments explain the _decision_ the story demonstrates. That is where a
reviewer learns why the component behaves as it does, and it is why the doc comment
and the story are both required.

---

## 10. The registry is derived, never hand-edited

`registry.json` and `public/r/*.json` are generated by `bun run registry:build` from
the source tree. Item files, npm dependencies and cross-component dependencies are
all read from the code.

That makes "the registry is complete and current" a checkable property:
`bun run registry:validate` and `tests/registry.test.ts` fail if a component is
exported but absent from the registry, if an item names a file that does not exist,
if an item needs a package the manifest does not declare, or if the committed
catalogue no longer matches the source.

After adding or moving a component, run `bun run registry:build` and commit the
result.
