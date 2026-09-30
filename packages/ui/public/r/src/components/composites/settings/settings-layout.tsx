import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'
import { Tabs } from '../../ui/tabs'
import { SettingsNavigation, type SettingsNavigationGroup } from './settings-navigation'

export type SettingsLayoutProps = Omit<
  ComponentProps<typeof Tabs>,
  'children' | 'orientation' | 'value' | 'defaultValue' | 'onChange'
> & {
  /** Grouped navigation entries; the host owns their values and panel content. */
  groups: readonly SettingsNavigationGroup[]
  /** Accessible name for the vertical tab list. */
  'aria-label': string
  /** The host-controlled selected destination. */
  value: string
  /** Updates the host-controlled selected destination. */
  onChange: (value: string) => void
  /** Called when the already-selected destination is activated again. */
  onReselect?: (value: string) => void
  /** Reveal the selected row on value changes and window resizes. Defaults to nearest scroll. */
  revealSelected?: boolean | ((trigger: HTMLButtonElement | undefined) => void)
  /** Panels must be rendered as `TabsContent` descendants. */
  children?: JSX.Element
}

/**
 * SettingsLayout.
 *
 * A controlled, vertical settings rail beside its scrollable panel viewport.
 * The host keeps ownership of selection, URL/hash state and panel content.
 * At narrow viewports the rail contracts while both columns remain shrinkable.
 */
export function SettingsLayout(props: SettingsLayoutProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'children',
    'groups',
    'aria-label',
    'value',
    'onReselect',
    'revealSelected',
  ])

  return (
    <Tabs
      {...rest}
      orientation="vertical"
      value={local.value}
      class={cn('min-h-0 min-w-0 flex-1 gap-0', local.class)}
    >
      <SettingsNavigation
        aria-label={local['aria-label']}
        groups={local.groups}
        value={local.value}
        onReselect={local.onReselect}
        revealSelected={local.revealSelected}
        class="w-24 md:w-sidebar"
      />
      <div data-slot="settings-layout-panels" class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
        {local.children}
      </div>
    </Tabs>
  )
}
