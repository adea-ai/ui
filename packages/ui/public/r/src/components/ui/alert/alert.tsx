import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { cva, type VariantProps } from '../../../lib/variants'
import { cn } from '../../../lib/utils'

/**
 * Alert.
 *
 * A message about the whole surface it sits in — a form's validation summary,
 * a failed sync banner, a permission notice. It is deliberately not a dialog:
 * an alert that must be dismissed before the user can continue is a Dialog.
 *
 * The glyph follows the tone rather than being passed in, so an alert cannot
 * be given a green checkmark on a destructive fill. A caller that genuinely
 * needs a different icon passes `icon`; `icon={null}` removes it.
 */
const alertVariants = cva(
  'relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 text-sm',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground border-border',
        destructive: 'bg-destructive-subtle text-destructive border-destructive/30',
        success: 'bg-success-subtle text-success border-success/30',
        warning: 'bg-warning-subtle text-warning border-warning/30',
        info: 'bg-info-subtle text-info border-info/30',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

const alertIcons = {
  default: Info,
  destructive: AlertCircle,
  success: CheckCircle2,
  warning: TriangleAlert,
  info: Info,
} as const

type AlertVariantProps = VariantProps<typeof alertVariants>

export type AlertProps = ComponentProps<'div'> &
  AlertVariantProps & {
    /** Replace the tone's glyph with your own element. `null` removes it. */
    icon?: JSX.Element | null
  }

export function Alert(props: AlertProps) {
  const [local, rest] = splitProps(props, ['class', 'variant', 'icon', 'children'])

  const tone = () => local.variant ?? 'default'

  return (
    <div
      data-slot="alert"
      role="alert"
      class={cn(alertVariants({ variant: local.variant }), local.class)}
      {...rest}
    >
      {local.icon === null ? null : (
        <span data-slot="alert-icon" class="row-span-2 pt-0.5 [&_svg]:size-4">
          {local.icon ?? <Dynamic component={alertIcons[tone()]} />}
        </span>
      )}
      {local.children}
    </div>
  )
}

export function AlertTitle(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="alert-title"
      class={cn('col-start-2 font-medium tracking-tight', local.class)}
      {...rest}
    />
  )
}

export function AlertDescription(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="alert-description"
      class={cn('col-start-2 text-sm opacity-90 [&_p]:leading-relaxed', local.class)}
      {...rest}
    />
  )
}

export { alertVariants }
