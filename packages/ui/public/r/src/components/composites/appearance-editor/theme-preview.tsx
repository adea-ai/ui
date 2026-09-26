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
/*
 * Substantially translated from Zeron crates/ui/src/settings/appearance.rs
 * `bar`, `miniature`, `miniature_split`, and `palette_preview`, revision
 * 30a9a9537c5ec96226c87f4bf349b6f77c5dfb59, via Adea's existing
 * packages/ui/src/components/theme-preview.tsx adaptation.
 * Retains the sidebar/pane decomposition, exact bar fractions and opacity,
 * split outer corners, and three-band palette strip. GPUI and Adea's local
 * ThemeVariant are replaced by Solid and the canonical AdeaTheme schema.
 * Dynamic inline colors are theme data; no palette is authored here.
 */
import type { AdeaTheme } from '@adea-ai/themes'
import { For } from 'solid-js'
import { cn } from '../../../lib/utils'

export type ThemeMiniatureProps = {
  theme: AdeaTheme
  corners?: 'all' | 'left' | 'right'
  class?: string
}

function Bar(props: { fraction: number; opacity: number; color: string }) {
  return (
    <span
      class="h-[5px] rounded-[3px]"
      style={{
        width: `${Math.round(props.fraction * 100)}%`,
        'background-color': props.color,
        opacity: props.opacity,
      }}
    />
  )
}

export function ThemeMiniature(props: ThemeMiniatureProps) {
  return (
    <span
      data-theme-miniature
      aria-hidden="true"
      class={cn(
        'flex size-full overflow-hidden',
        {
          'rounded-md': !props.corners || props.corners === 'all',
          'rounded-l-md': props.corners === 'left',
          'rounded-r-md': props.corners === 'right',
        },
        props.class
      )}
      style={{ 'background-color': props.theme.colors.surface }}
    >
      <span class="flex h-full w-11 shrink-0 flex-col gap-[7px] overflow-hidden px-2 pt-3.5">
        <Bar fraction={0.7} opacity={0.34} color={props.theme.colors.foreground} />
        <Bar fraction={1} opacity={0.22} color={props.theme.colors.foreground} />
        <Bar fraction={0.85} opacity={0.22} color={props.theme.colors.foreground} />
        <Bar fraction={1} opacity={0.22} color={props.theme.colors.foreground} />
      </span>
      <span
        class="my-2 mr-2 flex min-w-0 flex-1 flex-col gap-[7px] overflow-hidden rounded-md border border-(--appearance-preview-border) p-2.5"
        style={{
          'background-color': props.theme.colors.background,
          '--appearance-preview-border': props.theme.colors.border,
        }}
      >
        <Bar fraction={0.62} opacity={0.34} color={props.theme.colors.foreground} />
        <Bar fraction={0.88} opacity={0.22} color={props.theme.colors.foreground} />
        <Bar fraction={0.76} opacity={0.22} color={props.theme.colors.foreground} />
        <Bar fraction={0.52} opacity={0.22} color={props.theme.colors.foreground} />
      </span>
    </span>
  )
}

export function ThemeMiniatureSplit(props: { light: AdeaTheme; dark: AdeaTheme; class?: string }) {
  return (
    <span class={cn('flex size-full', props.class)} aria-hidden="true">
      <span class="h-full w-1/2 overflow-hidden">
        <ThemeMiniature theme={props.light} corners="left" />
      </span>
      <span class="h-full w-1/2 overflow-hidden">
        <ThemeMiniature theme={props.dark} corners="right" />
      </span>
    </span>
  )
}

export function PalettePreview(props: { theme: AdeaTheme; class?: string }) {
  const bands = () => [
    props.theme.colors.surface,
    props.theme.colors.background,
    props.theme.colors.accent,
  ]
  return (
    <span
      class={cn(
        'flex h-[18px] w-[30px] shrink-0 overflow-hidden rounded-[5px] border border-(--appearance-preview-border)',
        props.class
      )}
      aria-hidden="true"
      style={{ '--appearance-preview-border': props.theme.colors.border }}
    >
      <For each={bands()}>
        {(band) => <span class="h-full w-1/3" style={{ 'background-color': band }} />}
      </For>
    </span>
  )
}
