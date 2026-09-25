import { Accordion as KobalteAccordion } from '@kobalte/core/accordion'
import { ChevronDown } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Accordion.
 *
 * A list of collapsible sections. `collapsible` (the default) lets the user
 * close the open section; without it one section is always open, which is what
 * a settings page usually wants and a FAQ usually does not.
 *
 * The trigger is a real button with `aria-expanded` and the panel is
 * `aria-labelledby` the trigger, so the relationship survives even when the
 * panel is empty.
 */
export function Accordion(props: ComponentProps<typeof KobalteAccordion>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteAccordion class={cn('flex w-full flex-col', local.class)} {...rest} />
}

export function AccordionItem(props: ComponentProps<typeof KobalteAccordion.Item>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteAccordion.Item
      class={cn('border-b border-border last:border-b-0', local.class)}
      {...rest}
    />
  )
}

export function AccordionTrigger(props: ComponentProps<typeof KobalteAccordion.Trigger>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteAccordion.Header class="flex">
      <KobalteAccordion.Trigger
        class={cn(
          'flex flex-1 items-center justify-between gap-2 py-3 text-left text-sm font-medium',
          'transition-colors ease-out outline-none',
          'hover:text-foreground',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
          'disabled:pointer-events-none disabled:opacity-50',
          local.class
        )}
        {...rest}
      >
        {local.children}
        <ChevronDown
          class="text-muted-foreground size-4 shrink-0 transition-transform ease-out group-data-[expanded]/accordion:rotate-180"
          aria-hidden="true"
        />
      </KobalteAccordion.Trigger>
    </KobalteAccordion.Header>
  )
}

export function AccordionContent(props: ComponentProps<typeof KobalteAccordion.Content>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteAccordion.Content class={cn('overflow-hidden text-sm', local.class)} {...rest}>
      <div class="pt-0 pb-3">{props.children}</div>
    </KobalteAccordion.Content>
  )
}
