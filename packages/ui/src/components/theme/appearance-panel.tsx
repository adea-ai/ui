import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { RadioGroup as Radio } from '@kobalte/core/radio-group'
import { accentPresets } from '#lib/tokens'
import { themesForAppearance } from '#lib/themes'
import { DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS } from '#lib/appearance-font-settings'
import { cn } from '#lib/utils'
import { AccentSwatchGroups } from '../composites/appearance-editor/accent-swatch-groups'
import { AppearanceFontSettingsGroup } from '../composites/appearance-editor/font-settings-group'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group/radio-group'
import { ThemePicker } from './theme-picker'
import { useTheme } from './theme-provider'
import { Heading } from '../ui/typography'

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
 *   3. **Accent** — adea's presets, then the accents the selected theme pair
 *      carries itself, layered on whichever theme is active.
 *   4. **Fonts** — separate families and sizes for interface, content and code.
 *
 * The panel reads and writes the provider's preference and keeps no state of its
 * own, so it cannot disagree with what is applied.
 */
export type AppearancePanelProps = ComponentProps<'div'>

const LIGHT_THEMES = themesForAppearance('light')
const DARK_THEMES = themesForAppearance('dark')

export function AppearancePanel(props: AppearancePanelProps) {
  const [local, rest] = splitProps(props, ['class'])
  const { selection, setSelection, resolvedAppearance, themeAccents } = useTheme()
  const selectedAccent = () =>
    accentPresets.some((option) => option.id === selection().accent) ||
    themeAccents().some((option) => option.id === selection().accent)
      ? selection().accent
      : 'theme'

  return (
    <div data-slot="appearance-panel" class={cn('flex flex-col gap-8', local.class)} {...rest}>
      {/* --- 1. Appearance ------------------------------------------------- */}
      <section class="flex flex-col gap-3">
        <header class="flex flex-col gap-0.5">
          <Heading as="h2" size="card">
            Appearance
          </Heading>
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
          <Heading as="h2" size="card">
            Accent
          </Heading>
          <p class="max-w-prose text-sm text-muted-foreground">
            Colours the interactive roles — the primary button, the focus ring, a selected row — on
            top of the theme above — one of the presets, or a colour the theme carries itself. Every
            option is measured against the surface it lands on, so none of them can make a label
            unreadable.
          </p>
        </header>
        <Radio
          value={selectedAccent()}
          onChange={(accent) => setSelection({ accent })}
          orientation="horizontal"
          aria-label="Accent"
          class="flex flex-col items-start gap-3"
        >
          <AccentSwatchGroups
            accentOptions={accentPresets}
            themeAccentOptions={themeAccents()}
            resolvedAppearance={resolvedAppearance()}
            themeDefaultColor="var(--primary)"
          />
        </Radio>
      </section>

      {/* --- 4. Fonts ------------------------------------------------------- */}
      <section class="flex flex-col gap-3">
        <header class="flex flex-col gap-0.5">
          <Heading as="h2" size="card">
            Fonts
          </Heading>
          <p class="max-w-prose text-sm text-muted-foreground">
            Choose separate families and sizes for the interface, reading, and code. Font families
            come from the shared catalogue and are self-hosted.
          </p>
        </header>
        <AppearanceFontSettingsGroup
          settings={selection().fonts ?? DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS}
          onChange={(fonts) => setSelection({ fonts })}
        />
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
        <Heading as="h2" size="card">
          {props.title}
        </Heading>
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
