/**
 * Shared strings for the overlay layer: dialogs, sheets, menus, popovers,
 * tooltips and the command palette.
 *
 * These live here rather than in each component because the overlay family is
 * where consistency is most visible and least likely to survive duplication.
 * A dialog, a sheet and a dropdown that disagree about their border, radius,
 * motion or shadow read as three different apps — and an app that adopts this
 * library would inherit all three. Declaring the surface once is what makes
 * "an overlay looks like this" a fact rather than a convention.
 */

/** The panel itself: fill, hairline edge, radius, elevation. */
export const overlaySurface =
  'bg-popover text-popover-foreground rounded-xl border border-border shadow-lg'

/** The span of the portal wrapper that centres a dialog-like overlay. */
export const overlayPositioner = 'fixed inset-0 z-(--z-dialog) grid place-items-center p-4'

/** The dimming layer behind a modal overlay. */
export const overlayScrim =
  'fixed inset-0 z-(--z-dialog) bg-scrim/50 supports-[backdrop-filter]:backdrop-blur-xs'

/**
 * Entrance and exit motion, expressed as data-state classes.
 *
 * `data-expanded` / `data-closed` are Kobalte's; `data-side-*` come from its
 * popper positioning and let a menu slide in from the edge it is anchored to,
 * which is what makes a dropdown feel attached to its trigger rather than
 * dropped on the screen. Exit motion is shorter than entry, because a
 * dismissal should feel immediate while an arrival benefits from being seen.
 */
export const overlayMotion = [
  'data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95',
  'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
  'data-expanded:duration-200 data-closed:duration-150',
].join(' ')

/** Popover-style motion: no zoom, so a panel anchored to a control does not
 * appear to breathe away from it. */
export const popoverMotion = [
  'data-expanded:animate-in data-expanded:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
  'data-expanded:duration-150 data-closed:duration-100',
].join(' ')

/** The popper arrow. Sized in the component; coloured here. */
export const popoverArrow = 'fill-popover stroke-border'

/**
 * A menu row: the shared height, radius, hover fill and focus treatment for
 * every item inside a menu, listbox or command list.
 */
export const menuItem = [
  'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none',
  'transition-colors ease-out',
  'data-[highlighted]:bg-surface-hover data-[highlighted]:text-foreground',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
  '[&_svg:not([class*=text-])]:text-muted-foreground',
].join(' ')

/** The label above a group of menu rows. */
export const menuLabel =
  'px-2 py-1.5 text-2xs font-medium tracking-wide text-muted-foreground uppercase'

/** The rule between menu groups. */
export const menuSeparator = 'bg-border -mx-1 my-1 h-px'

/** Padding shared by every menu-list surface. */
export const menuContentPadding = 'p-1'
