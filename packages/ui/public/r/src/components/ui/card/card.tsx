import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * Card.
 *
 * A surface that sits on the canvas. Every card carries its own edge — a
 * border — because in the light theme `--card` and `--background` are both
 * white, and a borderless card there is invisible. Making the border
 * structural rather than optional is what stops one app's cards from reading
 * as floating panels and another's as nothing at all.
 *
 * The parts are separate components rather than a template because a card's
 * header, content and footer have different padding on purpose: the header and
 * footer are tight, the content breathes.
 */
export function Card(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="card"
      class={cn(
        'bg-card text-card-foreground flex flex-col gap-4 rounded-xl border border-border py-4 shadow-xs',
        local.class
      )}
      {...rest}
    />
  )
}

export function CardHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div data-slot="card-header" class={cn('flex flex-col gap-1 px-4', local.class)} {...rest} />
  )
}

export function CardTitle(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="card-title"
      class={cn('text-base leading-none font-semibold tracking-tight', local.class)}
      {...rest}
    />
  )
}

export function CardDescription(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="card-description"
      class={cn('text-muted-foreground text-sm', local.class)}
      {...rest}
    />
  )
}

export function CardAction(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="card-action"
      class={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', local.class)}
      {...rest}
    />
  )
}

export function CardContent(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return <div data-slot="card-content" class={cn('px-4', local.class)} {...rest} />
}

export function CardFooter(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return <div data-slot="card-footer" class={cn('flex items-center px-4', local.class)} {...rest} />
}

export type CardProps = ComponentProps<'div'> & JSX.HTMLAttributes<HTMLDivElement>
