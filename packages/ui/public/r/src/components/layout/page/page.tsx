import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * PageHeader.
 *
 * The title block at the top of a scrollable page: where the user is, what this
 * page is, and the actions that apply to the whole of it.
 *
 * The action slot is single and singular on purpose. A page header with four
 * equally-weighted buttons has not decided what the page is for; the design
 * system can only make that look tidy, not make it true. Put the primary action
 * here and the rest in an overflow menu or on the rows they belong to.
 */
export function PageHeader(props: ComponentProps<'header'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <header
      data-slot="page-header"
      class={cn(
        'flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5 pb-4',
        local.class
      )}
      {...rest}
    />
  )
}

export function PageHeaderContent(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="page-header-content"
      class={cn('flex min-w-0 flex-col gap-1', local.class)}
      {...rest}
    />
  )
}

export function PageHeaderTitle(props: ComponentProps<'h1'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <h1
      data-slot="page-header-title"
      class={cn('text-xl font-semibold tracking-tight', local.class)}
      {...rest}
    />
  )
}

export function PageHeaderDescription(props: ComponentProps<'p'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <p
      data-slot="page-header-description"
      class={cn('max-w-prose text-sm text-muted-foreground text-pretty', local.class)}
      {...rest}
    />
  )
}

/** The trailing action group. One primary action, at most. */
export function PageHeaderActions(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="page-header-actions"
      class={cn('flex shrink-0 items-center gap-2', local.class)}
      {...rest}
    />
  )
}

/**
 * A section inside a page, with an optional title and a description.
 * Sections are separated by space rather than by rules — a page of boxed
 * sections reads as a dashboard, and most pages are not one.
 */
export function PageSection(
  props: ComponentProps<'section'> & { title?: string; description?: string; action?: JSX.Element }
) {
  const [local, rest] = splitProps(props, ['class', 'title', 'description', 'action', 'children'])

  return (
    <section
      data-slot="page-section"
      class={cn('flex flex-col gap-3 px-5 py-4', local.class)}
      {...rest}
    >
      <Show when={local.title}>
        <div class="flex items-baseline justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-0.5">
            <h2 class="text-base font-semibold tracking-tight">{local.title}</h2>
            <Show when={local.description}>
              <p class="max-w-prose text-sm text-muted-foreground text-pretty">
                {local.description}
              </p>
            </Show>
          </div>
          <Show when={local.action}>
            <div class="flex shrink-0 items-center gap-2">{local.action}</div>
          </Show>
        </div>
      </Show>
      {local.children}
    </section>
  )
}

/** The scroll container a page's header and sections sit in. */
export function Page(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="page"
      class={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', local.class)}
      {...rest}
    />
  )
}
