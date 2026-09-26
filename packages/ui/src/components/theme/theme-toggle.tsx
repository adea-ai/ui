import { Monitor, Moon, Sun } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { For, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group/toggle-group'
import { useTheme } from './theme-provider'

/**
 * ThemeToggle.
 *
 * Three states, not two: light, dark, and follow the system. A two-state switch is
 * the common mistake — it forces a choice on someone who wanted the application to
 * track their OS, and it has no way to say "I have not decided", so the first click
 * silently overrides a system preference the user set deliberately.
 *
 * The icons carry the state and the accessible name comes from the label, so the
 * control is usable without seeing which glyph is lit.
 */
export type ThemeToggleProps = Omit<ComponentProps<typeof ToggleGroup>, 'children'> & {
  /** Draw labels beside the icons. Off by default: a toolbar wants icons. */
  withLabels?: boolean
}

const APPEARANCES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemeToggle(props: ThemeToggleProps) {
  const [local, rest] = splitProps(props, ['class', 'withLabels'])
  const { selection, setSelection } = useTheme()

  return (
    <ToggleGroup
      attached
      value={selection().appearance}
      onChange={(value: string | null) => {
        // A toggle group reports the pressed value or null; null would leave the
        // appearance unset, so a re-press keeps the current one.
        if (typeof value === 'string') {
          setSelection({ appearance: value as 'light' | 'dark' | 'system' })
        }
      }}
      aria-label="Appearance"
      class={cn(local.class)}
      {...rest}
    >
      <For each={APPEARANCES}>
        {(appearance) => (
          <ToggleGroupItem
            value={appearance.value}
            variant="outline"
            size={local.withLabels ? 'sm' : 'icon-sm'}
            aria-label={appearance.label}
          >
            <appearance.icon />
            {local.withLabels ? <span>{appearance.label}</span> : null}
          </ToggleGroupItem>
        )}
      </For>
    </ToggleGroup>
  )
}
