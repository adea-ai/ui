import { ToggleButton } from '@kobalte/core/toggle-button'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cva, controlInteractive, controlSize, type VariantProps } from '../../../lib/variants'
import { cn } from '../../../lib/utils'

/**
 * Toggle.
 *
 * A button that stays pressed. The difference from Button is state, not looks:
 * a Toggle reports `aria-pressed` and holds its pressed appearance until
 * released, which is what makes it right for a formatting control and wrong
 * for a command.
 *
 * Kobalte supplies the pressed state and the keyboard behaviour; the styling
 * adds the one thing a headless primitive cannot know — that a pressed toggle
 * in a toolbar should read as *filled*, not merely outlined.
 */
export const toggleVariants = cva(
  `${controlInteractive} inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap select-none hover:bg-surface-hover hover:text-foreground data-[pressed]:bg-surface-active data-[pressed]:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        /** Sits inside a field or toolbar that already has a fill. */
        outline: 'border border-border bg-transparent',
        /** Filled even when unpressed, for a segmented control's idle item. */
        subtle: 'bg-surface-hover',
      },
      size: {
        '2xs': `${controlSize['2xs']} [&_svg]:size-3`,
        xs: `${controlSize.xs} [&_svg]:size-3.5`,
        sm: `${controlSize.sm} [&_svg]:size-3.5`,
        md: `${controlSize.md} [&_svg]:size-4`,
        lg: `${controlSize.lg} [&_svg]:size-4`,
        xl: `${controlSize.xl} [&_svg]:size-5`,
        'icon-2xs': 'size-control-2xs p-0 [&_svg]:size-3',
        'icon-xs': 'size-control-xs p-0 [&_svg]:size-3.5',
        'icon-sm': 'size-control-sm p-0 [&_svg]:size-3.5',
        'icon-md': 'size-control-md p-0 [&_svg]:size-4',
        'icon-lg': 'size-control-lg p-0 [&_svg]:size-4',
        'icon-xl': 'size-control-xl p-0 [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
)

export type ToggleProps = ComponentProps<typeof ToggleButton> & VariantProps<typeof toggleVariants>

export function Toggle(props: ToggleProps) {
  const [local, rest] = splitProps(props, ['variant', 'size', 'class'])

  return (
    <ToggleButton
      class={cn(toggleVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    />
  )
}
