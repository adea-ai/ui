import type { ComponentProps } from 'solid-js'
import { For, Show, splitProps } from 'solid-js'
import { accentPresets, fontOptions } from '../../lib/tokens'
import { themesForAppearance } from '../../lib/themes'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button/button'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group/radio-group'
import { ThemePicker } from './theme-picker'
import { useTheme } from './theme-provider'

/**
 * AppearancePanel.
 *
 * The appearance page, as a component rather than as a screen each application
 * draws for itself. Two applications that both let a user choose a theme should
 * offer the *same* choices in the *same* arrangement — otherwise "Adea" and
 * "Cortana" are two products that happen to share a component library, which is
 * the opposite of what this system is for.
 *
 * Four axes, in the order a user thinks about them:
 *
 *   1. **Appearance** — light, dark, or follow the system.
 *   2. **Themes** — one for each appearance. Both are shown at once, because the
 *      choice is per-appearance and hiding the other half makes it feel like one
 *      setting that keeps changing.
 *   3. **Accent** — adea's presets, layered on whichever theme is active.
 *   4. **Font** — the interface face.
 *
 * The panel reads and writes the provider's preference and keeps no state of its
 * own, so it cannot disagree with what is applied.
 */
export type AppearancePanelProps = ComponentProps<'div'>

const LIGHT_THEMES = themesForAppearance('light')
const DARK_THEMES = themesForAppearance('dark')

export function AppearancePanel(props: AppearancePanelProps) {
  const [local, rest] = splitProps(props, ['class'])
  const { selection, setSelection, resolvedAppearance } = useTheme()

  return (
    <div data-slot="appearance-panel" class={cn('flex flex-col gap-8', local.class)} {...rest}>
      {/* --- 1. Appearance ------------------------------------------------- */}
      <section class="flex flex-col gap-3">
        <header class="flex flex-col gap-0.5">
          <h2 class="text-base font-semibold tracking-tight">Appearance</h2>
          <p class="max-w-prose text-sm text-muted-foreground">
            Follow the system, or pin one. The theme below is chosen per appearance, so switching at
            sunset does not make you choose again.
          </p>
        </header>
        <RadioGroup
          value={selection().appearance}
          onChange={(value) => setSelection({ appearance: value as 'light' | 'dark' | 'system' })}
          aria-label="Appearance"
        >
          <RadioGroupItem value="light" label="Light" description="Always the light theme." />
          <RadioGroupItem value="dark" label="Dark" description="Always the dark theme." />
          <RadioGroupItem
            value="system"
            label="Match the system"
            description={`Currently resolving to ${resolvedAppearance()}.`}
          />
        </RadioGroup>
      </section>

      {/* --- 2. Themes ------------------------------------------------------ */}
      <Show when={resolvedAppearance() === 'light'}>
        <ThemeSection
          title="Light theme"
          description="Shown when the appearance resolves to light."
          themes={LIGHT_THEMES}
          selectedId={selection().lightThemeId}
          onThemeSelect={(theme) => setSelection({ lightThemeId: theme.id })}
        />
      </Show>
      <Show when={resolvedAppearance() === 'dark'}>
        <ThemeSection
          title="Dark theme"
          description="Shown when the appearance resolves to dark."
          themes={DARK_THEMES}
          selectedId={selection().darkThemeId}
          onThemeSelect={(theme) => setSelection({ darkThemeId: theme.id })}
        />
      </Show>

      {/* --- 3. Accent ------------------------------------------------------ */}
      <section class="flex flex-col gap-3">
        <header class="flex flex-col gap-0.5">
          <h2 class="text-base font-semibold tracking-tight">Accent</h2>
          <p class="max-w-prose text-sm text-muted-foreground">
            Colours the interactive roles — the primary button, the focus ring, a selected row — on
            top of the theme above. Every preset is measured against the surface it lands on, so
            none of them can make a label unreadable.
          </p>
        </header>
        <div role="radiogroup" aria-label="Accent" class="flex flex-wrap gap-2">
          <For each={accentPresets}>
            {(preset) => (
              <Button
                as="button"
                type="button"
                variant="outline"
                size="sm"
                role="radio"
                aria-checked={selection().accent === preset.id}
                aria-label={preset.label}
                class={cn({
                  'border-ring ring-3 ring-primary-subtle': selection().accent === preset.id,
                })}
                onClick={() => setSelection({ accent: preset.id })}
              >
                <span
                  aria-hidden="true"
                  class="size-3 rounded-full border border-border"
                  style={{
                    'background-color':
                      preset.id === 'theme'
                        ? 'var(--primary)'
                        : `var(--accent-${preset.id}, ${preset.dark})`,
                  }}
                />
                {preset.label}
              </Button>
            )}
          </For>
        </div>
      </section>

      {/* --- 4. Font -------------------------------------------------------- */}
      <section class="flex flex-col gap-3">
        <header class="flex flex-col gap-0.5">
          <h2 class="text-base font-semibold tracking-tight">Typeface</h2>
          <p class="max-w-prose text-sm text-muted-foreground">
            The interface face. Every option is self-hosted, so nothing is fetched at runtime and
            the choice survives going offline.
          </p>
        </header>
        <RadioGroup
          value={selection().font}
          onChange={(value) => setSelection({ font: value as string })}
          aria-label="Typeface"
        >
          <For each={fontOptions}>
            {(option) => (
              <RadioGroupItem
                value={option.id}
                label={option.label}
                description={option.description}
              />
            )}
          </For>
        </RadioGroup>
      </section>
    </div>
  )
}

function ThemeSection(props: {
  title: string
  description: string
  themes: ReturnType<typeof themesForAppearance>
  selectedId: string
  onThemeSelect: (theme: ReturnType<typeof themesForAppearance>[number]) => void
}) {
  return (
    <section class="flex flex-col gap-3">
      <header class="flex flex-col gap-0.5">
        <h2 class="text-base font-semibold tracking-tight">{props.title}</h2>
        <p class="max-w-prose text-sm text-muted-foreground">{props.description}</p>
      </header>
      <ThemePicker
        themes={props.themes}
        selectedId={props.selectedId}
        onThemeSelect={props.onThemeSelect}
      />
    </section>
  )
}
