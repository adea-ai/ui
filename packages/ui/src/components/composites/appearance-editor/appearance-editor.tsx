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
 * Composition substantially translated from Zeron settings/appearance.rs and
 * settings/widgets.rs, pinned at 30a9a9537c5ec96226c87f4bf349b6f77c5dfb59,
 * preserving Adea's existing appearance-surface.tsx port: System/Light/Dark
 * miniatures, compact independent theme rows, accent swatches and helper copy,
 * glass chips, and theme library affordance. Kobalte replaces the port's manual
 * radio keyboard model. The controlled draft and explicit action ports replace
 * GPUI globals and app-specific storage/native authority. Save/Cancel/Reset and
 * custom accent/reduced-transparency are accepted Adea divergences (#425).
 */
import { EyeOff, Palette, PanelsTopLeft, SlidersHorizontal } from 'lucide-solid'
import { Show, createUniqueId } from 'solid-js'
import { cn } from '#lib/utils'
import { Button } from '../../ui/button/button'
import { Input } from '../../ui/input/input'

import { Switch } from '../../ui/switch/switch'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '../../ui/popover/popover'
import type { AppearanceEditorProps, AppearancePopoverProps } from './appearance-types'
import { ModeChoices, AccentChoices, GlassChoices } from './appearance-choices'
import { SettingsRow, ThemeRow } from './appearance-rows'

/**
 * A live editor whose persistence and preview authority belong to its host.
 * No ThemeProvider is required, and no catalogue, renderer engine or storage is
 * imported. Hosts normalize unknown IDs and custom colors, report recovery,
 * snapshot on open, preview on changes, commit on Save, and restore on dismissal.
 * Both theme rows remain mounted when mode changes. Typeface/density axes are
 * deliberately absent from Adea #425's accepted surface.
 */
export function AppearanceEditor(props: AppearanceEditorProps) {
  const errorId = createUniqueId()
  const saveReasonId = createUniqueId()
  const custom = () =>
    props.draft.accent !== 'theme' &&
    !props.accentOptions.some((option) => option.id === props.draft.accent)
  const accentDescription = () => {
    if (props.draft.accent === 'theme') return "Theme default · Uses the palette's intended color."
    const name = props.accentOptions.find((option) => option.id === props.draft.accent)?.label
    return `${name ?? 'Custom'} · Controls, glyphs, selections, code, and activity.`
  }
  const glassDescription = () =>
    props.draft.surface === 'opaque'
      ? 'Solid surfaces for every theme.'
      : props.draft.surface === 'frosted'
        ? 'Theme-colored glass where supported.'
        : (props.surfaceCapability.themeDefaultDescription ?? "Uses this theme's default surface.")
  return (
    <div data-appearance-editor class={cn('min-w-0', props.class)}>
      <Show when={props.recoveryNotice}>
        <p role="status" class="px-4 py-2 text-sm text-muted-foreground">
          {props.recoveryNotice}
        </p>
      </Show>
      <ModeChoices {...props} />
      <div class="divide-y divide-border rounded-lg border">
        <ThemeRow
          appearance="light"
          selectedId={props.draft.lightThemeId}
          preview={props.lightTheme}
          themes={props.themes}
          disabled={props.saving}
          onSelect={(lightThemeId) => props.onChange({ lightThemeId })}
        />
        <ThemeRow
          appearance="dark"
          selectedId={props.draft.darkThemeId}
          preview={props.darkTheme}
          themes={props.themes}
          disabled={props.saving}
          onSelect={(darkThemeId) => props.onChange({ darkThemeId })}
        />
        <SettingsRow
          stacked
          title="Accent"
          icon={<SlidersHorizontal />}
          description={accentDescription()}
        >
          <AccentChoices {...props} />
        </SettingsRow>
        <Show when={custom()}>
          <div class="px-4 py-3">
            <label class="mb-2 block text-xs font-medium" for={`${errorId}-input`}>
              Custom accent
            </label>
            <Input
              id={`${errorId}-input`}
              value={props.draft.accent}
              disabled={props.saving}
              aria-invalid={!!props.customAccentError}
              aria-describedby={props.customAccentError ? errorId : undefined}
              onInput={(event) => props.onChange({ accent: event.currentTarget.value })}
            />
            <Show when={props.customAccentError}>
              <p id={errorId} role="alert" class="mt-1 text-xs text-destructive">
                {props.customAccentError}
              </p>
            </Show>
          </div>
        </Show>
        <SettingsRow title="Glass" icon={<PanelsTopLeft />} description={glassDescription()}>
          <GlassChoices {...props} />
        </SettingsRow>
        <Show when={!props.surfaceCapability.frosted && props.surfaceCapability.reason}>
          <p role="status" class="px-4 py-2 text-xs text-muted-foreground">
            {props.surfaceCapability.reason}
          </p>
        </Show>
        <SettingsRow
          title="Reduce transparency"
          icon={<EyeOff />}
          description="Prefer solid surfaces, including during live preview."
        >
          <Switch
            checked={props.draft.reduceTransparency}
            disabled={props.saving}
            onChange={(reduceTransparency: boolean) => props.onChange({ reduceTransparency })}
            aria-label="Reduce transparency"
          />
        </SettingsRow>
        <SettingsRow
          title="Theme library"
          icon={<Palette />}
          description={
            props.onManageThemes
              ? 'Manage themes through the application.'
              : 'Theme import is unavailable.'
          }
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!props.onManageThemes || props.saving}
            onClick={() => props.onManageThemes?.()}
          >
            Manage themes
          </Button>
        </SettingsRow>
      </div>
      <Show when={props.saveDisabledReason}>
        <p id={saveReasonId} role="status" class="px-4 pt-3 text-xs text-muted-foreground">
          {props.saveDisabledReason}
        </p>
      </Show>
      <div class="flex flex-wrap items-center gap-2 px-4 py-4">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={props.saving}
          onClick={() => props.onReset()}
        >
          Reset
        </Button>
        <div class="ml-auto flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={props.saving}
            onClick={() => props.onCancel()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={props.saving || !!props.customAccentError || !!props.saveDisabledReason}
            aria-busy={props.saving}
            aria-describedby={props.saveDisabledReason ? saveReasonId : undefined}
            onClick={() => props.onSave()}
          >
            {props.saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Modal anchoring/dismissal and nested-listbox behavior come from Kobalte. */
export function AppearancePopover(props: AppearancePopoverProps) {
  return (
    <Popover
      open={props.open}
      modal
      onOpenChange={(open) => (open ? props.onOpen() : props.onDismiss())}
    >
      <PopoverTrigger
        as={Button}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Appearance settings"
      >
        <Palette />
      </PopoverTrigger>
      <PopoverContent class="w-lg max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <PopoverTitle>Appearance</PopoverTitle>
        <PopoverDescription>
          Changes preview immediately. Save keeps them; Cancel restores the previous appearance.
        </PopoverDescription>
        <AppearanceEditor {...props} />
      </PopoverContent>
    </Popover>
  )
}
