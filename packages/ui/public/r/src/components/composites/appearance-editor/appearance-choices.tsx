/*
 * MIT License
 *
 * Copyright (c) 2026 Wing
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// Pinned mode-card, accent-swatch, and glass-chip composition. Kobalte replaces
// the app port's manual roving focus; it does not replace the donor hierarchy.
import { RadioGroup as Radio } from '@kobalte/core/radio-group'
import { For, Show } from 'solid-js'
import { isThemeAccentId } from '../../../lib/theme-accents'
import type { AppearanceEditorProps } from './appearance-types'
import { ThemeMiniature, ThemeMiniatureSplit } from './theme-preview'

const MODES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const
const SURFACES = [
  { value: 'theme', label: 'Theme default' },
  { value: 'frosted', label: 'Frosted' },
  { value: 'opaque', label: 'Opaque' },
] as const

export function ModeChoices(props: AppearanceEditorProps) {
  return (
    <Radio
      value={props.draft.mode}
      disabled={props.saving}
      orientation="horizontal"
      aria-label="Appearance mode"
      onChange={(mode) => {
        const option = MODES.find((candidate) => candidate.value === mode)
        if (option) props.onChange({ mode: option.value })
      }}
      class="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-3"
    >
      <For each={MODES}>
        {(option) => (
          <Radio.Item
            value={option.value}
            data-mode={option.value}
            class="min-w-0 rounded-lg focus-within:ring-3 focus-within:ring-ring/50"
          >
            <Radio.ItemInput />
            <Radio.ItemLabel class="flex cursor-pointer flex-col gap-2 rounded-lg border p-2 text-center text-xs data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
              <span class="block h-20 w-full">
                <Show
                  when={option.value === 'system'}
                  fallback={
                    <ThemeMiniature
                      theme={option.value === 'light' ? props.lightTheme : props.darkTheme}
                    />
                  }
                >
                  <ThemeMiniatureSplit light={props.lightTheme} dark={props.darkTheme} />
                </Show>
              </span>
              <span>{option.label}</span>
            </Radio.ItemLabel>
          </Radio.Item>
        )}
      </For>
    </Radio>
  )
}

/**
 * Whether the draft accent is the host's custom colour: not the theme default,
 * not a preset, and not a theme accent id. A theme accent id counts as known even
 * when the current pair cannot offer it — it is a stored role, not a colour the
 * user typed, and showing it in the custom field would invite editing `ansi-blue`.
 */
export function isCustomAccent(props: AppearanceEditorProps): boolean {
  const accent = props.draft.accent
  return (
    accent !== 'theme' &&
    !props.accentOptions.some((option) => option.id === accent) &&
    !isThemeAccentId(accent)
  )
}

export function AccentChoices(props: AppearanceEditorProps) {
  // The resolved appearance decides which side of a preset pair — and which
  // theme accent — the swatches paint, so the row previews each choice as the
  // user will see it.
  const resolvedAppearance = () =>
    props.draft.mode === 'system' ? props.resolvedAppearance : props.draft.mode
  // The accents the previewed theme pair carries, offered after the presets.
  const themeAccents = () => props.themeAccentOptions ?? []
  const accentSelection = () => (isCustomAccent(props) ? 'custom' : props.draft.accent)
  return (
    <Radio
      value={accentSelection()}
      disabled={props.saving}
      orientation="horizontal"
      aria-label="Accent"
      // One chip (custom) beside a capped swatch grid: a chip-per-state column
      // beside a full-width swatch line overflowed the settings sidebar's
      // control column, so the pair stays a narrow chip plus a wrapped grid.
      class="flex items-center gap-3"
      onChange={(accent) =>
        props.onChange({
          accent: accent === 'custom' ? (props.customAccentValue ?? '') : accent,
        })
      }
    >
      <div class="grid grid-cols-4 gap-2">
        {/* The theme's own accent is the first swatch. Picking it is the same
            act the old dedicated "Theme default" chip performed, without a
            second control for the state the row starts in. */}
        <Radio.Item
          value="theme"
          class="rounded-full focus-within:ring-3 focus-within:ring-ring/50"
        >
          <Radio.ItemInput />
          <Radio.ItemLabel class="block size-7 cursor-pointer rounded-full border p-0.5 data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary">
            <span
              class="block size-full rounded-full"
              aria-hidden="true"
              style={{
                'background-color':
                  resolvedAppearance() === 'light'
                    ? props.lightTheme.colors.accent
                    : props.darkTheme.colors.accent,
              }}
            />
            <span class="sr-only">Theme default</span>
          </Radio.ItemLabel>
        </Radio.Item>
        <For each={props.accentOptions}>
          {(option) => (
            <Radio.Item
              value={option.id}
              class="rounded-full focus-within:ring-3 focus-within:ring-ring/50"
            >
              <Radio.ItemInput />
              <Radio.ItemLabel class="block size-7 cursor-pointer rounded-full border p-0.5 data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary">
                <span
                  class="block size-full rounded-full"
                  aria-hidden="true"
                  style={{
                    'background-color':
                      resolvedAppearance() === 'light' ? option.light : option.dark,
                  }}
                />
                <span class="sr-only">{option.label}</span>
              </Radio.ItemLabel>
            </Radio.Item>
          )}
        </For>
        <For each={themeAccents()}>
          {(option) => (
            <Radio.Item
              value={option.id}
              data-theme-accent={option.id}
              class="rounded-full focus-within:ring-3 focus-within:ring-ring/50"
            >
              <Radio.ItemInput />
              <Radio.ItemLabel class="block size-7 cursor-pointer rounded-full border border-dashed p-0.5 data-[checked]:border-solid data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary">
                <span
                  class="block size-full rounded-full"
                  aria-hidden="true"
                  style={{
                    'background-color':
                      resolvedAppearance() === 'light' ? option.light : option.dark,
                  }}
                />
                <span class="sr-only">{`Theme ${option.label.toLowerCase()}`}</span>
              </Radio.ItemLabel>
            </Radio.Item>
          )}
        </For>
      </div>
      <Radio.Item value="custom">
        <Radio.ItemInput />
        <Radio.ItemLabel class="flex h-7 cursor-pointer items-center rounded-md border px-2 text-xs whitespace-nowrap data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary">
          Custom
        </Radio.ItemLabel>
      </Radio.Item>
    </Radio>
  )
}

export function GlassChoices(props: AppearanceEditorProps) {
  return (
    <Radio
      value={props.draft.surface}
      disabled={props.saving}
      orientation="horizontal"
      aria-label="Glass"
      class="flex flex-wrap gap-1"
      onChange={(surface) => {
        const option = SURFACES.find((candidate) => candidate.value === surface)
        if (option) props.onChange({ surface: option.value })
      }}
    >
      <For each={SURFACES}>
        {(option) => (
          <Radio.Item
            value={option.value}
            disabled={option.value === 'frosted' && !props.surfaceCapability.frosted}
            class="rounded-md focus-within:ring-3 focus-within:ring-ring/50"
          >
            <Radio.ItemInput />
            <Radio.ItemLabel class="flex h-7 cursor-pointer items-center rounded-md border px-2 text-xs data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
              {option.label}
            </Radio.ItemLabel>
          </Radio.Item>
        )}
      </For>
    </Radio>
  )
}
