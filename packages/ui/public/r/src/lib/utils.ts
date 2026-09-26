import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * `twMerge` needs to be told about the utilities this design system adds.
 *
 * Every token-derived utility (`h-control-md`, `w-rail`, `p-control-lg`, …)
 * is an unknown name to a default `tailwind-merge` instance. Left
 * unregistered, `cn('h-control-md', 'h-control-sm')` keeps both classes and
 * the winner is decided by stylesheet order rather than by the caller — a bug
 * that only shows up as a control that ignores its `size` prop, long after the
 * line that caused it was written.
 *
 * Registering the families here is what makes "the last class wins" true for
 * the whole system, including for consumers overriding a component's default.
 */
export const twMergeConfig = extendTailwindMerge<'ds-height' | 'ds-width' | 'ds-size'>({
  extend: {
    classGroups: {
      'ds-height': [
        {
          h: [
            'control-2xs',
            'control-xs',
            'control-sm',
            'control-md',
            'control-lg',
            'control-xl',
            'row-sm',
            'row-md',
            'row-lg',
            'rail-item',
            'topbar',
            'statusbar',
          ],
        },
      ],
      'ds-width': [
        {
          w: ['rail', 'rail-expanded', 'sidebar', 'sidebar-compact'],
        },
      ],
      // `size-*` is a real Tailwind group, but the token-derived values are
      // not, so they need the same treatment as height and width.
      'ds-size': [
        {
          size: [
            'control-2xs',
            'control-xs',
            'control-sm',
            'control-md',
            'control-lg',
            'control-xl',
            'rail-item',
          ],
        },
      ],
    },
  },
})

/**
 * Merge conditional class values, letting the last conflicting utility win.
 *
 * Accepts an object whose keys are classes and whose values enable them, which
 * is the form the design-system linter can read statically:
 *
 *   cn('base', { 'is-open': open(), 'is-disabled': disabled() })
 *
 * A template literal (`cn(`base--${value}`)`) is invisible to the linter and
 * will be reported, because a class the linter cannot read is a class it
 * cannot check against the theme.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMergeConfig(clsx(inputs))
}
