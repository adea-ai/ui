import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Skeleton.
 *
 * A placeholder that stands in for content whose shape is already known. It
 * carries `aria-hidden` and no text, because the loading state is announced by
 * the region that owns it — a skeleton that says "loading" would announce it
 * once per bar.
 *
 * The shimmer is a background animation rather than a moving gradient element
 * so it costs one paint and no layout, and it stops under `prefers-reduced-motion`
 * (base.css).
 */
export function Skeleton(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      class={cn('bg-muted animate-shimmer rounded-md', local.class)}
      {...rest}
    />
  )
}
