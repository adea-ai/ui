import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { ComponentProps, ValidComponent } from 'solid-js'
import { createSignal, createUniqueId, Show, splitProps } from 'solid-js'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { cn } from '#lib/utils'
import { ListRowControl, type ListRowControlProps } from './list-row-control'

export type ListRowProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  ListRowControlProps<T> & {
    /** A short explanation shown on pointer hover and keyboard focus. */
    tooltip?: string
    /** Native button type; defaults to `button` for button rows. */
    type?: ComponentProps<'button'>['type']
    /** Additional accessible description preserved on plain and rich rows. */
    'aria-describedby'?: string
  }
>

type ListRowTooltipTargetProps<T extends ValidComponent = 'div'> = Omit<ListRowProps<T>, 'as'> & {
  rowAs?: T
  externalDescribedBy?: string
  tooltipId?: string
  tooltipOpen?: () => boolean
}

/** Adapts TooltipTrigger's polymorphic target to ListRow's semantic element. */
function ListRowTooltipTarget<T extends ValidComponent = 'div'>(
  props: ListRowTooltipTargetProps<T>
) {
  const [local, rest] = splitProps(props as ListRowTooltipTargetProps, [
    'rowAs',
    'externalDescribedBy',
    'tooltipId',
    'tooltipOpen',
  ])
  const describedBy = () => {
    const ids = [
      rest['aria-describedby'],
      local.externalDescribedBy,
      local.tooltipOpen?.() ? local.tooltipId : undefined,
    ]
      .flatMap((value) => value?.split(/\s+/) ?? [])
      .filter(Boolean)
    return [...new Set(ids)].join(' ') || undefined
  }

  return (
    <ListRowControl
      as={local.rowAs}
      {...(rest as unknown as ListRowControlProps<T>)}
      aria-describedby={describedBy()}
    />
  )
}

/**
 * Rich row composition with optional hover and keyboard tooltip behavior.
 * Import ListRowControl when the tooltip API is not needed and the consumer
 * wants the plain renderer to tree-shake independently.
 */
export function ListRow<T extends ValidComponent = 'div'>(props: ListRowProps<T>) {
  const [local, rest] = splitProps(props as ListRowProps<T>, ['as', 'tooltip', 'aria-describedby'])
  const [tooltipOpen, setTooltipOpen] = createSignal(false)
  const tooltipId = `list-row-tooltip-${createUniqueId()}`
  const hasClickHandler = () => Boolean(rest.onClick || rest['on:click'])
  const rowAs = () => (local.as ?? (hasClickHandler() ? 'button' : 'div')) as T
  const rowType = () => (rowAs() === 'button' ? (rest.type ?? 'button') : rest.type)
  const rowProps = () =>
    ({
      ...rest,
      type: rowType(),
      'aria-describedby': local['aria-describedby'],
    }) as unknown as ListRowControlProps<T>

  return (
    <Show when={local.tooltip} fallback={<ListRowControl as={rowAs()} {...rowProps()} />}>
      <Tooltip open={tooltipOpen()} onOpenChange={setTooltipOpen}>
        <TooltipTrigger
          as={ListRowTooltipTarget}
          rowAs={rowAs()}
          type={rowType()}
          externalDescribedBy={local['aria-describedby']}
          tooltipId={tooltipId}
          tooltipOpen={tooltipOpen}
          {...(rest as ListRowTooltipTargetProps<T>)}
        >
          {rest.children}
        </TooltipTrigger>
        <TooltipContent id={tooltipId}>{local.tooltip}</TooltipContent>
      </Tooltip>
    </Show>
  )
}

/**
 * A group of rows with an optional heading and a scrolling body. The heading is
 * a plain label rather than a control: grouping is for reading, and a disclosure
 * on a list of five rows costs more attention than it saves.
 */
export function ListGroup(
  props: ComponentProps<'div'> & { label?: string; action?: import('solid-js').JSX.Element }
) {
  const [local, rest] = splitProps(props, ['class', 'label', 'action', 'children'])
  return (
    <div data-slot="list-group" class={cn('flex flex-col gap-0.5', local.class)} {...rest}>
      <Show when={local.label}>
        <div class="group/list-header flex items-center gap-1 px-2 py-1">
          <span class="min-w-0 flex-1 truncate text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            {local.label}
          </span>
          <Show when={local.action}>
            <span class="shrink-0 opacity-0 transition-opacity ease-out group-hover/list-header:opacity-100 focus-within:opacity-100">
              {local.action}
            </span>
          </Show>
        </div>
      </Show>
      <div class="flex flex-col gap-0.5">{local.children}</div>
    </div>
  )
}
