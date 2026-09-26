import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * AppShell.
 *
 * The window's skeleton: a grid whose regions are the side rail, an optional
 * secondary sidebar, a top bar and the content area, with a status bar pinned
 * to the bottom.
 *
 * Its whole job is to be the *one* place that decides the geometry, so two
 * applications built on this library cannot disagree about how tall the top bar
 * is or where the content begins. Every dimension comes from a token — not from
 * a class on a child — which is why the regions do not accept a height.
 *
 * Both apps are desktop shells, so the arrangement is height-locked: the shell
 * fills the viewport, each region scrolls internally, and the document itself
 * never scrolls. That is what stops a wheel event over a pane from dragging the
 * whole window.
 *
 *   <AppShell>
 *     <SideRail>…</SideRail>
 *     <AppShellBody>
 *       <AppShellTopBar>…</AppShellTopBar>
 *       <AppShellMain>…</AppShellMain>
 *     </AppShellBody>
 *   </AppShell>
 *
 * A second sidebar goes inside `AppShellBody` as a `SidebarNav`, or as a
 * `ResizablePanelGroup` when the user is allowed to resize the split.
 */
export function AppShell(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      data-slot="app-shell"
      class={cn(
        'bg-background text-foreground flex h-screen w-screen overflow-hidden',
        'data-[window-drag=true]:window-drag',
        local.class
      )}
      {...rest}
    />
  )
}

/** The area to the right of the rail: top bar over content over status bar. */
export function AppShellBody(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      data-slot="app-shell-body"
      class={cn('flex min-h-0 min-w-0 flex-1 flex-col', local.class)}
      {...rest}
    />
  )
}

/**
 * The main content area.
 *
 * `min-h-0 min-w-0` is load-bearing: a flex child defaults to its content size,
 * so without it a wide table or a long line makes the whole shell scroll
 * horizontally instead of the pane.
 */
export function AppShellMain(props: ComponentProps<'main'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <main
      data-slot="app-shell-main"
      class={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', local.class)}
      {...rest}
    />
  )
}

/** A resizable split between two or more panes, filling the body. */
export function AppShellContent(props: ComponentProps<'div'> & { children?: JSX.Element }) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      data-slot="app-shell-content"
      class={cn('flex min-h-0 min-w-0 flex-1 overflow-hidden', local.class)}
      {...rest}
    />
  )
}
