# Shared Tree and TreeRow

`Tree` supplies the semantic tree container and keyboard navigation for an
ordered, expanded projection. `TreeRow` supplies the treeitem semantics and the
file-row hierarchy of a disclosure marker, leading icon, primary label, and
optional trailing actions. The host owns the projection, stable IDs, expansion
and selection state, mounted virtual window, filesystem actions, and native
services.

The `visibleItems` prop must contain every currently visible item in reading
order, including rows outside the mounted window. Each item has a stable `id`,
`parentId`, one-based `level`, `expandable`, and `expanded` state. Render only the
rows in the current window as `TreeRow` children. Both keyed rows and recycled
window slots are supported; recycled slots must pass their current item
descriptor so the row registry follows an updated identity. Pass the host's
active row as `activeId` and update it synchronously in `onActiveIdChange`. If
the active ID is null or no longer in the projection, the first visible item
becomes the roving stop and the host is notified. When a
keyboard move targets a row outside the window, `onRequestReveal` asks the host
to pin or scroll that row into the mounted range; `Tree` focuses it when its
`TreeRow` registers. The host should keep the active row mounted while the tree
owns focus.

Up and Down wrap through the complete visible projection. Right expands a
collapsed parent and, when it is already open, moves to its first visible child.
Left collapses an open parent or moves to its visible parent. Home and End move
to the first and last visible rows; Enter calls `onActivate`; Space calls
`onSelectItem`. Tree and row callbacks receive stable IDs, while file opening,
selection policy, rename, drag/drop, and service effects remain host decisions.
Action controls rendered in `trailing` remain normal keyboard stops and do not
trigger tree-row activation or tree navigation while focused.

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
