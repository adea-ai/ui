import { Collapsible as KobalteCollapsible } from '@kobalte/core/collapsible'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * Collapsible.
 *
 * One region that shows and hides. Accordion is this in a list; reach for
 * Collapsible when there is exactly one, so a caller does not have to build a
 * one-item accordion whose semantics say "list of one".
 *
 * The content animates its height rather than appearing, which is what keeps a
 * disclosure from reading as a layout jump. Kobalte publishes the measured
 * height as `--kb-collapsible-content-height`.
 */
export function Collapsible(props: ComponentProps<typeof KobalteCollapsible>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteCollapsible class={cn('flex w-full flex-col', local.class)} {...rest} />
}

export function CollapsibleTrigger(props: ComponentProps<typeof KobalteCollapsible.Trigger>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteCollapsible.Trigger
      class={cn(
        'flex items-center gap-1.5 text-sm font-medium',
        'transition-colors ease-out outline-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'disabled:pointer-events-none disabled:opacity-50',
        local.class
      )}
      {...rest}
    />
  )
}

export function CollapsibleContent(props: ComponentProps<typeof KobalteCollapsible.Content>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteCollapsible.Content
      class={cn(
        'overflow-hidden',
        /* Kobalte measures the content and exposes the height; the transition
           reads it so the panel opens to its real size rather than a guess. */
        'data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[expanded]:slide-in-from-top-1',
        'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:slide-out-to-top-1',
        local.class
      )}
      {...rest}
    />
  )
}
