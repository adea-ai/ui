import { Monitor, Moon, Sun } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { For, splitProps } from 'solid-js'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

const APPEARANCES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

/** Controlled appearance selection for hosts that own their preference storage. */
export type ThemeModeToggleProps = Omit<
  ComponentProps<typeof ToggleGroup>,
  'children' | 'value' | 'onChange' | 'multiple'
> & {
  mode: 'light' | 'dark' | 'system'
  onModeChange: (mode: 'light' | 'dark' | 'system') => void
  withLabels?: boolean
}

export function ThemeModeToggle(props: ThemeModeToggleProps) {
  const [local, rest] = splitProps(props, ['mode', 'onModeChange', 'withLabels'])
  return (
    <ToggleGroup
      {...rest}
      attached
      multiple={false}
      value={local.mode}
      onChange={(value: string | null) => {
        const option = APPEARANCES.find((candidate) => candidate.value === value)
        if (option) local.onModeChange(option.value)
      }}
      aria-label={rest['aria-label'] ?? 'Appearance'}
    >
      <For each={APPEARANCES}>
        {(appearance) => (
          <Tooltip>
            <TooltipTrigger
              as={ToggleGroupItem}
              value={appearance.value}
              variant="outline"
              size={local.withLabels ? 'sm' : 'icon-sm'}
              aria-label={appearance.label}
            >
              <appearance.icon aria-hidden="true" />
              {local.withLabels ? <span>{appearance.label}</span> : null}
            </TooltipTrigger>
            <TooltipContent>Use {appearance.label.toLowerCase()} appearance</TooltipContent>
          </Tooltip>
        )}
      </For>
    </ToggleGroup>
  )
}
