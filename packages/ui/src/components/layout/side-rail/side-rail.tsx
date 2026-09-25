import { Polymorphic, type PolymorphicProps } from '@kobalte/core/polymorphic'
import type { ComponentProps, JSX, ValidComponent } from 'solid-js'
import { Show, createMemo, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip/tooltip'
import { SideRailContext, createSideRailValue } from './side-rail-context'

/**
 * SideRail.
 *
 * The narrow, persistent column of top-level destinations at the window's
 * leading edge: the app mark, the primary sections, and a footer for account
 * and settings. It is the one piece of chrome that is always on screen, which
 * is why it is a component rather than something each view arranges.
 *
 * Two forms, one component. Collapsed it is an icon column; expanded it carries
 * labels. Both widths come from the `--rail-width` and `--rail-width-expanded`
 * tokens, so an app cannot pick its own and end up a few pixels out of step
 * with the app beside it.
 *
 * The rail does not own its collapsed state; the app does. That state has to
 * survive a reload and usually lives with the rest of the window preferences,
 * and a rail that kept it privately could not be restored.
 */
export type SideRailProps<T extends ValidComponent = 'nav'> = PolymorphicProps<
  T,
  {
    class?: string
    collapsed?: boolean
    'aria-label'?: string
  }
>

export function SideRail<T extends ValidComponent = 'nav'>(props: SideRailProps<T>) {
  const [local, rest] = splitProps(props as SideRailProps, [
    'class',
    'collapsed',
    'aria-label',
    'children',
  ])

  const collapsed = () => local.collapsed ?? false
  const value = createSideRailValue(
    collapsed,
    createMemo(() => (collapsed() ? 'var(--rail-width)' : 'var(--rail-width-expanded)'))
  )

  return (
    <SideRailContext.Provider value={value}>
      <Polymorphic
        as="nav"
        aria-label={local['aria-label'] ?? 'Primary'}
        /* Rendered in both states, with a real value, so the descendant
           selectors below can key on true *and* false — an absent attribute
           would leave the expanded form matching neither. */
        data-collapsed={collapsed() ? 'true' : 'false'}
        class={cn(
          'group/rail bg-sidebar text-sidebar-foreground flex h-full shrink-0 flex-col border-e border-sidebar-border',
          'transition-[width] ease-out',
          { 'w-rail': collapsed(), 'w-rail-expanded': !collapsed() },
          local.class
        )}
        {...(rest as ComponentProps<'nav'>)}
      >
        {local.children}
      </Polymorphic>
    </SideRailContext.Provider>
  )
}

/** The header slot: the app mark, and the product name when there is room. */
export function SideRailHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="side-rail-header"
      class={cn(
        'h-topbar flex shrink-0 items-center gap-2.5 px-3 group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:px-0',
        local.class
      )}
      {...rest}
    />
  )
}

/** The scrolling middle. Keeps the header and the footer pinned. */
export function SideRailContent(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="side-rail-content"
      class={cn(
        'flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-2 py-2',
        local.class
      )}
      {...rest}
    />
  )
}

/** The pinned footer: account, settings, help. */
export function SideRailFooter(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="side-rail-footer"
      class={cn(
        'flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border px-2 py-2',
        local.class
      )}
      {...rest}
    />
  )
}

/** A titled group of rail destinations. The title hides when collapsed. */
export function SideRailSection(props: ComponentProps<'div'> & { label?: string }) {
  const [local, rest] = splitProps(props, ['class', 'label', 'children'])

  return (
    <div data-slot="side-rail-section" class={cn('flex flex-col gap-0.5', local.class)} {...rest}>
      <Show when={local.label}>
        <div class="text-sidebar-muted-foreground px-2 pt-2 pb-1 text-2xs font-medium tracking-wide uppercase group-data-[collapsed=true]/rail:hidden">
          {local.label}
        </div>
      </Show>
      {local.children}
    </div>
  )
}

