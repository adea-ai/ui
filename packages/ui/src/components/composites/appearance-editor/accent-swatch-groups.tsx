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
import type { AccentPreset } from '@adea-ai/themes'
import { For, Show } from 'solid-js'
import { cn } from '#lib/utils'

export const PRIMARY_ACCENT_IDS = ['blue', 'green', 'amber', 'cyan', 'pink'] as const
const primaryAccentIds: ReadonlySet<string> = new Set(PRIMARY_ACCENT_IDS)

type AccentSwatchGroupsProps = {
  accentOptions: readonly AccentPreset[]
  themeAccentOptions: readonly AccentPreset[]
  resolvedAppearance: 'light' | 'dark'
  themeDefaultColor: string
}

export function AccentSwatchGroups(props: AccentSwatchGroupsProps) {
  const primaryAccents = () =>
    PRIMARY_ACCENT_IDS.flatMap((id) => {
      const option = props.accentOptions.find((candidate) => candidate.id === id)
      return option ? [option] : []
    })
  const additionalAccents = () =>
    props.accentOptions.filter(
      (option) => option.id !== 'theme' && !primaryAccentIds.has(option.id)
    )

  return (
    <>
      <div class="grid grid-cols-3 gap-2" data-primary-accent-grid>
        <AccentSwatch
          id="theme"
          label="Theme default"
          color={props.themeDefaultColor}
          group="primary"
        />
        <For each={primaryAccents()}>
          {(option) => (
            <AccentSwatch
              id={option.id}
              label={option.label}
              color={(props.resolvedAppearance === 'light' ? option.light : option.dark) ?? ''}
              group="primary"
            />
          )}
        </For>
      </div>
      <Show when={additionalAccents().length > 0}>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-muted-foreground">Additional colors</span>
          <div class="flex flex-wrap gap-2">
            <For each={additionalAccents()}>
              {(option) => (
                <AccentSwatch
                  id={option.id}
                  label={option.label}
                  color={props.resolvedAppearance === 'light' ? option.light : option.dark}
                  group="additional"
                />
              )}
            </For>
          </div>
        </div>
      </Show>
      <Show when={props.themeAccentOptions.length > 0}>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-muted-foreground">Theme accents</span>
          <div class="grid grid-cols-3 gap-2">
            <For each={props.themeAccentOptions}>
              {(option) => (
                <AccentSwatch
                  id={option.id}
                  label={'Theme ' + option.label.toLowerCase()}
                  color={(props.resolvedAppearance === 'light' ? option.light : option.dark) ?? ''}
                  group="theme"
                  dashed
                />
              )}
            </For>
          </div>
        </div>
      </Show>
    </>
  )
}

function AccentSwatch(props: {
  id: string
  label: string
  color: string
  group: 'primary' | 'additional' | 'theme'
  dashed?: boolean
}) {
  return (
    <Radio.Item
      value={props.id}
      data-accent-option={props.id}
      data-primary-accent={props.group === 'primary' ? props.id : undefined}
      data-additional-accent={props.group === 'additional' ? props.id : undefined}
      data-theme-accent={props.group === 'theme' ? props.id : undefined}
      class="rounded-full focus-within:ring-3 focus-within:ring-ring/50"
    >
      <Radio.ItemInput />
      <Radio.ItemLabel
        class={cn(
          'block size-7 cursor-pointer rounded-full border p-0.5 data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary',
          { 'border-dashed data-[checked]:border-solid': props.dashed }
        )}
      >
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
