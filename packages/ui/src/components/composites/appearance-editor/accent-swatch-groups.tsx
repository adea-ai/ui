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
import { RadioGroup as Radio } from '@kobalte/core/radio-group'
import { For, Show } from 'solid-js'
import { cn } from '#lib/utils'

type AccentOption = Readonly<{
  id: string
  label: string
  light?: string
  dark?: string
}>

type AccentSwatchGroupsProps = {
  accentOptions: readonly AccentOption[]
  /**
   * Accepted for host compatibility and no longer rendered. The picker offers
   * one theme-scoped group — the theme's own primary followed by the presets —
   * instead of splitting additional presets and the theme pair's accent slots
   * into labelled groups of their own. A stored theme-accent id still resolves
   * (`resolveAccentPreset`) and is still described by the row; it is just no
   * longer offered as a swatch, and a host can stop feeding this list.
   */
  themeAccentOptions?: readonly AccentOption[]
  resolvedAppearance: 'light' | 'dark'
  themeDefaultColor: string
  /**
   * Whether the group leads with the "Theme default" swatch. Hosts whose
   * default accent already is a preset omit it — a second entry for the same
   * colour reads as a duplicate choice.
   */
  showThemeDefault?: boolean
  /**
   * `grid` — the default — wraps at four to a line. `row` keeps every swatch on
   * one line at a smaller size, the columns sharing the width equally, so a
   * narrow panel does not wrap them; each colour is then the fill of an SVG
   * circle, which is where a host that asserts on swatch colours reads it.
   */
  layout?: 'grid' | 'row'
}

/**
 * The accent choices, as ONE group: the theme's own primary first, then every
 * preset the host feeds, each painted with its value for the resolved
 * appearance — which is what makes the group theme-scoped rather than a
 * catalogue table. The custom-color entry is the host's (`AccentChoices`
 * renders it beside this grid), because whether a free-form colour is accepted
 * is the host's validation to own.
 */
export function AccentSwatchGroups(props: AccentSwatchGroupsProps) {
  const presets = () => props.accentOptions.filter((option) => option.id !== 'theme')
  const row = () => props.layout === 'row'

  return (
    <div
      class={row() ? 'grid auto-cols-fr grid-flow-col' : 'grid grid-cols-4 gap-2'}
      data-accent-grid
    >
      <Show when={props.showThemeDefault ?? true}>
        <AccentSwatch
          id="theme"
          label="Theme default"
          color={props.themeDefaultColor}
          row={row()}
        />
      </Show>
      <For each={presets()}>
        {(option) => (
          <AccentSwatch
            id={option.id}
            label={option.label}
            color={(props.resolvedAppearance === 'light' ? option.light : option.dark) ?? ''}
            row={row()}
          />
        )}
      </For>
    </div>
  )
}

function AccentSwatch(props: { id: string; label: string; color: string; row: boolean }) {
  return (
    <Radio.Item
      value={props.id}
      data-accent-option={props.id}
      class={cn('rounded-full focus-within:ring-3 focus-within:ring-ring/50', {
        'flex justify-center': props.row,
      })}
    >
      <Radio.ItemInput />
      <Radio.ItemLabel
        class={cn(
          'block cursor-pointer rounded-full border p-0.5 data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary',
          props.row ? 'size-6' : 'size-7'
        )}
      >
        <Show
          when={props.row}
          fallback={
            <span
              class="block size-full rounded-full"
              aria-hidden="true"
              style={{ 'background-color': props.color }}
            />
          }
        >
          <svg class="size-full" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="8" fill={props.color} />
          </svg>
        </Show>
        <span class="sr-only">{props.label}</span>
      </Radio.ItemLabel>
    </Radio.Item>
  )
}
