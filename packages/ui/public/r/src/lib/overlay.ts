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

import { cva, type VariantProps } from './variants'

/** The panel itself: fill, hairline edge, radius, elevation. Menus, popovers
 * and the command palette float on the elevated overlay rung (`--popover`). */
export const overlaySurface =
  'bg-popover text-popover-foreground rounded-xl border border-border shadow-lg'

/**
 * The modal panel: the same hairline edge, radius and elevation, painted on the
 * *neutral* theme surface instead of the elevated overlay rung.
 *
 * `--popover` is the catalogue's `surfaceElevated`, whose derivation amplifies
 * the canvas hue's chroma on the elevated step. On the dark default's violet
 * canvas that makes the dialog the most chromatic surface in the ladder —
 * `oklch(0.2406 0.0088 300.91)`, red above green in sRGB — and on a full dialog
 * panel that cast reads as a warm tint the canvas never has. shadcn's own
 * convention already splits the two: a Dialog paints `bg-background`, menus and
 * popovers paint `bg-popover`. The veil, the hairline and the elevation shadow
 * carry the separation the lighter fill no longer provides.
 */
export const dialogSurface =
  'bg-background text-foreground rounded-xl border border-border shadow-lg'

/**
 * Overlay titles have one fixed typography role. Keep this small recipe shared
 * without loading the configurable Heading component into every dialog.
 */
export const overlayTitle = 'font-semibold text-base tracking-tight leading-none'

/** The span of the portal wrapper that centres a dialog-like overlay. */
export const overlayPositioner = 'fixed inset-0 z-(--z-dialog) grid place-items-center p-4'

/** The dimming layer behind a modal overlay. */
export const overlayScrim =
  'fixed inset-0 z-(--z-dialog) bg-scrim/50 supports-[backdrop-filter]:backdrop-blur-xs'

/**
 * The tip: the card-toned bubble an explanation shows in. The side rail draws
 * it flush to a collapsed row and every floating tooltip composes the same
 * fill, edge, and type, so a control never explains itself in two visual
 * languages.
 */
export const tooltipTip =
  'bg-card text-card-foreground rounded-md border border-border text-sm font-medium shadow-lg'

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
  'data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground',
  '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
  '[&_svg:not([class*=text-])]:text-muted-foreground',
].join(' ')

/** A destructive action keeps readable text and marks its row with a status edge. */
export const destructiveMenuItem =
  'border-s-2 border-destructive ps-1.5 text-foreground data-[highlighted]:bg-destructive-subtle'

/** The label above a group of menu rows. */
export const menuLabel =
  'px-2 py-1.5 text-2xs font-medium tracking-wide text-muted-foreground uppercase'

/** The rule between menu groups. */
export const menuSeparator = 'bg-border -mx-1 my-1 h-px'

/**
 * A leading colour swatch on a menu or select row: the sanctioned way to carry
 * a card-tone colour into a list of options. The tones are the system's accent
 * and status roles — the vocabulary a Badge already speaks — so the colour an
 * option shows in a menu is the colour its badge carries on a card, and a
 * caller never passes a raw colour into a list. The dot is `aria-hidden`; the
 * label carries the meaning, so a tone is never the only signal.
 */
export const menuSwatchTone = cva('size-2 shrink-0 rounded-full', {
  variants: {
    tone: {
      neutral: 'bg-muted-foreground',
      primary: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      destructive: 'bg-destructive',
      info: 'bg-info',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

/** The tones a menu row's swatch can take. */
export type MenuSwatchTone = NonNullable<VariantProps<typeof menuSwatchTone>['tone']>

/** Padding shared by every menu-list surface. */
export const menuContentPadding = 'p-1'

/**
 * Marks a floating layer — a menu, a listbox, a popover — as part of the top
 * layer.
 *
 * A modal dialog hides everything outside itself from assistive technology
 * (`aria-hidden` on its siblings) and keeps watching `<body>` for new nodes.
 * A menu or select opened from inside the dialog portals to `<body>`, so the
 * dialog hid it too: the list was on screen, focused, and invisible to a
 * screen reader, and an outside-click check could treat a click on it as a
 * click away from the dialog. Kobalte exempts nodes carrying this attribute
 * from both, so every floating layer carries it.
 */
export const topLayerProps = { 'data-kb-top-layer': '' } as const
