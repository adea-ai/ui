import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Panel.
 *
 * A titled region inside the content area — an editor, an inspector, a list, a
 * terminal. It is the third level of surface after the shell and the sidebar,
 * and like them its parts are fixed: a header with a title and a toolbar, a
 * scrolling body, an optional footer.
 *
 * The body scrolls and the header does not, which is the whole reason this is a
 * component. A panel whose header scrolls away loses the name of what the user
 * is looking at, and every hand-built panel gets this wrong at least once.
 *
 * Component props are `title`-agnostic on purpose: the panel does not decide
 * how large its title is, so an inspector's title and an editor's title agree.
 */
export function Panel(props: ComponentProps<'section'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <section
      data-slot="panel"
      class={cn(
        'bg-surface flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        local.class
      )}
      {...rest}
    />
  )
}

/** A panel whose surface is raised, for a panel floating over the canvas. */
export function PanelCard(props: ComponentProps<'section'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <Panel
      class={cn(
        'bg-card m-2 h-[calc(100%-1rem)] rounded-xl border border-border shadow-xs',
        local.class
      )}
      {...rest}
    />
  )
}

export function PanelHeader(props: ComponentProps<'header'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <header
      data-slot="panel-header"
      class={cn(
        'flex min-h-(--topbar-height) shrink-0 items-center gap-2 border-b border-border px-3',
        local.class
      )}
      {...rest}
    />
  )
}

export function PanelTitle(props: ComponentProps<'h2'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <h2
      data-slot="panel-title"
      class={cn('min-w-0 truncate text-sm font-semibold tracking-tight', local.class)}
      {...rest}
    />
  )
}

export function PanelDescription(props: ComponentProps<'p'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <p
      data-slot="panel-description"
      class={cn('truncate text-xs text-muted-foreground', local.class)}
      {...rest}
    />
  )
}

/** The trailing group in a panel header: buttons, tabs, a menu. */
export function PanelActions(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="panel-actions"
      class={cn('ms-auto flex shrink-0 items-center gap-1', local.class)}
      {...rest}
    />
  )
}

/** A secondary row under the header: a toolbar, tabs, a filter bar. */
export function PanelToolbar(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="panel-toolbar"
      class={cn(
        'flex min-h-9 shrink-0 items-center gap-1.5 border-b border-border px-2',
        local.class
      )}
      {...rest}
    />
  )
}

/**
 * The scrolling region.
 *
 * `min-h-0` is required and easy to omit: a flex child's default `min-height`
 * is its content, so without it a long body pushes the panel past its parent
 * instead of scrolling.
 */
export function PanelBody(
  props: ComponentProps<'div'> & { /** Remove the default padding. */ bare?: boolean }
) {
  const [local, rest] = splitProps(props, ['class', 'bare'])

  return (
    <div
      data-slot="panel-body"
      class={cn('min-h-0 flex-1 overflow-y-auto', { 'p-3': !local.bare }, local.class)}
      {...rest}
    />
  )
}

export function PanelFooter(props: ComponentProps<'footer'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <footer
      data-slot="panel-footer"
      class={cn('flex shrink-0 items-center gap-2 border-t border-border px-3 py-2', local.class)}
      {...rest}
    />
  )
}

/**
 * The centered message a panel shows when it has no content. Distinct from
 * `Empty`, which is a full-page state with room for media and actions; this is
 * the in-pane version, sized for a column.
 */
export function PanelPlaceholder(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <div
      data-slot="panel-placeholder"
      class={cn(
        'text-muted-foreground flex h-full min-h-32 flex-col items-center justify-center gap-2 p-6 text-center text-sm',
        local.class
      )}
      {...rest}
    >
      <Show when={local.children}>{local.children}</Show>
    </div>
  )
}
