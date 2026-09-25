import { Tabs as KobalteTabs } from '@kobalte/core/tabs'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Tabs.
 *
 * For switching between sibling views of the *same* subject — a file's code,
 * diff and history. Not for moving between pages: a tab is expected to keep
 * its panel and its scroll position, which a route does not.
 *
 * `appearance="segmented"` gives the joined bar KiroCrew uses inside a pane
 * where a full-width underline would collide with the panel's own header rule.
 */
export function Tabs(props: ComponentProps<typeof KobalteTabs>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteTabs
      class={cn('flex flex-col gap-2 data-[orientation=vertical]:flex-row', local.class)}
      {...rest}
    />
  )
}

export type TabsListProps = ComponentProps<typeof KobalteTabs.List> & {
  appearance?: 'underline' | 'segmented'
}

export function TabsList(props: TabsListProps) {
  const [local, rest] = splitProps(props, ['class', 'appearance'])

  return (
    <KobalteTabs.List
      class={cn(
        'inline-flex w-fit shrink-0 items-center justify-center',
        local.appearance === 'segmented'
          ? 'gap-0.5 rounded-lg bg-surface-hover p-0.5'
          : 'gap-1 rounded-none border-b border-border',
        'data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
        local.class
      )}
      {...rest}
    />
  )
}

export type TabsTriggerProps = ComponentProps<typeof KobalteTabs.Trigger> & {
  appearance?: 'underline' | 'segmented'
}

export function TabsTrigger(props: TabsTriggerProps) {
  const [local, rest] = splitProps(props, ['class', 'appearance'])

  return (
    <KobalteTabs.Trigger
      class={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium',
        'transition-colors ease-out outline-none select-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'disabled:pointer-events-none disabled:opacity-50',
        'text-muted-foreground hover:text-foreground data-[selected]:text-foreground',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
        local.appearance === 'segmented'
          ? 'h-control-sm rounded-md px-control-sm data-[selected]:bg-card data-[selected]:shadow-xs'
          : 'h-control-md -mb-px rounded-none border-b-2 border-transparent px-2 pb-2 data-[selected]:border-primary',
        local.class
      )}
      {...rest}
    />
  )
}

export function TabsContent(props: ComponentProps<typeof KobalteTabs.Content>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteTabs.Content class={cn('flex-1 outline-none', local.class)} {...rest} />
}
