/**
 * The component variant vocabulary.
 *
 * Every component's appearance is declared with `cva`, and `@shadcn/lint`
 * reads those definitions: it is how the linter can tell a caller "use the
 * `destructive` variant" instead of only "this class is not allowed here".
 * That is the whole reason variants live in the open rather than in a
 * component's head.
 *
 * Three axes recur across the system, and components must reuse these names
 * rather than inventing synonyms:
 *
 *   variant  what the control *is for*  — primary, secondary, destructive, …
 *   size     how much room it takes     — 2xs, xs, sm, md, lg, xl
 *   tone     what it *communicates*     — neutral, success, warning, …
 *
 * A component that needs a fourth axis is usually two components.
 */
export { cva, type VariantProps } from 'class-variance-authority'

/**
 * The shared control-size ladder, in Tailwind height utilities.
 *
 * Spread into a `size` axis so every interactive control in the system steps
 * through the same heights. A button and a select at `size="sm"` are both 28px
 * because they read the same token, not because two authors agreed.
 */
export const controlSize = {
  '2xs': 'h-control-2xs px-control-2xs text-2xs gap-1',
  xs: 'h-control-xs px-control-xs text-xs gap-1',
  sm: 'h-control-sm px-control-sm text-xs gap-1.5',
  md: 'h-control-md px-control-md text-sm gap-2',
  lg: 'h-control-lg px-control-lg text-sm gap-2',
  xl: 'h-control-xl px-control-xl text-base gap-2.5',
} as const

/** Square counterparts for icon-only controls: the height, with equal width. */
export const controlSizeIcon = {
  '2xs': 'size-control-2xs p-0',
  xs: 'size-control-xs p-0',
  sm: 'size-control-sm p-0',
  md: 'size-control-md p-0',
  lg: 'size-control-lg p-0',
  xl: 'size-control-xl p-0',
} as const

export const controlSizes = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl'] as const
export type ControlSize = (typeof controlSizes)[number]

/**
 * The tactile half of every interactive control.
 *
 * Kept in one place so hover, active, focus and disabled read identically on a
 * button, a toggle, a menu row and a tab. The `active:` step is only one
 * lightness rung below hover — enough to feel pressed, not enough to look like
 * a different state.
 */
export const controlInteractive =
  'transition-colors ease-out outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50'

/** The shared focus treatment for surfaces that are not focusable controls. */
export const surfaceInteractive = 'transition-colors ease-out outline-none'
