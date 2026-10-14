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

type AccentOption = Readonly<{
  id: string
  label: string
  light?: string
  dark?: string
}>

type AccentSwatchRowProps = {
  accentOptions: readonly AccentOption[]
  resolvedAppearance: 'light' | 'dark'
  themeDefaultColor: string
  /** Whether the row leads with the "Theme default" swatch, as `AccentSwatchGroups` does. */
  showThemeDefault?: boolean
}

/**
 * The `row` accent style's swatches: the same entries as `AccentSwatchGroups`,
 * drawn at a fixed size in a single line whose columns share the width equally,
 * so six presets stay one line and one rhythm down to a narrow panel instead of
 * wrapping into a grid. Each colour is the fill of an SVG circle (not a
 * background), which is where a host that asserts on swatch colours reads it.
 * Rendered inside the `Radio` that `AccentChoices` owns, which supplies the
 * selection and keyboard behaviour.
 */
export function AccentSwatchRow(props: AccentSwatchRowProps) {
  const presets = () => props.accentOptions.filter((option) => option.id !== 'theme')
  const colorOf = (option: AccentOption) =>
    (props.resolvedAppearance === 'light' ? option.light : option.dark) ?? ''

  return (
    <>
      <Show when={props.showThemeDefault ?? true}>
        <AccentSwatch id="theme" label="Theme default" color={props.themeDefaultColor} />
      </Show>
      <For each={presets()}>
        {(option) => <AccentSwatch id={option.id} label={option.label} color={colorOf(option)} />}
      </For>
    </>
  )
}

function AccentSwatch(props: { id: string; label: string; color: string }) {
  return (
    <Radio.Item
      value={props.id}
      data-accent-option={props.id}
      class="flex justify-center rounded-full focus-within:ring-3 focus-within:ring-ring/50"
    >
      <Radio.ItemInput />
      <Radio.ItemLabel class="block size-6 cursor-pointer rounded-full border p-0.5 data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary">
        <svg class="size-full" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="8" fill={props.color} />
        </svg>
        <span class="sr-only">{props.label}</span>
      </Radio.ItemLabel>
    </Radio.Item>
  )
}
