import { Polymorphic, type PolymorphicProps } from '@kobalte/core/polymorphic'
import { type ComponentProps, splitProps, type ValidComponent } from 'solid-js'
import { cva, controlInteractive, controlSize, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'

/**
 * Button.
 *
 * One appearance ladder shared by every pressable thing in the system: a
 * button, a toolbar control, a dialog action, and a menu row all draw from the
 * same tokens, so a row of them cannot drift apart.
 *
 * The variants answer "what is this for", never "what colour is it". A caller
 * that wants a red button writes `variant="destructive"`; the red lives here.
 * That is also what lets the design-system linter tell a caller which variant
 * to use instead of only which class was wrong.
 *
 * Polymorphic: pass `as="a"` (or any component) and the button becomes it
 * while keeping the same styling contract. This replaces the React-era
 * `asChild` primitive, which has no Solid equivalent that preserves props.
 */
export const buttonVariants = cva(
  `${controlInteractive} inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap select-none [&_svg]:pointer-events-none [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        /** The one primary action in a view. */
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-surface-hover',
        /** For the action that destroys something. Never the default. */
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive-subtle',
        /** A bordered button for a surface that already has a fill. */
        outline:
          'border border-border bg-transparent text-foreground hover:bg-surface-hover hover:border-input',
        /** No chrome until hover. The default for toolbar and row actions. */
        ghost: 'text-foreground hover:bg-surface-hover',
        /** A tinted primary, for a secondary action inside a primary flow. */
        subtle: 'bg-primary-subtle text-primary hover:bg-primary-subtle/80',
        success: 'bg-success text-success-foreground hover:bg-success/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        '2xs': `${controlSize['2xs']} [&_svg]:size-3`,
        xs: `${controlSize.xs} [&_svg]:size-3.5`,
        sm: `${controlSize.sm} [&_svg]:size-3.5`,
        md: `${controlSize.md} [&_svg]:size-4`,
        lg: `${controlSize.lg} [&_svg]:size-4`,
        xl: `${controlSize.xl} [&_svg]:size-5`,
        /* Square, for an icon with no label. The accessible name then has to
           come from `aria-label` or a visually hidden label — an icon-only
           button with neither is the accessibility finding the Storybook lane
           catches on every story. */
        'icon-2xs': 'size-control-2xs p-0 [&_svg]:size-3',
        'icon-xs': 'size-control-xs p-0 [&_svg]:size-3.5',
        'icon-sm': 'size-control-sm p-0 [&_svg]:size-3.5',
        'icon-md': 'size-control-md p-0 [&_svg]:size-4',
        'icon-lg': 'size-control-lg p-0 [&_svg]:size-4',
        'icon-xl': 'size-control-xl p-0 [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

type ButtonVariantProps = VariantProps<typeof buttonVariants>

export type ButtonProps<T extends ValidComponent = 'button'> = PolymorphicProps<
  T,
  ButtonVariantProps & {
    class?: string
  }
>

export function Button<T extends ValidComponent = 'button'>(props: ButtonProps<T>) {
  const [local, rest] = splitProps(props as ButtonProps, ['variant', 'size', 'class'])

  return (
    <Polymorphic
      as="button"
      type="button"
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...(rest as ComponentProps<'button'>)}
    />
  )
}
