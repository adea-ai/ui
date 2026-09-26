import type { ComponentProps } from 'solid-js'
import { For, Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import type { ThemeVariant } from '#lib/themes'
import { Button } from '../ui/button/button'

/**
 * ThemeSwatch.
 *
 * The colours of a theme, as a small readable strip: the canvas, a card, the
 * primary, an accent and the destructive fill. Enough to tell two dark themes
 * apart at a glance and to recognise the one you want without applying it.
 *
 * A swatch is **read from the variant object**, not from a stylesheet, so a picker
 * can show a theme that is not currently applied — which is the whole point of a
 * picker. That is also why the catalogue is data rather than CSS.
 */
export type ThemeSwatchProps = ComponentProps<'span'> & {
  theme: ThemeVariant
  /** Draw the swatch at the given size. */
  size?: 'sm' | 'md' | 'lg'
}

const swatchSizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const

export function ThemeSwatch(props: ThemeSwatchProps) {
  const [local, rest] = splitProps(props, ['class', 'theme', 'size'])
  const colors = () => local.theme.colors

  return (
    <span
      data-slot="theme-swatch"
      aria-hidden="true"
      class={cn(
        'border-border inline-flex shrink-0 overflow-hidden rounded-md border',
        local.class
      )}
      {...rest}
    >
      <For
        each={[
          colors().background,
          colors().card,
          colors().primary,
          colors().accent,
          colors().destructive,
        ]}
      >
        {(color) => (
          <span
            class={cn('block', swatchSizes[local.size ?? 'md'])}
            style={{ 'background-color': color }}
          />
        )}
      </For>
    </span>
  )
}

/**
 * ThemePreview.
 *
 * A miniature of the interface, painted in a theme's own colours: a rail, a panel,
 * a heading, body text, a primary button and a destructive one.
 *
 * The point is that a colour strip cannot answer the question a user actually has —
 * "would I want to look at this all day?" — and a real preview can. It is drawn
 * with inline colours from the variant rather than by applying the theme, so a list
 * of twenty previews costs one object read each instead of twenty theme swaps.
 */
export type ThemePreviewProps = ComponentProps<'div'> & {
  theme: ThemeVariant
  /** Highlight the preview as the current selection. */
  selected?: boolean
}

export function ThemePreview(props: ThemePreviewProps) {
  const [local, rest] = splitProps(props, ['class', 'theme', 'selected'])
  const c = () => local.theme.colors

  return (
    <div
      data-slot="theme-preview"
      class={cn(
        'w-44 overflow-hidden rounded-lg border shadow-xs',
        local.selected ? 'border-primary ring-3 ring-primary-subtle' : 'border-border',
        local.class
      )}
      style={{ 'background-color': c().background }}
      {...rest}
    >
      <div class="flex h-24">
        {/* A rail and a panel: the two surfaces a user spends the day looking at. */}
        <div
          class="theme-preview-edge flex w-6 flex-col items-center gap-1.5 border-e py-2"
          style={{ 'background-color': c().sidebar, '--preview-edge': c().sidebarBorder }}
        >
          <span class="size-2.5 rounded-sm" style={{ 'background-color': c().primary }} />
          <span class="size-2.5 rounded-sm" style={{ 'background-color': c().sidebarAccent }} />
          <span class="size-2.5 rounded-sm" style={{ 'background-color': c().sidebarAccent }} />
        </div>
        <div class="flex flex-1 flex-col gap-1.5 p-2">
          <div class="h-1.5 w-14 rounded-full" style={{ 'background-color': c().foreground }} />
          <div class="h-1 w-20 rounded-full" style={{ 'background-color': c().mutedForeground }} />
          <div class="h-1 w-16 rounded-full" style={{ 'background-color': c().mutedForeground }} />
          <div class="mt-auto flex items-center gap-1">
            <span class="h-3 w-9 rounded-sm" style={{ 'background-color': c().primary }} />
            <span class="h-3 w-6 rounded-sm" style={{ 'background-color': c().destructive }} />
            <span class="h-3 w-6 rounded-sm" style={{ 'background-color': c().secondary }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ThemePicker.
 *
 * The catalogue as a selectable grid. One appearance at a time — a light picker
 * lists light themes and a dark picker lists dark ones — because choosing a dark
 * theme while looking at a light interface is a choice nobody can evaluate.
 *
 * `onSelect` rather than an internal signal: the selection belongs to the
 * preference the provider owns, and a picker that kept its own copy could disagree
 * with what is applied.
 */
export type ThemePickerProps = ComponentProps<'div'> & {
  themes: readonly ThemeVariant[]
  selectedId: string
  onThemeSelect: (theme: ThemeVariant) => void
}

export function ThemePicker(props: ThemePickerProps) {
  const [local, rest] = splitProps(props, ['class', 'themes', 'selectedId', 'onThemeSelect'])

  return (
    <div
      data-slot="theme-picker"
      role="radiogroup"
      aria-label="Theme"
      class={cn('flex flex-wrap gap-3', local.class)}
      {...rest}
    >
      <For each={local.themes}>
        {(theme) => (
          <Button
            as="button"
            type="button"
            variant="ghost"
            size="sm"
            role="radio"
            aria-checked={local.selectedId === theme.id}
            aria-label={`${theme.familyLabel} ${theme.label}`}
            class="h-auto flex-col gap-1.5 p-0 hover:bg-transparent"
            onClick={() => local.onThemeSelect(theme)}
          >
            <ThemePreview theme={theme} selected={local.selectedId === theme.id} />
            <span class="flex flex-col items-center">
              <span class="text-xs font-medium">{theme.label}</span>
              <Show when={theme.family !== 'adea'}>
                <span class="text-muted-foreground text-2xs">{theme.familyLabel}</span>
              </Show>
            </span>
          </Button>
        )}
      </For>
    </div>
  )
}
