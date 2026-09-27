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
import { For, Show, createMemo, createSignal, type JSX } from 'solid-js'
import { ChevronDown, Palette } from 'lucide-solid'
import { cn } from '#lib/utils'
import { Button } from '../../ui/button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu/dropdown-menu'
import { PalettePreview } from './theme-preview'

const FOCUS_STOP_SELECTOR =
  'a[href], area[href], button, input, select, textarea, iframe, [tabindex], [contenteditable]'

function isFocusStop(element: HTMLElement) {
  return (
    element.tabIndex >= 0 &&
    !element.matches(':disabled') &&
    element.getAttribute('aria-disabled') !== 'true' &&
    element.closest('[hidden], [inert], [aria-hidden="true"]') === null &&
    element.getClientRects().length > 0
  )
}

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

/**
 * A compact persistent theme choice. Kobalte handles menu navigation and
 * dismissal; this row returns Tab to the adjacent focus stop because menus
 * consume Tab by default. A dialog remains the traversal boundary, while an
 * inline editor follows document order.
 */
export function ThemeRow(props: {
  appearance: 'light' | 'dark'
  selectedId: string
  preview: AdeaTheme
  themes: readonly AdeaThemeRecord[]
  disabled?: boolean
  onSelect: (id: string) => void
}) {
  const [portalMount, setPortalMount] = createSignal<HTMLDivElement>()
  const [triggerElement, setTriggerElement] = createSignal<HTMLButtonElement>()
  const [menuOpen, setMenuOpen] = createSignal(false)
  const [focusOutsideTarget, setFocusOutsideTarget] = createSignal<HTMLElement>()
  const [restoreTriggerFocus, setRestoreTriggerFocus] = createSignal(false)
  const options = createMemo(() =>
    props.themes.filter((theme) => theme.appearance === props.appearance)
  )
  const selected = createMemo(
    () =>
      options().find((theme) => theme.id === props.selectedId) ??
      options().find((theme) => theme.id === props.preview.id)
  )
  const label = () => (props.appearance === 'light' ? 'Light theme' : 'Dark theme')
  const moveFocusOnTab = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || event.isComposing) return

    const trigger = triggerElement()
    if (!trigger) return
    const parentDialog = portalMount()?.closest<HTMLElement>('[role="dialog"]')
    const focusScope = parentDialog ?? portalMount()?.ownerDocument.body
    if (!focusScope) return

    const focusStops = Array.from(
      focusScope.querySelectorAll<HTMLElement>(FOCUS_STOP_SELECTOR)
    ).filter(
      (element) =>
        element !== trigger &&
        isFocusStop(element) &&
        element.closest('[role="menu"], [hidden], [inert], [aria-hidden="true"]') === null
    )
    const isAfterTrigger = (element: HTMLElement) =>
      !!(trigger.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
    const isBeforeTrigger = (element: HTMLElement) =>
      !!(trigger.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING)
    const direction = event.shiftKey ? -1 : 1
    const adjacent = parentDialog
      ? direction > 0
        ? (focusStops.find(isAfterTrigger) ?? focusStops[0])
        : (focusStops.filter(isBeforeTrigger).at(-1) ?? focusStops.at(-1))
      : direction > 0
        ? focusStops.find(isAfterTrigger)
        : focusStops.filter(isBeforeTrigger).at(-1)

    // Kobalte consumes Tab in menus. Explicitly close and transfer focus when
    // an adjacent stop exists; at an inline document boundary, leave the
    // browser's native Tab default available instead of wrapping to the start.
    event.stopPropagation()
    setRestoreTriggerFocus(false)
    if (adjacent) {
      event.preventDefault()
      setFocusOutsideTarget(adjacent)
      setMenuOpen(false)
      adjacent.focus({ preventScroll: true })
    } else {
      setFocusOutsideTarget(undefined)
      setMenuOpen(false)
    }
  }
  return (
    <SettingsRow title={label()} icon={<Palette />}>
      <div ref={setPortalMount}>
        <DropdownMenu
          modal={false}
          open={menuOpen()}
          onOpenChange={(open) => {
            setMenuOpen(open)
            if (open) {
              setFocusOutsideTarget(undefined)
              setRestoreTriggerFocus(false)
            }
          }}
        >
          <DropdownMenuTrigger
            ref={setTriggerElement}
            as={Button}
            variant="outline"
            size="sm"
            aria-label={label()}
            disabled={props.disabled || options().length === 0}
            class="w-full justify-between sm:w-52"
          >
            <span class="flex min-w-0 flex-1 items-center gap-2">
              <PalettePreview theme={props.preview} />
              <span class="min-w-0 flex-1 truncate">{selected()?.name ?? props.preview.name}</span>
            </span>
            <ChevronDown aria-hidden="true" class="shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            portalMount={portalMount()}
            class="max-h-(--kb-popper-content-available-height) w-(--kb-popper-anchor-width) min-w-32 overflow-x-hidden overflow-y-auto"
            onInteractOutside={(event) => {
              if (event.detail.originalEvent.type !== 'pointerdown') return
              const parentDialog = portalMount()?.closest<HTMLElement>('[role="dialog"]')
              const focusScope = parentDialog ?? portalMount()?.ownerDocument.body
              const target = event.detail.originalEvent.target
              if (!(target instanceof Element) || !focusScope?.contains(target)) return

              const focusStop = target.closest<HTMLElement>(FOCUS_STOP_SELECTOR)
              if (focusStop && isFocusStop(focusStop)) {
                setRestoreTriggerFocus(false)
                setFocusOutsideTarget(focusStop)
              } else {
                setRestoreTriggerFocus(true)
              }
            }}
            onFocusOutside={(event) => {
              // The containing dialog or document body can briefly reclaim
              // focus when the menu opens. Keep that handoff from dismissing
              // it; focus moving to another descendant still closes the menu.
              const parentDialog = portalMount()?.closest<HTMLElement>('[role="dialog"]')
              const focusScope = parentDialog ?? portalMount()?.ownerDocument.body
              const target = event.detail.originalEvent.target
              if (target === focusScope) {
                event.preventDefault()
              } else if (target instanceof HTMLElement && focusScope?.contains(target)) {
                setRestoreTriggerFocus(false)
                setFocusOutsideTarget(target)
              }
            }}
            onEscapeKeyDown={() => setRestoreTriggerFocus(true)}
            onCloseAutoFocus={(event) => {
              const shouldRestore = restoreTriggerFocus()
              const focusTarget = focusOutsideTarget()
              setFocusOutsideTarget(undefined)
              setRestoreTriggerFocus(false)
              if (shouldRestore) {
                // The saved focus may be the containing dialog rather than
                // the trigger when WebKit opens this menu from a pointer click.
                event.preventDefault()
                triggerElement()?.focus({ preventScroll: true })
                return
              }

              const parentDialog = portalMount()?.closest<HTMLElement>('[role="dialog"]')
              const focusScope = parentDialog ?? portalMount()?.ownerDocument.body
              if (focusTarget?.isConnected && focusScope?.contains(focusTarget)) {
                // Preserve the intended in-scope destination across
                // Kobalte's deferred stale-focus restore.
                event.preventDefault()
                queueMicrotask(() => {
                  const activeElement = document.activeElement
                  const isMenuFocus =
                    activeElement instanceof HTMLElement &&
                    activeElement.closest('[role="menu"]') !== null
                  if (
                    activeElement !== focusTarget &&
                    (activeElement === document.body || activeElement === focusScope || isMenuFocus)
                  ) {
                    focusTarget.focus({ preventScroll: true })
                  }
                })
                return
              }

              const activeElement = document.activeElement
              if (
                focusScope &&
                activeElement instanceof HTMLElement &&
                activeElement !== focusScope &&
                focusScope.contains(activeElement) &&
                activeElement.closest('[role="menu"]') === null
              ) {
                // Preserve a real focus target in this scope instead of
                // restoring the stale element captured when the menu mounted. A
                // focused menu item is about to unmount, so Kobalte must restore
                // focus to the trigger instead.
                event.preventDefault()
              }
            }}
          >
            <DropdownMenuRadioGroup
              value={selected()?.id ?? ''}
              aria-label={`${label()} options`}
              on:keydown={moveFocusOnTab}
              onChange={(id) => {
                if (!props.disabled && typeof id === 'string') props.onSelect(id)
              }}
            >
              <For each={options()}>
                {(theme) => (
                  <DropdownMenuRadioItem
                    value={theme.id}
                    textValue={theme.name}
                    closeOnSelect={true}
                    disabled={props.disabled}
                    onSelect={() => setRestoreTriggerFocus(true)}
                  >
                    <PalettePreview theme={theme} />
                    <span class="min-w-0 flex-1 truncate">{theme.name}</span>
                  </DropdownMenuRadioItem>
                )}
              </For>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SettingsRow>
  )
}
