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
import { For } from 'solid-js'

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

  return (
    <div class="grid grid-cols-4 gap-2" data-accent-grid>
      <AccentSwatch id="theme" label="Theme default" color={props.themeDefaultColor} />
      <For each={presets()}>
        {(option) => (
          <AccentSwatch
            id={option.id}
            label={option.label}
            color={(props.resolvedAppearance === 'light' ? option.light : option.dark) ?? ''}
          />
        )}
      </For>
    </div>
  )
}

function AccentSwatch(props: { id: string; label: string; color: string }) {
  return (
    <Radio.Item
      value={props.id}
      data-accent-option={props.id}
      class="rounded-full focus-within:ring-3 focus-within:ring-ring/50"
    >
      <Radio.ItemInput />
      <Radio.ItemLabel class="block size-7 cursor-pointer rounded-full border p-0.5 data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary">
        <span
          class="block size-full rounded-full"
          aria-hidden="true"
          style={{ 'background-color': props.color }}
        />
        <span class="sr-only">{props.label}</span>
      </Radio.ItemLabel>
    </Radio.Item>
  )
}
