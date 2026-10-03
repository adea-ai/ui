import { Tabs as KobalteTabs } from '@kobalte/core/tabs'
import type { Accessor, ComponentProps } from 'solid-js'
import {
  createContext,
  createRenderEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  splitProps,
  useContext,
} from 'solid-js'
import { cn } from '../../../lib/utils'

type TabsIdContextValue = {
  id: Accessor<string>
  orientation: Accessor<'horizontal' | 'vertical'>
  triggerIds: Accessor<ReadonlyMap<string, string>>
  registerTriggerId: (value: string, id: string) => void
  unregisterTriggerId: (value: string, id: string) => void
}

const TabsIdContext = createContext<TabsIdContextValue>()

function useTabsId() {
  const tabs = useContext(TabsIdContext)
  if (!tabs) throw new Error('[adea-ui]: Tabs parts must be used within Tabs.')
  return tabs
}

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
  const [local, rest] = splitProps(props, ['class', 'id'])
  const generatedId = `tabs-${createUniqueId()}`
  const id = () => local.id ?? generatedId
  const [triggerIds, setTriggerIds] = createSignal<ReadonlyMap<string, string>>(new Map())
  const tabs: TabsIdContextValue = {
    id,
    orientation: () => rest.orientation ?? 'horizontal',
    triggerIds,
    registerTriggerId: (value, triggerId) => {
      setTriggerIds((current) => new Map(current).set(value, triggerId))
    },
    unregisterTriggerId: (value, triggerId) => {
      setTriggerIds((current) => {
        if (current.get(value) !== triggerId) return current
        const next = new Map(current)
        next.delete(value)
        return next
      })
    },
  }

  return (
    <TabsIdContext.Provider value={tabs}>
      <KobalteTabs
        id={id()}
        class={cn(
          'flex min-h-0 min-w-0 flex-col gap-2 data-[orientation=vertical]:flex-row',
          local.class
        )}
        {...rest}
      />
    </TabsIdContext.Provider>
  )
}

export type TabsListProps = ComponentProps<typeof KobalteTabs.List> & {
  appearance?: 'underline' | 'segmented'
}

/**
 * The underline appearance's rule is the baseline a horizontal row of tabs sits
 * on. A vertical list has no baseline — its triggers stack — so the rule is
 * dropped there; otherwise it draws as a stray line under the last trigger,
 * spanning only the list's width (the SettingsLayout rail showed exactly that).
 */
export function TabsList(props: TabsListProps) {
  const [local, rest] = splitProps(props, ['class', 'appearance'])

  return (
    <KobalteTabs.List
      class={cn(
        'inline-flex w-fit shrink-0 items-center justify-center',
        local.appearance === 'segmented'
          ? 'gap-0.5 rounded-lg bg-surface-hover p-0.5'
          : 'gap-1 rounded-none border-b border-border data-[orientation=vertical]:border-b-0',
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

/**
 * The underline appearance marks the selected trigger on the edge it shares
 * with the list's axis. A horizontal row reads left to right along a baseline,
 * so the mark is a bottom bar sitting on the list's rule. A vertical list stacks
 * its triggers, and a bottom bar there underlines one row of a column — it reads
 * as a divider, not a selection — so the mark moves to the inline-start edge,
 * the leading bar a side navigation uses, and the label aligns to that edge.
 *
 * The orientation is read from the root rather than from a `data-orientation`
 * selector so the vertical classes are unprefixed: a composite that replaces the
 * mark (SettingsNavigation's filled row passes `border-0`) then overrides it
 * through the ordinary class merge instead of fighting a variant-scoped border.
 */
export function TabsTrigger(props: TabsTriggerProps) {
  const [local, rest] = splitProps(props, ['class', 'appearance', 'id'])
  const tabs = useTabsId()
  const triggerId = () => local.id ?? `${tabs.id()}-trigger-${rest.value}`

  // Register before panels render, including SSR where createEffect is skipped.
  createRenderEffect(() => {
    const value = rest.value
    const id = triggerId()
    tabs.registerTriggerId(value, id)
    onCleanup(() => tabs.unregisterTriggerId(value, id))
  })

  return (
    <KobalteTabs.Trigger
      id={triggerId()}
      class={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium',
        'transition-colors ease-out outline-none select-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'disabled:pointer-events-none disabled:opacity-50',
        'text-foreground',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
        local.appearance === 'segmented'
          ? 'h-control-sm rounded-md px-control-sm data-[selected]:bg-card data-[selected]:shadow-xs'
          : tabs.orientation() === 'vertical'
            ? 'h-control-md justify-start rounded-none border-s-2 border-transparent ps-3 pe-2 data-[selected]:border-primary'
            : 'h-control-md -mb-px rounded-none border-b-2 border-transparent px-2 pb-2 data-[selected]:border-primary',
        local.class
      )}
      {...rest}
    />
  )
}

export function TabsContent(props: ComponentProps<typeof KobalteTabs.Content>) {
  const [local, rest] = splitProps(props, ['class', 'aria-labelledby'])
  const tabs = useTabsId()
  return (
    <KobalteTabs.Content
      aria-labelledby={
        local['aria-labelledby'] ??
        tabs.triggerIds().get(rest.value) ??
        `${tabs.id()}-trigger-${rest.value}`
      }
      class={cn('min-h-0 min-w-0 flex-1 outline-none', local.class)}
      {...rest}
    />
  )
}
