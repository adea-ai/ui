# The design-system artifact

The [Adea UI design system](https://claude.ai/artifact/BRWYnXVxsBF1w98d6M9KWs) is a
published Design System page: the brand book, every token in all six Adea themes, the
type scale with the real font files, and a live card for each of the 95 components —
built from this repository's source, rendering the real SolidJS components.

It is private to its owner until shared from the page's Share menu.

## What builds it

Everything on the page comes from `packages/ui`, through one script:

| Page content                      | Source                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Colours (119 tokens × 6 themes)   | `themeCssVariables` for the Adea family, aliases resolved from `theme.css`; usage from `src/lib/tokens.ts` |
| Spacing, shell, radius, shadow, z | `src/styles/theme.css`                                                                                     |
| Type scale and fonts              | `theme.css` sizes, `design-system/type.json` weights, `@fontsource-variable` files                         |
| Component previews                | `design-system/components/<Card>/preview.html` (hand-written)                                              |
| Component guideline pages         | each component's doc comment, variants and parts, plus optional `notes.md`                                 |
| Types                             | the package's own `.d.ts` output                                                                           |
| Live components                   | the package entry, bundled as one script on `window.AdeaUI`                                                |
| Brand book                        | `design-system/README.md` (hand-written)                                                                   |

`design-system/inventory.json` lists every `registry:ui` item and its card(s), and
`tests/design-system.test.ts` fails if a component has no card or a card has no
preview — so a new component cannot quietly skip the page. Adding a card:
[`packages/ui/design-system/AUTHORING.md`](../packages/ui/design-system/AUTHORING.md).

## Refreshing it

The build is deterministic and runs locally at no cost:

```sh
bun run build                                     # the package and its declarations
bun run --cwd packages/ui design-system:build     # → packages/ui/design-system/out/project
bun run --cwd apps/storybook test:design-system   # every card renders, light and dark
```

Publishing is the only step that needs Claude, because the page is a claude.ai
artifact and has no public upload API. In a Claude Code session in this repository:

> Publish `packages/ui/design-system/out/project` to the design system artifact
> https://claude.ai/artifact/BRWYnXVxsBF1w98d6M9KWs — read its index first, keep
> every key, and set `lastChange`.

That is one read and one publish call — a small, fixed amount of usage, with no
reasoning over the repository. Nothing runs on a schedule and nothing publishes
automatically; refresh when a release is worth showing (after a Release Please
version PR lands is a natural point).

The same session can rebuild first if you ask it to run the three commands above.