/**
 * The classes a rail row uses. Exported so a caller's own element — a router
 * link, a custom button — can match the rail exactly instead of approximating
 * it.
 */
export const sideRailItemClass = [
  'flex h-rail-item min-w-0 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium',
  'group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:px-0',
  'transition-colors ease-out outline-none select-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
  '[&_svg]:size-4 [&_svg]:shrink-0',
].join(' ')

export const sideRailItemStateClass = {
  active: 'bg-sidebar-accent text-sidebar-accent-foreground',
  idle: 'text-sidebar-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
}

export type SideRailItemProps<T extends ValidComponent = 'a'> = PolymorphicProps<
  T,
  {
    class?: string
    /** Marks the item as the current destination. */
    active?: boolean
    /**
     * The item's accessible name. Required, and always in the accessibility
     * tree: collapsed it moves into a tooltip and a visually hidden span rather
     * than being deleted.
     */
    label: string
    /** A count or a dot, rendered at the trailing edge. */
    badge?: JSX.Element
    /** An indicator pinned to the trailing edge in the expanded form. */
    trailing?: JSX.Element
  }
>

/**
 * A rail destination.
 *
 * The row *is* the tooltip trigger — not a wrapper around it. That is forced by
 * the platform rather than chosen: `pointerenter` and `focus` do not bubble, so a
 * trigger element wrapping the real row would never see either, and the tooltip
 * would never open. Making the row the trigger is also what keeps the tooltip
 * anchored to the thing the pointer is actually over.
 *
 * Polymorphic, so a router's link component works here and keeps the rail's
 * styling contract.
 */
export function SideRailItem<T extends ValidComponent = 'a'>(props: SideRailItemProps<T>) {
  const [local, rest] = splitProps(props as SideRailItemProps, [
    'as',
    'class',
    'active',
    'label',
    'badge',
    'trailing',
    'children',
  ])

  return (
    <Tooltip placement="right">
      <TooltipTrigger
        as={(local.as ?? 'a') as ValidComponent}
        aria-current={local.active ? 'page' : undefined}
        data-active={local.active ? '' : undefined}
        class={cn(
          sideRailItemClass,
          local.active ? sideRailItemStateClass.active : sideRailItemStateClass.idle,
          local.class
        )}
        {...(rest as Record<string, unknown>)}
      >
        <span class="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
          {local.children}
        </span>
        <span class="min-w-0 flex-1 truncate group-data-[collapsed=true]/rail:sr-only">
          {local.label}
        </span>
        <Show when={local.badge}>
          <span class="group-data-[collapsed=true]/rail:absolute group-data-[collapsed=true]/rail:end-1 group-data-[collapsed=true]/rail:top-1 ms-auto shrink-0">
            {local.badge}
          </span>
        </Show>
        <Show when={local.trailing}>
          <span class="ms-auto shrink-0">{local.trailing}</span>
        </Show>
      </TooltipTrigger>
      <TooltipContent class="group-data-[collapsed=false]/rail:hidden">
        {local.label}
      </TooltipContent>
    </Tooltip>
  )
}

/** A non-navigating rail control: a collapse toggle, a "new" action. */
export function SideRailButton(props: Omit<ComponentProps<'button'>, 'type'> & { label: string }) {
  const [local, rest] = splitProps(props, ['class', 'label', 'children'])

  return (
    <Tooltip placement="right">
      <TooltipTrigger
        as="button"
        type="button"
        aria-label={local.label}
        class={cn(
          sideRailItemClass,
          sideRailItemStateClass.idle,
          'disabled:pointer-events-none disabled:opacity-50',
          local.class
        )}
        {...(rest as Record<string, unknown>)}
      >
        {local.children}
        <span class="truncate group-data-[collapsed=true]/rail:sr-only">{local.label}</span>
      </TooltipTrigger>
      <TooltipContent class="group-data-[collapsed=false]/rail:hidden">
        {local.label}
      </TooltipContent>
    </Tooltip>
  )
}
