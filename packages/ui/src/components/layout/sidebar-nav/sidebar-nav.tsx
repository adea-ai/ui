import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { Polymorphic } from '@kobalte/core/polymorphic'
import { ChevronRight } from 'lucide-solid'
import type { ComponentProps, JSX, ValidComponent } from 'solid-js'
import { Show, createSignal, splitProps } from 'solid-js'
import { cn } from '#lib/utils'

function invokeEventHandler(handler: unknown, event: Event) {
  if (Array.isArray(handler)) {
    const [callback, data] = handler as [(data: unknown, event: Event) => void, unknown]
    callback(data, event)
  } else if (typeof handler === 'function') {
    ;(handler as (event: Event) => void)(event)
  }
}

/**
 * SidebarNav.
 *
 * The secondary navigation column: the list of things inside the destination
 * the rail selected — projects, sessions, files, threads. It is a different
 * object from the rail, not a wider version of it, which is why it is a separate
 * component rather than the rail with labels on.
 *
 * Rows share one recipe with the rail's, so a row in a sidebar and a row in a
 * rail read as the same kind of thing at the same density. That recipe is
 * exactly KiroCrew's nav row: `text-sm font-medium`, `gap-2.5`, `px-3 py-2`,
 * `rounded-md`, `transition-colors`.
 *
 * The width comes from `--sidebar-width`. Sections collapse by default only when
 * the caller says so, because a section that starts collapsed and holds the
 * user's own work is a hidden default.
 */
export type SidebarNavProps<T extends ValidComponent = 'nav'> = PolymorphicProps<
  T,
  { class?: string; 'aria-label'?: string }
>

export function SidebarNav<T extends ValidComponent = 'nav'>(props: SidebarNavProps<T>) {
  const [local, rest] = splitProps(props as SidebarNavProps, ['class', 'aria-label', 'children'])

  return (
    <Polymorphic
      as="nav"
      aria-label={local['aria-label'] ?? 'Section'}
      class={cn(
        'bg-sidebar text-sidebar-foreground flex h-full w-sidebar shrink-0 flex-col border-e border-sidebar-border',
        local.class
      )}
      {...(rest as ComponentProps<'nav'>)}
    >
      {local.children}
    </Polymorphic>
  )
}

export function SidebarNavHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="sidebar-nav-header"
      class={cn('flex h-topbar shrink-0 items-center justify-between gap-2 px-3', local.class)}
      {...rest}
    />
  )
}

export type SidebarNavTitleProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  { class?: string }
>

export function SidebarNavTitle<T extends ValidComponent = 'div'>(props: SidebarNavTitleProps<T>) {
  const [local, rest] = splitProps(props as SidebarNavTitleProps, ['class'])
  return (
    <Polymorphic
      as="div"
      data-slot="sidebar-nav-title"
      class={cn('truncate text-sm font-semibold tracking-tight', local.class)}
      {...(rest as ComponentProps<'div'>)}
    />
  )
}

/** The scrolling middle of the sidebar. */
export function SidebarNavContent(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="sidebar-nav-content"
      class={cn('flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2', local.class)}
      {...rest}
    />
  )
}

export function SidebarNavFooter(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="sidebar-nav-footer"
      class={cn('flex shrink-0 items-center gap-1 border-t border-sidebar-border p-2', local.class)}
      {...rest}
    />
  )
}

/** Props forwarded to a collapsible section's disclosure button. */
export type SidebarNavSectionTriggerProps = Omit<
  ComponentProps<'button'>,
  'type' | 'aria-expanded' | 'onClick' | 'onKeyDown' | 'children' | 'class' | 'style'
> & {
  /** Called for Alt+ArrowUp/Down; the host owns ordering and row identity. */
  onReorder?: (direction: 'up' | 'down') => void
  /** Runs before the section toggle and may cancel it with `preventDefault()`. */
  onClick?: ComponentProps<'button'>['onClick']
  /** Runs before shared Alt+Arrow handling and may cancel it with `preventDefault()`. */
  onKeyDown?: ComponentProps<'button'>['onKeyDown']
}

