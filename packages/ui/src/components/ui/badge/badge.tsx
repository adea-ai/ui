import { Polymorphic, type PolymorphicProps } from '@kobalte/core/polymorphic'
import { type ComponentProps, splitProps, type ValidComponent } from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'

/**
 * Badge.
 *
 * A short, non-interactive status label. If it can be clicked it is a Button
 * with `size="2xs"`, not a Badge — the difference matters because a Badge
 * carries no focus or pressed state and must never be the only way to reach an
 * action.
 */
export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent font-medium transition-colors [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        /**
         * Tinted status fills, for counts and states rather than actions. The
         * word stays in `foreground` for contrast; the glyph takes the status
         * hue, so tags of different tones read apart at a glance.
         */
        success: 'bg-success-subtle text-foreground [&_svg]:text-success',
        warning: 'bg-warning-subtle text-foreground [&_svg]:text-warning',
        destructive: 'bg-destructive-subtle text-foreground [&_svg]:text-destructive',
        info: 'bg-info-subtle text-foreground [&_svg]:text-info',
        subtle: 'bg-primary-subtle text-primary',
        /**
         * A count that asks for attention, pinned to a corner of another control
         * (a workspace mark, a rail icon). At `sm` it is a 2xs label on whatever
         * surface sits behind the corner, where the destructive tint all but
         * disappears — so it takes the solid, contrast-measured action fill.
         */
        notification: 'bg-destructive-action text-destructive-action-foreground',
      },
      size: {
        sm: 'h-4 px-1.5 text-2xs',
        md: 'h-5 px-2 text-xs',
        lg: 'h-6 px-2.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

type BadgeVariantProps = VariantProps<typeof badgeVariants>

export type BadgeProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  BadgeVariantProps & { class?: string }
>

export function Badge<T extends ValidComponent = 'span'>(props: BadgeProps<T>) {
  const [local, rest] = splitProps(props as BadgeProps, ['variant', 'size', 'class'])

  return (
    <Polymorphic
      as="span"
      data-slot="badge"
      class={cn(badgeVariants({ variant: local.variant, size: local.size }), local.class)}
      {...(rest as ComponentProps<'span'>)}
    />
  )
}
