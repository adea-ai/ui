import { LoaderCircle } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cva, type VariantProps } from '../../../lib/variants'
import { cn } from '../../../lib/utils'

/**
 * Spinner.
 *
 * A determinate-length activity indicator with no progress to report. When
 * there *is* progress, use Progress instead — a spinner next to a known
 * percentage is a lie about what the app knows.
 *
 * The glyph spins continuously, so it is the one thing in the system that
 * keeps moving under `prefers-reduced-motion`; base.css only shortens
 * `animation-duration` for the *entrance* animations and leaves this loop
 * alone. A frozen spinner reads as a hang, which is worse than motion.
 */
const spinnerVariants = cva('animate-spin shrink-0', {
  variants: {
    size: {
      xs: 'size-3',
      sm: 'size-3.5',
      md: 'size-4',
      lg: 'size-5',
      xl: 'size-6',
    },
  },
  defaultVariants: { size: 'md' },
})

type SpinnerVariants = VariantProps<typeof spinnerVariants>

export type SpinnerProps = Omit<ComponentProps<'svg'>, 'size'> &
  SpinnerVariants & {
    /** An accessible name. Defaults to "Loading"; pass `false` to hide it. */
    label?: string | false
  }

export function Spinner(props: SpinnerProps) {
  const [local, rest] = splitProps(props, ['class', 'size', 'label'])

  return (
    <>
      <LoaderCircle
        data-slot="spinner"
        role="status"
        aria-label={local.label === false ? undefined : (local.label ?? 'Loading')}
        aria-hidden={local.label === false ? 'true' : undefined}
        class={cn(spinnerVariants({ size: local.size }), local.class)}
        {...rest}
      />
      {local.label === false ? null : (
        <span class="visually-hidden">{local.label ?? 'Loading'}</span>
      )}
    </>
  )
}
