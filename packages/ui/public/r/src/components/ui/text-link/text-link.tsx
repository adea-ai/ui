import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * TextLink.
 *
 * An inline, underlined link for prose and content navigation. Use ActionButton
 * or ListRow when the link is a compact action or a row-sized target.
 */
export function TextLink(props: ComponentProps<'a'>) {
  const [local, rest] = splitProps(props, ['class', 'tabIndex'])

  return (
    <a
      data-slot="textlink"
      class={cn(
        'rounded-sm text-foreground underline decoration-primary underline-offset-4',
        'transition-colors ease-out hover:decoration-foreground outline-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'motion-reduce:transition-none',
        local.class
      )}
      tabIndex={local.tabIndex ?? 0}
      {...rest}
    />
  )
}