/**
 * A titled, collapsible group. Collapsible because a list of projects
 * inevitably outgrows the column, and the user needs to put the ones they are
 * not using away *without* them disappearing into a menu.
 */
export type SidebarNavSectionProps = ComponentProps<'div'> & {
  label: string
  /** Render a disclosure control instead of a plain heading. */
  collapsible?: boolean
  defaultOpen?: boolean
  /** Mark the current project/group without changing its disclosure state. */
  active?: boolean
  /** Controlled disclosure state. When supplied, the host owns changes. */
  open?: boolean
  /** Called for user-initiated disclosure changes. */
  onOpenChange?: (open: boolean) => void
  /** Native props and reorder callbacks for the disclosure control. */
  triggerProps?: SidebarNavSectionTriggerProps
  /** Count shown beside the label. */
  count?: number
  /** A control at the trailing edge of the heading row. */
  action?: JSX.Element
  /** Semantic heading element for a host's section hierarchy. */
  headingAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export function SidebarNavSection(props: SidebarNavSectionProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'label',
    'collapsible',
    'defaultOpen',
    'active',
    'open',
    'onOpenChange',
    'triggerProps',
    'count',
    'action',
    'headingAs',
    'children',
  ])
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(local.defaultOpen ?? true)
  const open = () => local.open ?? uncontrolledOpen()
  const setOpen = (next: boolean) => {
    if (local.open === undefined) setUncontrolledOpen(next)
    local.onOpenChange?.(next)
  }

  const [trigger, triggerRest] = splitProps(local.triggerProps ?? {}, [
    'onClick',
    'onKeyDown',
    'onReorder',
  ])

  const heading = (
    <>
      <Show when={local.collapsible}>
        <ChevronRight
          aria-hidden="true"
          class={cn('size-3.5 shrink-0 text-muted-foreground transition-transform ease-out', {
            'rotate-90': open(),
          })}
        />
      </Show>
      <span class="min-w-0 flex-1 truncate">{local.label}</span>
      <Show when={local.count !== undefined}>
        <span class="shrink-0 tabular-nums text-muted-foreground">{local.count}</span>
      </Show>
    </>
  )

  return (
    <div data-slot="sidebar-nav-section" class={cn('flex flex-col gap-0.5', local.class)} {...rest}>
      <div
        data-slot="sidebar-nav-section-header"
        data-active={local.active ? '' : undefined}
        class={cn(
          'group/section-header flex items-center gap-1 rounded-md px-2 py-1.5',
          { '[@media(pointer:coarse)]:py-0': local.collapsible },
          local.active ? 'bg-primary-subtle text-foreground' : 'hover:bg-sidebar-accent/60'
        )}
      >
        <Polymorphic
          as={local.headingAs ?? 'div'}
          aria-label={local.headingAs ? local.label : undefined}
          class={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 text-2xs font-medium tracking-wide uppercase',
            local.active ? 'text-foreground' : 'text-sidebar-muted-foreground'
          )}
        >
          <Show when={local.collapsible} fallback={heading}>
            <button
              {...(triggerRest as ComponentProps<'button'>)}
              type="button"
              aria-expanded={open()}
              aria-current={local.active ? 'page' : triggerRest['aria-current']}
              onClick={(event) => {
                invokeEventHandler(trigger.onClick, event)
                if (event.defaultPrevented) return
                setOpen(!open())
              }}
              onKeyDown={(event) => {
                invokeEventHandler(trigger.onKeyDown, event)
                if (event.defaultPrevented || !event.altKey) return
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                event.preventDefault()
                event.stopPropagation()
                trigger.onReorder?.(event.key === 'ArrowUp' ? 'up' : 'down')
              }}
              class={cn(
                'flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-2xs font-medium tracking-wide uppercase outline-none transition-colors ease-out hover:text-sidebar-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle [@media(pointer:coarse)]:min-h-11',
                local.active ? 'text-foreground' : 'text-sidebar-muted-foreground'
              )}
            >
              {heading}
            </button>
          </Show>
        </Polymorphic>
        <Show when={local.action}>
          <span class="shrink-0 opacity-0 transition-opacity ease-out group-hover/section-header:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
            {local.action}
          </span>
        </Show>
      </div>
      <Show when={!local.collapsible || open()}>
        <div class="flex flex-col gap-0.5">{local.children}</div>
      </Show>
    </div>
  )
}

