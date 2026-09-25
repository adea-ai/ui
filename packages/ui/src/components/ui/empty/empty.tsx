import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Empty.
 *
 * The state of a region that has nothing to show yet, or after a filter
 * removed everything. It exists as a component because an empty state is where
 * apps most often improvise: a bare grey sentence in one view and a centred
 * illustration with two buttons in another.
 *
 * The shape is fixed — media, title, description, actions — so the only
 * decisions a caller makes are which parts to include. A region with an
 * action to offer must give `EmptyContent` something focusable, otherwise the
 * state is a dead end.
 */
export function Empty(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      data-slot="empty"
      class={cn(
        'flex min-h-40 w-full flex-col items-center justify-center gap-4 rounded-lg px-6 py-10 text-center text-balance',
        local.class
      )}
      {...rest}
    />
  )
}

export function EmptyHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="empty-header"
      class={cn('flex max-w-sm flex-col items-center gap-1.5', local.class)}
      {...rest}
    />
  )
}

export type EmptyMediaProps = ComponentProps<'div'> & {
  variant?: 'icon' | 'image'
}

export function EmptyMedia(props: EmptyMediaProps) {
  const [local, rest] = splitProps(props, ['class', 'variant'])

  return (
    <div
      data-slot="empty-media"
      class={cn(
        'flex shrink-0 items-center justify-center',
        {
          'bg-muted text-muted-foreground size-9 rounded-lg [&_svg]:size-4':
            local.variant !== 'image',
          'size-24 rounded-xl [&_img]:size-full [&_img]:object-contain': local.variant === 'image',
        },
        local.class
      )}
      {...rest}
    />
  )
}

export function EmptyTitle(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="empty-title"
      class={cn('text-sm font-medium tracking-tight', local.class)}
      {...rest}
    />
  )
}

export function EmptyDescription(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="empty-description"
      class={cn(
        'text-muted-foreground text-sm [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4',
        local.class
      )}
      {...rest}
    />
  )
}

export function EmptyContent(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="empty-content"
      class={cn('flex max-w-sm flex-col items-center gap-2', local.class)}
      {...rest}
    />
  )
}

export type EmptyProps = ComponentProps<'div'> & { children?: JSX.Element }
