import { Progress as KobalteProgress } from '@kobalte/core/progress'
import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Progress.
 *
 * A determinate bar. Kobalte publishes the value as `aria-valuenow`, so a
 * screen reader reports the percentage instead of just "progress bar" — which
 * is why a caller must pass a real `value`, or use Spinner when there is none.
 *
 * `indeterminate` renders the sweeping bar for an operation that reports no
 * progress at all. It is a visibly different treatment so the two states are
 * never confused by someone glancing at the screen.
 */
export type ProgressProps = ComponentProps<typeof KobalteProgress> & {
  trackClass?: string
  indicatorClass?: string
  /** Hide the numeric readout that otherwise sits beside the track. */
  hideValue?: boolean
}

export function Progress(props: ProgressProps) {
  const [local, rest] = splitProps(props, ['class', 'trackClass', 'indicatorClass', 'hideValue'])

  return (
    <KobalteProgress class={cn('flex w-full flex-col gap-1.5', local.class)} {...rest}>
      <div class="flex items-center justify-between gap-3">
        <KobalteProgress.Label class="text-muted-foreground text-sm" />
        <Show when={!local.hideValue}>
          <KobalteProgress.ValueLabel class="text-muted-foreground text-sm tabular-nums" />
        </Show>
      </div>
      <KobalteProgress.Track
        class={cn('bg-input relative h-1.5 w-full overflow-hidden rounded-full', local.trackClass)}
      >
        <KobalteProgress.Fill
          class={cn(
            'bg-primary h-full rounded-full',
            {
              'animate-indeterminate w-1/4': props.indeterminate,
              'w-(--kb-progress-fill-width)': !props.indeterminate,
            },
            local.indicatorClass
          )}
        />
      </KobalteProgress.Track>
    </KobalteProgress>
  )
}
