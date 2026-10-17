# Shared Tree and TreeRow

`Tree` supplies the semantic tree container and keyboard navigation for an
ordered, expanded projection. `TreeRow` supplies the treeitem semantics and the
file-row hierarchy of a disclosure marker, leading icon, primary label, and
optional trailing actions. The host owns the projection, stable IDs, expansion
and selection state, mounted virtual window, filesystem actions, and native
services.

The `visibleItems` prop must contain every currently visible item in reading
order, including rows outside the mounted window. A row is visible only when
every one of its ancestors is expanded, so collapsing a row removes its whole
subtree, however deep, and not only its direct children; keep the expansion state
of the hidden folders if re-expanding the ancestor should restore them. Each item has a stable `id`,
`parentId`, one-based `level`, `expandable`, and `expanded` state. Render only the
rows in the current window as `TreeRow` children. Both keyed rows and recycled
window slots are supported; recycled slots must pass their current item
descriptor so the row registry follows an updated identity. Pass the host's
active row as `activeId` and update it synchronously in `onActiveIdChange`. If
the active ID is null or no longer in the projection, the first visible item
becomes the roving stop and the host is notified. When a
keyboard move targets a row outside the window, `onRequestReveal` asks the host
to pin or scroll that row into the mounted range; `Tree` focuses it when its
`TreeRow` registers, unless a control outside the tree has taken focus in the
meantime (see "When a collapse hides the focused row"). The host should keep the active row mounted while the tree
owns focus. `Tree` reports each mounted row's measured border-box block size in
CSS pixels through `onRowSizeChange`, including its initial observation and
later size changes. The host can use these measurements for variable row-height
range calculations; it still owns scroll position, range selection, pinning,
and reveal behavior.

Up and Down wrap through the complete visible projection. Right expands a
collapsed parent and, when it is already open, moves to its first visible child.
Left collapses an open parent or moves to its visible parent. Home and End move
to the first and last visible rows; Enter calls `onActivate`; Space calls
`onSelectItem`. Tree and row callbacks receive stable IDs, while file opening,
selection policy, rename, drag/drop, and service effects remain host decisions.
Action controls rendered in `trailing` remain normal keyboard stops and do not
trigger tree-row activation or tree navigation while focused.

## Disclosure marker

By default the disclosure chevron is decoration: a pointer click anywhere on a
row, the chevron included, calls `onActivate`, which is the file-explorer
convention (the host's `onActivate` toggles a folder). A tree where expanding and
selecting are separate decisions, such as a list of sources that can be opened
without being selected, opts in with `disclosure="marker"` on `Tree`. The prop is
`'row'` (default) or `'marker'`; with it omitted or `'row'` the DOM, classes,
ARIA and behavior are unchanged.

In marker mode the chevron of an expandable row is its own pointer target
(`data-slot="tree-row-disclosure"`):

- A click calls `onExpand(id, !expanded)` and nothing else. It does not call
  `onActivate`, `onDoubleClick` or `onActiveIdChange`, and it does not change
  selection. Rows that cannot expand have no target, so a click on their marker
  slot is an ordinary row click.
- The rest of the row, including the leading icon and label, activates exactly
  as before and never expands. Interactive descendants in `trailing` still do not
  activate the row. A `Switch` whose visual control is a plain element needs a
  `data-tree-keyboard-stop` wrapper, as it does without the prop.
- The chevron does not take focus. Its `mousedown` is cancelled, so pressing it
  does not move focus or the roving stop to its own row, and Left/Right keep
  acting on the row that had them. Pressing a row's chevron is not a way to move
  to it. The one way a press can still move focus is by hiding the focused row,
  which `Tree` then recovers as described under "When a collapse hides the
  focused row".
- The target is 26 CSS pixels wide and the row's full height (a 14px glyph
  widened by a pseudo-element), so it follows row density and stops at the row's
  own padding and gap. A double-click on the chevron is two toggles and does not
  reach `onDoubleClick`.
- Keyboard behavior is identical in both modes. The chevron remains `aria-hidden`,
  unfocusable and outside the tab order; Left/Right expand and collapse, Enter
  calls `onActivate` and Space calls `onSelectItem` without toggling.

## When a collapse hides the focused row

Collapsing a row removes the rows below it from `visibleItems`. If one of them was
the active row, `Tree` behaves the same way in both `disclosure` modes, whether the
collapse came from Left, the marker chevron, or the host (for example from
`onActivate` in the file-explorer convention):

- The first visible row, not the collapsed ancestor, becomes the one roving stop
  (`tabindex="0"`), and `onActiveIdChange` is called with its ID.
- If the removed row held DOM focus, or was the last row the tree saw focused,
  focus moves to that same row. It does not fall to `document.body`, and Up, Down,
  Home, End, Left, Right, Enter and Space act on it from then on.
- If the active row had no DOM focus (a restored or host-set roving stop), only
  the roving stop moves; the tree does not take focus.
- If the focused row stays visible, nothing moves: Left on an open row collapses
  it and leaves focus on it, and a chevron press that hides only other rows
  leaves focus on its row, or on a control outside the tree.
- `Tree` remembers the last row that took focus and forgets it when focus moves to
  an element outside the tree. If a row is hidden while a control outside the tree
  has focus (for example a search field, or after a chevron press), that control
  keeps focus and only the roving stop moves to the first visible row. If focus
  had already fallen to `document.body` when the row went away, or left the tree
  without a target element, the recovery above still applies. This is the same in
  both `disclosure` modes.
- A recovery or keyboard move that is still waiting (queued, or waiting for a
  virtualised row to mount) is a request, not a claim on focus. It is withdrawn as
  soon as focus lands on a control outside the tree, whether or not a row still had
  focus, and ownership is checked again at the moment focus would move. A control
  outside the tree that took focus after the request was made keeps it when the
  row mounts. Focus that is on the body, or still on a row of this tree, does not
  withdraw the request.

The packed browser contract measures 320 CSS-pixel viewport bounds separately
from a 200% root-font-size text-fit stress. The latter checks text and row
geometry at an enlarged root size; it is not browser or operating-system zoom.
Native and browser zoom acceptance remains a separate product-level check.

## Donor provenance and retained seams

The row composition is translated from Terax at
`b02a7dcbfe58d22b2352d9618b8ed3199e317a00`:

- `src/modules/explorer/FileExplorer.tsx` — blob
  `94213b15c939c87605590874bac559f23a032141`.
- `src/modules/explorer/TreeRow.tsx` — blob
  `0719d5db865b89cec7aa565381753ac76e6e4549`.
- Repository license: Apache-2.0; the repository identifies Copyright 2026
  Crynta.

The retained composition is the row's disclosure, file/folder icon, name,
selection and Git/drop state slots, plus its separate pending and status rows
as host-rendered content. The donor row is a React button and imports
Hugeicons, Tauri context/actions, and Terax helpers. It has no treeitem roles,
row focus management, or keyboard handlers. The donor FileExplorer handles
keyboard input on its own focusable container and clamps Up/Down at each end;
the shared behavior uses roving row focus and wraps those keys to satisfy
Adea's open Dev Runtime issue #677. Neither donor keyboard behavior nor native
services are copied into the shared component.

Kobalte `@kobalte/core` 0.13.14 does not publish a Tree component. `Tree`
therefore implements only the missing ARIA tree and row-navigation contract;
its complete projection and all domain state remain controlled by the host.
