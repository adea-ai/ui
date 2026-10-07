import type { ConfigExtension } from 'cn/config'

/**
 * Runtime class groups used by the design system. `build-cn-tables.ts` passes
 * this extension to `cn build` in full mode so runtime classes from consumers
 * remain supported even when they do not appear in this package's sources.
 *
 * The token utilities extend Tailwind's **own** groups rather than sitting in
 * groups of their own. A separate group conflicts only with itself, so
 * `cn('h-control-sm', 'h-auto')` used to keep both classes and let stylesheet
 * order pick the winner — a caller's `h-auto` lost to the control height, and
 * `p-0` lost to `px-control-sm`, because `h-auto` and `p-0` live in Tailwind's
 * `h` and `p` groups and nothing linked the two. Registered inside `h`, `w`,
 * `size` and the spacing scale, they inherit every conflict those groups already
 * declare (`size` against `w` and `h`, `p` against `px`, and so on).
 */
const controlRungs = [
  'control-2xs',
  'control-xs',
  'control-sm',
  'control-md',
  'control-lg',
  'control-xl',
  'control-2xl',
]

/** `--height-*` tokens in `theme.css`. */
const heights = [...controlRungs, 'row-sm', 'row-md', 'row-lg', 'rail-item', 'topbar', 'statusbar']

/** `--width-*` tokens in `theme.css`. */
const widths = ['rail', 'rail-expanded', 'sidebar', 'sidebar-compact', 'panel']

/** `--size-*` tokens in `theme.css`. */
const sizes = [...controlRungs, 'rail-item']

const cnConfig = {
  extend: {
    theme: {
      // `--spacing-control-*`: Tailwind derives every spacing utility from it
      // (`px-control-sm`, `gap-control-md`, …), so it joins the spacing scale.
      spacing: controlRungs,
    },
    classGroups: {
      h: [{ h: heights }],
      'min-h': [{ 'min-h': heights }],
      'max-h': [{ 'max-h': heights }],
      w: [{ w: widths }],
      'min-w': [{ 'min-w': widths }],
      'max-w': [{ 'max-w': widths }],
      size: [{ size: sizes }],
    },
  },
} satisfies ConfigExtension

export default cnConfig
