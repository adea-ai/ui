import { Search } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { ActionButton } from '../../composites/action-button'
import { cn } from '#lib/utils'
import { Spinner } from '../spinner'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './empty'

type EmptyStateSecondaryAction =
  | {
      secondaryAction?: undefined
      secondaryActionLabel?: undefined
      secondaryActionTooltip?: never
    }
  | {
      /** A second, quieter way out beside `action`: "Open settings" next to "Retry". */
      secondaryAction: () => void
      /** Required: there is no sensible default name for an arbitrary second action. */
      secondaryActionLabel: string
      secondaryActionTooltip?: string
    }

export type EmptyStateProps = Omit<ComponentProps<'div'>, 'children' | 'role' | 'aria-live'> &
  EmptyStateSecondaryAction & {
    title: string
    detail: string
    busy?: boolean
    icon?: JSX.Element
    announceAs?: 'alert' | 'status'
    headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
    action?: () => void
    actionLabel?: string
    actionTooltip?: string
  }

/**
 * A semantic empty, loading, or error state built from the shared empty parts.
 *
 * `action` is the primary way forward. `secondaryAction` adds one quieter
 * alternative after it, in a `secondary` button, so the primary stays first in
 * the tab order. Two actions side by side is the limit: a state that needs more
 * should compose the `Empty*` parts directly.
 */
export function EmptyState(props: EmptyStateProps) {
  const [local, rest] = splitProps(props, [
    'title',
    'detail',
    'busy',
    'icon',
    'announceAs',
    'headingLevel',
    'action',
    'actionLabel',
    'actionTooltip',
    'secondaryAction',
    'secondaryActionLabel',
    'secondaryActionTooltip',
    'class',
  ])

  return (
    <Empty
      {...rest}
      class={local.class}
      role={local.announceAs}
      aria-live={local.announceAs === 'status' ? 'polite' : undefined}
      aria-busy={local.busy || undefined}
    >
      <EmptyHeader>
        <Show when={local.busy || local.icon}>
          <EmptyMedia variant="icon">
            {local.busy ? (
              <Spinner label={false} aria-hidden="true" />
            ) : (
              (local.icon ?? <Search aria-hidden="true" />)
            )}
          </EmptyMedia>
        </Show>
        <EmptyTitle role="heading" aria-level={local.headingLevel ?? 1}>
          {local.title}
        </EmptyTitle>
        <EmptyDescription>{local.detail}</EmptyDescription>
      </EmptyHeader>
      <Show when={local.action || local.secondaryAction}>
        <EmptyContent class={cn({ 'flex-row flex-wrap justify-center': !!local.secondaryAction })}>
          <Show when={local.action}>
            <ActionButton
              tooltip={local.actionTooltip ?? local.actionLabel ?? 'Try again'}
              aria-label={local.actionLabel ?? 'Try again'}
              onClick={local.action}
            >
              {local.actionLabel ?? 'Try again'}
            </ActionButton>
          </Show>
          <Show when={local.secondaryAction}>
            <ActionButton
              variant="secondary"
              tooltip={local.secondaryActionTooltip ?? local.secondaryActionLabel}
              aria-label={local.secondaryActionLabel}
              onClick={local.secondaryAction}
            >
              {local.secondaryActionLabel}
            </ActionButton>
          </Show>
        </EmptyContent>
      </Show>
    </Empty>
  )
}