export type SidebarNavRowProps = ComponentProps<'div'> & {
  /** Adjacent controls, outside the navigation item's interactive element. */
  actions?: JSX.Element
}

/**
 * A navigation item and its adjacent controls. Actions stay outside the item
 * to avoid nested buttons; touch, keyboard focus, and expanded menus expose
 * them without requiring a pointer hover.
 */
export function SidebarNavRow(props: SidebarNavRowProps) {
  const [local, rest] = splitProps(props, ['class', 'children', 'actions'])
  return (
    <div
      data-slot="sidebar-nav-row"
      class={cn('group/sidebar-nav-row flex min-w-0 items-center gap-0.5', local.class)}
      {...rest}
    >
      {local.children}
      <Show when={local.actions}>
        <span
          data-slot="sidebar-nav-row-actions"
          class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity ease-out group-hover/sidebar-nav-row:opacity-100 group-focus-within/sidebar-nav-row:opacity-100 has-[[aria-expanded=true]]:opacity-100 [@media(hover:none)]:opacity-100"
        >
          {local.actions}
        </span>
      </Show>
    </div>
  )
}

export type SidebarNavItemProps<T extends ValidComponent = 'a'> = PolymorphicProps<
  T,
  {
    class?: string
    active?: boolean
    /** Indent one level, for a child row such as a branch under a project. */
    nested?: boolean
    /** Trailing slot: a count, a status dot, a hover action. */
    trailing?: JSX.Element
  }
>

/**
 * A sidebar row. Exported classes, so a caller's own element can match it.
 * Coarse pointers get a 44px target without changing Kiro's desktop density.
 */
export const sidebarNavItemClass = [
  'group/nav-item relative flex min-w-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium',
  'whitespace-nowrap transition-colors ease-out outline-none select-none [@media(pointer:coarse)]:min-h-11',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
  '[&_svg]:size-4 [&_svg]:shrink-0',
].join(' ')

export const sidebarNavItemStateClass = {
  active: 'bg-primary-subtle text-foreground',
  idle: 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
}

export function SidebarNavItem<T extends ValidComponent = 'a'>(props: SidebarNavItemProps<T>) {
  const [local, rest] = splitProps(props as SidebarNavItemProps, [
    'class',
    'active',
    'nested',
    'trailing',
    'children',
  ])

  return (
    <Polymorphic
      as="a"
      aria-current={local.active ? 'page' : undefined}
      data-active={local.active ? '' : undefined}
      class={cn(
        sidebarNavItemClass,
        local.active ? sidebarNavItemStateClass.active : sidebarNavItemStateClass.idle,
        { 'ps-8': local.nested },
        local.class
      )}
      {...(rest as ComponentProps<'a'>)}
    >
      {local.children}
      <Show when={local.trailing}>
        <span class="ms-auto flex shrink-0 items-center gap-1">{local.trailing}</span>
      </Show>
    </Polymorphic>
  )
}

/** A row that is a button rather than a destination — "New project". */
export function SidebarNavButton(props: ComponentProps<'button'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <button
      type="button"
      class={cn(
        sidebarNavItemClass,
        sidebarNavItemStateClass.idle,
        'w-full disabled:pointer-events-none disabled:opacity-50',
        local.class
      )}
      {...rest}
    >
      {local.children}
    </button>
  )
}
