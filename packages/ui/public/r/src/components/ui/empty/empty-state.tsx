import { Search } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { ActionButton } from '../../composites/action-button'
import { Spinner } from '../spinner'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './empty'

export type EmptyStateProps = Omit<ComponentProps<'div'>, 'children' | 'role' | 'aria-live'> & {
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

/** A semantic empty, loading, or error state built from the shared empty parts. */
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
      <Show when={local.action}>
        <EmptyContent>
          <ActionButton
            tooltip={local.actionTooltip}
            aria-label={local.actionLabel ?? 'Try again'}
            onClick={local.action}
          >
            {local.actionLabel ?? 'Try again'}
          </ActionButton>
        </EmptyContent>
      </Show>
    </Empty>
  )
}
