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
// Retains the compact divided row and palette-preview selector from the pinned
// Zeron/Adea composition; Kobalte owns option navigation and nested dismissal.
import type { AdeaTheme, AdeaThemeRecord } from '@adea-ai/themes'
import { Show, createMemo, createSignal, type JSX } from 'solid-js'
import { Palette } from 'lucide-solid'
import { cn } from '../../../lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select/select'
import { PalettePreview } from './theme-preview'

export function SettingsRow(props: {
  title: string
  icon: JSX.Element
  description?: JSX.Element
  stacked?: boolean
  children: JSX.Element
}) {
  return (
    <section
      class={cn('flex flex-col gap-3 px-4 py-4', { 'sm:flex-row sm:items-center': !props.stacked })}
    >
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-foreground/5 text-muted-foreground [&_svg]:size-4"
          aria-hidden="true"
        >
          {props.icon}
        </span>
        <div class="min-w-0">
          <h3 class="text-sm font-medium">{props.title}</h3>
          <Show when={props.description}>
            <div class="mt-0.5 text-xs text-muted-foreground">{props.description}</div>
          </Show>
        </div>
      </div>
      <div class="min-w-0 shrink-0">{props.children}</div>
    </section>
  )
}

export function ThemeRow(props: {
  appearance: 'light' | 'dark'
  selectedId: string
  preview: AdeaTheme
  themes: readonly AdeaThemeRecord[]
  disabled?: boolean
  onSelect: (id: string) => void
}) {
  const [portalMount, setPortalMount] = createSignal<HTMLDivElement>()
  const options = createMemo(() =>
    props.themes.filter((theme) => theme.appearance === props.appearance)
  )
  const selected = createMemo(
    () =>
      options().find((theme) => theme.id === props.selectedId) ??
      options().find((theme) => theme.id === props.preview.id)
  )
  const label = () => (props.appearance === 'light' ? 'Light theme' : 'Dark theme')
  return (
    <SettingsRow title={label()} icon={<Palette />}>
      <div ref={setPortalMount}>
        <Select
          modal={false}
          options={options()}
          value={selected()}
          optionValue="id"
          optionTextValue="name"
          disabled={props.disabled || options().length === 0}
          onChange={(theme) => {
            if (theme) props.onSelect(theme.id)
          }}
          itemComponent={(item) => (
            <SelectItem item={item.item}>
              <PalettePreview theme={item.item.rawValue} />
              {item.item.rawValue.name}
            </SelectItem>
          )}
        >
          <SelectTrigger size="sm" aria-label={label()} class="w-full sm:w-52">
            <SelectValue>
              {() => (
                <>
                  <PalettePreview theme={props.preview} />
                  <span>{selected()?.name ?? props.preview.name}</span>
                </>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent portalMount={portalMount()} />
        </Select>
      </div>
    </SettingsRow>
  )
}
