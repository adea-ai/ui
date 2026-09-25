import { ChevronRight, MoreHorizontal } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Breadcrumb.
 *
 * The path to the current view, in a real `<nav>` wrapping an ordered list so
 * the structure is announced rather than read as loose text. The final crumb is
 * the current page and is marked `aria-current="page"` instead of being a link
 * to itself.
 *
 * A long path collapses from the middle: the root says where the user started
 * and the last crumbs say what they are looking at, so those are the parts that
 * have to survive.
 */
export function Breadcrumb(props: ComponentProps<'nav'>) {
  const [local, rest] = splitProps(props, ['class', 'aria-label'])

  return (
    <nav
      data-slot="breadcrumb"
      aria-label={local['aria-label'] ?? 'Breadcrumb'}
      class={cn('text-muted-foreground', local.class)}
      {...rest}
    />
  )
}

export function BreadcrumbList(props: ComponentProps<'ol'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <ol
      data-slot="breadcrumb-list"
      class={cn('flex flex-wrap items-center gap-1.5 text-sm break-words', local.class)}
      {...rest}
    />
  )
}

export function BreadcrumbItem(props: ComponentProps<'li'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <li
      data-slot="breadcrumb-item"
      class={cn('inline-flex items-center gap-1.5', local.class)}
      {...rest}
    />
  )
}

export type BreadcrumbLinkProps = ComponentProps<'a'> & {
  /** Render as the current page rather than as a link. */
  current?: boolean
}

export function BreadcrumbLink(props: BreadcrumbLinkProps) {
  const [local, rest] = splitProps(props, ['class', 'current'])

  return (
    <Show
      when={!local.current}
      fallback={
        <span
          data-slot="breadcrumb-page"
          aria-current="page"
          class={cn('font-medium text-foreground', local.class)}
          {...(rest as ComponentProps<'span'>)}
        />
      }
    >
      <a
        data-slot="breadcrumb-link"
        class={cn(
          'rounded-sm transition-colors ease-out outline-none hover:text-foreground',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
          local.class
        )}
        {...rest}
      />
    </Show>
  )
}

export function BreadcrumbSeparator(props: ComponentProps<'li'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      class={cn('[&_svg]:size-3.5', local.class)}
      {...rest}
    >
      {local.children ?? <ChevronRight />}
    </li>
  )
}

export function BreadcrumbEllipsis(props: ComponentProps<'span'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      class={cn('flex size-6 items-center justify-center', local.class)}
      {...rest}
    >
      <MoreHorizontal class="size-4" />
      <span class="visually-hidden">More</span>
    </span>
  )
}
