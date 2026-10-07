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
import { Show, createSignal, createUniqueId } from 'solid-js'
import { cn } from '#lib/utils'
import { ActionButton } from '../action-button'
import { Button } from '../../ui/button/button'
import { Input } from '../../ui/input/input'
import { AppearanceFontSettingsGroup } from './font-settings-group'
import { DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS } from '#lib/appearance-font-settings'

import { Switch } from '../../ui/switch/switch'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../ui/sheet/sheet'
import type { AppearanceEditorProps, AppearancePopoverProps } from './appearance-types'
import { ModeChoices, AccentChoices, GlassChoices, isCustomAccent } from './appearance-choices'
import { SettingsRow, TerminalRow, ThemeRow } from './appearance-rows'

/**
 * A live editor whose persistence and preview authority belong to its host.
 * No ThemeProvider is required, and no catalogue, renderer engine or storage is
 * imported. Hosts normalize unknown IDs and custom colors, report recovery,
 * snapshot on open, preview on changes, commit on Save, and restore on dismissal.
 * Both theme rows remain mounted when mode changes. Density remains outside the
 * accepted appearance surface; typeface settings are shared and host-persisted.
 */
export function AppearanceEditor(props: AppearanceEditorProps) {
  const errorId = createUniqueId()
  const custom = () => isCustomAccent(props)
  const accentDescription = () => {
    if (props.draft.accent === 'theme') return "Theme default · Uses the palette's intended color."
    const preset = props.accentOptions.find((option) => option.id === props.draft.accent)
    if (preset) return `${preset.label} · Controls, glyphs, selections, code, and activity.`
    if (custom()) return 'Custom · Controls, glyphs, selections, code, and activity.'
    const offered = props.themeAccentOptions?.find((option) => option.id === props.draft.accent)
    // A stored theme accent survives a theme switch by id; when the new pair
    // cannot offer that slot the host falls back to the theme's own primary,
    // and the description says so rather than naming a colour not on screen.
    return offered
      ? `Theme ${offered.label.toLowerCase()} · The theme's own color, on controls and activity.`
      : "Theme default · This theme does not carry that accent, so it uses the palette's intended color."
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
        {/* The row exists only when the host carries a terminal preference:
            the draft field is the show/hide switch, so the editor can never
            render a terminal row that writes nothing. */}
        <Show when={props.draft.terminalThemeId !== undefined}>
          <TerminalRow
            selectedId={props.draft.terminalThemeId ?? 'theme'}
            preview={props.resolvedAppearance === 'dark' ? props.darkTheme : props.lightTheme}
            themes={props.themes}
            disabled={props.saving}
            onSelect={(terminalThemeId) => props.onChange({ terminalThemeId })}
          />
        </Show>
        <SettingsRow title="Accent" icon={<SlidersHorizontal />} description={accentDescription()}>
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
              <p id={errorId} role="alert" class="mt-1 text-xs text-foreground">
                {props.customAccentError}
              </p>
            </Show>
          </div>
        </Show>
        {/* Inline, the typefaces read as one more palette choice; `end` hands
            the closing slot to them for hosts whose order is palette and
            surface first, text last. */}
        <Show when={props.fontSettingsPlacement !== 'end'}>
          <AppearanceFontSettingsGroup
            settings={props.draft.fonts ?? DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS}
            menuPortalMount={props.menuPortalMount}
            disabled={props.saving}
            onChange={(fonts) => props.onChange({ fonts })}
          />
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
        <Show when={props.fontSettingsPlacement === 'end'}>
          <AppearanceFontSettingsGroup
            settings={props.draft.fonts ?? DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS}
            menuPortalMount={props.menuPortalMount}
            disabled={props.saving}
            onChange={(fonts) => props.onChange({ fonts })}
          />
        </Show>
      </div>
      <Show when={!props.hideActions}>
        {/* Sticky so Save/Cancel stay reachable in a tall scroll container: the
            editor scrolls with its host panel, and actions parked at the bottom
            of a long form were unreachable without scrolling past every row. */}
        <div class="sticky bottom-0 z-10 mt-2 border-t bg-background px-4 py-3">
          <AppearanceEditorActions {...props} />
        </div>
      </Show>
    </div>
  )
}

/**
 * Reset, Cancel and Save, with the reason Save is unavailable. Rendered by the
 * editor itself, or — with `hideActions` — by a host that pins them in its own
 * footer, as `AppearancePopover` does.
 */
export function AppearanceEditorActions(props: AppearanceEditorProps) {
  const saveReasonId = createUniqueId()
  return (
    <div class="flex w-full flex-col gap-2">
      <Show when={props.saveDisabledReason}>
        <p id={saveReasonId} role="status" class="text-xs text-muted-foreground">
          {props.saveDisabledReason}
        </p>
      </Show>
      {/* `global-appearance-editor-actions` lets these buttons grow with the UI
          font preference, like the rest of Appearance's own controls. */}
      <div class="global-appearance-editor-actions flex flex-wrap items-center gap-2">
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

/** The editor in an inset Sheet docked beside the main view: the body scrolls and
 * Reset/Cancel/Save sit in the panel's full-width footer, always reachable.
 * Dismissal (Escape, the close button, an outside click) is `onDismiss`. */
export function AppearancePopover(props: AppearancePopoverProps) {
  const [menuPortalMount, setMenuPortalMount] = createSignal<HTMLElement>()

  return (
    <Sheet open={props.open} onOpenChange={(open) => (open ? props.onOpen() : props.onDismiss())}>
      {/* The trigger is an icon-only action, so it explains itself through the
          shared ActionButton's tooltip (keyboard focus included) rather than a
          bare aria-label. */}
      <SheetTrigger
        as={ActionButton}
        variant="ghost"
        size="icon-sm"
        tooltip="Open appearance settings"
        aria-label="Appearance settings"
      >
        <Palette />
      </SheetTrigger>
      <SheetContent side="end" closeLabel="Close appearance settings" ref={setMenuPortalMount}>
        <SheetHeader>
          <SheetTitle>Appearance</SheetTitle>
          <SheetDescription>
            Changes preview immediately. Save keeps them; Cancel restores the previous appearance.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <AppearanceEditor {...props} menuPortalMount={menuPortalMount()} hideActions />
        </SheetBody>
        <SheetFooter>
          <AppearanceEditorActions {...props} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
