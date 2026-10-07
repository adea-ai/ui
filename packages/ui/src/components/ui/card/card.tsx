import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'
import { headingVariants } from '../typography'

/**
 * Card.
 *
 * A surface that sits on the canvas. Every card carries its own edge — a
 * border — because in the light theme `--card` is one faint step off a white
 * `--background`, and a borderless card there all but disappears. Making the border
 * structural rather than optional is what stops one app's cards from reading
 * as floating panels and another's as nothing at all.
 *
 * The parts are separate components rather than a template because a card's
 * header, content and footer have different padding on purpose: the header and
 * footer are tight, the content breathes.
 *
 * `size` is the card's padding rung, so a caller never sets `p-*` or `gap-*` on
 * a card to make it denser. `sm` tightens the card and its header, content and
 * footer together (the parts' inline padding follows the card, so they stay
 * aligned with each other); `flush` removes the block padding and gap for a
 * card whose body is a list of rows or a scroll area that runs edge to edge.
 */
export const cardVariants = cva(
  'bg-card text-card-foreground flex flex-col rounded-xl border border-border shadow-xs',
  {
    variants: {
      size: {
        /** 16px block padding and gap; the parts carry 16px inline padding. */
        default: 'gap-4 py-4',
        /** 12px everywhere: a dense settings or status card. */
        sm: 'gap-3 py-3 *:data-[slot=card-content]:px-3 *:data-[slot=card-footer]:px-3 *:data-[slot=card-header]:px-3',
        /** No block padding or gap: the card hosts a row list or a scroller. */
        flush: 'gap-0 py-0',
      },
    },
    defaultVariants: { size: 'default' },
  }
)

export type CardProps = ComponentProps<'div'> & VariantProps<typeof cardVariants>

export function Card(props: CardProps) {
  const [local, rest] = splitProps(props, ['class', 'size'])
  return (
    <div data-slot="card" class={cn(cardVariants({ size: local.size }), local.class)} {...rest} />
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
      class={cn(headingVariants({ size: 'card', leading: 'none' }), local.class)}
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
