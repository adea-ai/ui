import { Separator as KobalteSeparator } from '@kobalte/core/separator'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { type ComponentProps, splitProps, type ValidComponent } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * Separator.
 *
 * Renders `role="separator"` with the right orientation, so a screen reader
 * understands it as a boundary rather than as an empty element. A plain
 * `<div>` with a border looks identical and announces nothing.
 */
export type SeparatorProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  {
    class?: string
    /** Draw the line as a dashed rule. For an "or" between alternative paths. */
    variant?: 'solid' | 'dashed'
    orientation?: 'horizontal' | 'vertical'
  }
>

export function Separator<T extends ValidComponent = 'div'>(props: SeparatorProps<T>) {
  const [local, rest] = splitProps(props as SeparatorProps, ['class', 'variant', 'orientation'])

  return (
    <KobalteSeparator
      orientation={local.orientation ?? 'horizontal'}
      class={cn(
        'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        {
          'border-t border-dashed border-border bg-transparent data-[orientation=horizontal]:h-0':
            local.variant === 'dashed',
        },
        local.class
      )}
      {...(rest as ComponentProps<'div'>)}
    />
  )
}
