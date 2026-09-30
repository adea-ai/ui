import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * A keyboard-first link to the main content region.
 *
 * Place it before the shell's navigation and set the destination element's
 * `id` to match `href`. The link stays translated above the viewport until it
 * receives focus, then moves into view. Its text remains available to assistive
 * technology while it is visually hidden.
 */
export function SkipLink(props: ComponentProps<'a'>) {
  const [local, rest] = splitProps(props, ['class', 'children', 'href', 'tabIndex'])

  return (
    <a
      data-slot="skip-link"
      class={cn(
        'fixed top-0 start-2 z-(--z-toast) -translate-y-full',
        'inline-flex items-center rounded-md border border-border bg-background',
        'px-control-md py-2 text-sm font-medium text-foreground shadow-lg',
        'underline decoration-2 underline-offset-2 outline-none transition-transform duration-150',
        'focus:translate-y-0 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'motion-reduce:transition-none',
        local.class
      )}
      href={local.href ?? '#main-content'}
      tabIndex={local.tabIndex ?? 0}
      {...rest}
    >
      {local.children === undefined ? 'Skip to main content' : local.children}
    </a>
  )
}
