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
// One shared menu serves the light, dark, and terminal rows: each option is a
// compact theme preview with its name and one-line description beside it, and
// the menu sizes to that content instead of clipping it at the trigger width.
import type { AdeaTheme, AdeaThemeRecord } from '@adea-ai/themes'
import { For, Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js'
import { ChevronDown, Palette, SquareTerminal } from 'lucide-solid'
import { cn } from '../../../lib/utils'
import { Button } from '../../ui/button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu/dropdown-menu'
import { PalettePreview, ThemeMenuPreview } from './theme-preview'

const POINTER_FOCUS_TARGET_SELECTOR =
  'a[href], area[href], button, input, select, textarea, iframe, [tabindex], [contenteditable], details > summary:first-of-type'

function isTabStop(element: HTMLElement) {
  return (
    (element.tabIndex >= 0 ||
      (element.matches('details > summary:first-of-type') && !element.hasAttribute('tabindex'))) &&
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
      class={cn('flex gap-3 px-4 py-4', {
        'flex-col': props.stacked,
        'flex-wrap items-center': !props.stacked,
      })}
    >
      {/* Reserve readable copy before choosing a side-by-side control row.
          Wrapping follows the actual host width and enlarged text, rather
          than a viewport breakpoint that also matches a narrow popover. */}
      <div class={cn('flex min-w-0 flex-1 items-center gap-3', { 'basis-48': !props.stacked })}>
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
      <div class="min-w-0 max-w-full shrink-0">{props.children}</div>
    </section>
  )
}

/** One selectable palette in a theme menu. */
export type ThemeOption = {
  id: string
  name: string
  description?: string
  preview: AdeaTheme
}

/**
 * The shared theme picker. Kobalte handles menu navigation and dismissal;
 * this component moves Tab to the adjacent browser-reported stop because
 * menus consume Tab by default. Enumerating elements and checking their native
 * tabIndex keeps details summaries in the order while preserving explicit
 * tabindex overrides. The menu width follows its content (bounded by the
 * popper's available width) so a long theme name and its description render
 * fully instead of truncating at the trigger's width.
 */
function ThemeSelectMenu(props: {
  /** Row title; also the trigger's accessible name and the group's label. */
  label: string
  selectedId: string
  /** Palette shown on the trigger; hosts pass the accent-applied preview. */
  triggerPreview: AdeaTheme
  options: readonly ThemeOption[]
  disabled?: boolean
  onSelect: (id: string) => void
}) {
  const [portalMount, setPortalMount] = createSignal<HTMLDivElement>()
  const [triggerElement, setTriggerElement] = createSignal<HTMLButtonElement>()
  const [menuOpen, setMenuOpen] = createSignal(false)
  const [focusOutsideTarget, setFocusOutsideTarget] = createSignal<HTMLElement>()
  const [restoreTriggerFocus, setRestoreTriggerFocus] = createSignal(false)
  let focusTargetAfterTab: HTMLElement | undefined
  let focusLifecycleVersion = 0
  onCleanup(() => {
    focusLifecycleVersion += 1
  })
  const selected = createMemo(
    () =>
      props.options.find((option) => option.id === props.selectedId) ??
      props.options.find((option) => option.id === props.triggerPreview.id)
  )
  const closeMenu = () => {
    if (menuOpen()) focusLifecycleVersion += 1
    setMenuOpen(false)
  }
  const moveFocusOnTab = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || event.isComposing) return

    const trigger = triggerElement()
    if (!trigger) return
    const parentDialog = portalMount()?.closest<HTMLElement>('[role="dialog"]')
    const focusScope = parentDialog ?? portalMount()?.ownerDocument.body
    if (!focusScope) return

    const focusStops = Array.from(focusScope.querySelectorAll<HTMLElement>('*')).filter(
      (element) =>
        isTabStop(element) &&
        element.closest('[role="menu"], [hidden], [inert], [aria-hidden="true"]') === null
    )
    const orderedFocusStops = [
      ...focusStops
        .filter((element) => element.tabIndex > 0)
        .toSorted((a, b) => a.tabIndex - b.tabIndex),
      ...focusStops.filter((element) => element.tabIndex <= 0),
    ]
    const triggerIndex = orderedFocusStops.indexOf(trigger)
    const direction = event.shiftKey ? -1 : 1
    const adjacent =
      orderedFocusStops[triggerIndex + direction] ??
      (parentDialog ? (direction > 0 ? orderedFocusStops[0] : orderedFocusStops.at(-1)) : undefined)

    event.stopPropagation()
    setRestoreTriggerFocus(false)
    if (adjacent) {
      event.preventDefault()
      focusTargetAfterTab = adjacent
      setFocusOutsideTarget(adjacent)
      closeMenu()
      adjacent.focus({ preventScroll: true })
    } else {
      focusTargetAfterTab = undefined
      setFocusOutsideTarget(undefined)
      closeMenu()
    }
  }
  return (
    <div ref={setPortalMount}>
      <DropdownMenu
        modal={false}
        open={menuOpen()}
        onOpenChange={(open) => {
          if (open !== menuOpen()) focusLifecycleVersion += 1
          setMenuOpen(open)
          if (open) {
            focusTargetAfterTab = undefined
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
          aria-label={props.label}
          disabled={props.disabled || props.options.length === 0}
          class="w-full justify-between sm:w-52"
        >
          <span class="flex min-w-0 flex-1 items-center gap-2">
            <PalettePreview theme={props.triggerPreview} />
            <span class="min-w-0 flex-1 truncate">
              {selected()?.name ?? props.triggerPreview.name}
            </span>
          </span>
          <ChevronDown aria-hidden="true" class="shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          portalMount={portalMount()}
          // Sized to content (at least the trigger width, never wider than the
          // popper allows) so long theme names render in full with padding for
          // the selection indicator instead of truncating at the anchor width.
          class="max-h-(--kb-popper-content-available-height) w-max min-w-(--kb-popper-anchor-width) max-w-(--kb-popper-content-available-width) overflow-x-hidden overflow-y-auto"
          onInteractOutside={(event) => {
            if (event.detail.originalEvent.type !== 'pointerdown') return
            const parentDialog = portalMount()?.closest<HTMLElement>('[role="dialog"]')
            const focusScope = parentDialog ?? portalMount()?.ownerDocument.body
            const target = event.detail.originalEvent.target
            if (!(target instanceof Element) || !focusScope?.contains(target)) return

            const focusTarget = target.closest<HTMLElement>(POINTER_FOCUS_TARGET_SELECTOR)
            if (focusTarget && isTabStop(focusTarget)) {
              setRestoreTriggerFocus(false)
              setFocusOutsideTarget(focusTarget)
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
            // A prior menu instance can finish its focus cleanup after this
            // row has already reopened. Do not let that cleanup steal focus.
            if (menuOpen()) {
              event.preventDefault()
              return
            }

            const lifecycleVersion = focusLifecycleVersion
            const shouldRestore = restoreTriggerFocus()
            const focusTarget = focusTargetAfterTab ?? focusOutsideTarget()
            focusTargetAfterTab = undefined
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
                if (lifecycleVersion !== focusLifecycleVersion || menuOpen()) return

                const activeElement = document.activeElement
                const isMenuFocus =
                  activeElement instanceof HTMLElement &&
                  activeElement.closest('[role="menu"]') !== null
                const isTriggerFocus = activeElement === triggerElement()
                if (
                  activeElement !== focusTarget &&
                  (activeElement === document.body ||
                    activeElement === focusScope ||
                    isMenuFocus ||
                    isTriggerFocus)
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
            aria-label={`${props.label} options`}
            on:keydown={moveFocusOnTab}
            onChange={(id) => {
              if (!props.disabled && typeof id === 'string') props.onSelect(id)
            }}
          >
            <For each={props.options}>
              {(option) => (
                <DropdownMenuRadioItem
                  value={option.id}
                  textValue={option.name}
                  closeOnSelect={true}
                  disabled={props.disabled}
                  onSelect={() => setRestoreTriggerFocus(true)}
                >
                  <ThemeMenuPreview theme={option.preview} />
                  <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span class="truncate">{option.name}</span>
                    {/* Visual affordance only: the accessible name stays the
                        theme name, which is what keyboard and test callers
                        match on. */}
                    <Show when={option.description}>
                      <span
                        aria-hidden="true"
                        class="line-clamp-2 max-w-44 text-2xs text-muted-foreground"
                      >
                        {option.description}
                      </span>
                    </Show>
                  </span>
                </DropdownMenuRadioItem>
              )}
            </For>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/**
 * A compact persistent theme choice for one appearance.
 */
export function ThemeRow(props: {
  appearance: 'light' | 'dark'
  selectedId: string
  preview: AdeaTheme
  themes: readonly AdeaThemeRecord[]
  disabled?: boolean
  onSelect: (id: string) => void
}) {
  const label = () => (props.appearance === 'light' ? 'Light theme' : 'Dark theme')
  const options = createMemo<ThemeOption[]>(() =>
    props.themes
      .filter((theme) => theme.appearance === props.appearance)
      .map((theme) => ({
        id: theme.id,
        name: theme.name,
        description: theme.description,
        preview: theme,
      }))
  )
  return (
    <SettingsRow title={label()} icon={<Palette />}>
      <ThemeSelectMenu
        label={label()}
        selectedId={props.selectedId}
        triggerPreview={props.preview}
        options={options()}
        disabled={props.disabled}
        onSelect={props.onSelect}
      />
    </SettingsRow>
  )
}

/**
 * A terminal palette choice independent of the light/dark rows. The first
 * option (`'theme'`) follows the interface theme, painted with the resolved
 * preview; every catalogue record follows, both appearances, because the
 * terminal paints one fixed ANSI palette rather than an appearance axis.
 */
export function TerminalRow(props: {
  selectedId: string
  /** Resolved interface theme: the `theme` option's palette and the fallback. */
  preview: AdeaTheme
  themes: readonly AdeaThemeRecord[]
  disabled?: boolean
  onSelect: (id: string) => void
}) {
  const options = createMemo<ThemeOption[]>(() => [
    {
      id: 'theme',
      name: 'UI theme',
      description: 'Uses the interface theme.',
      preview: props.preview,
    },
    ...props.themes.map((theme) => ({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      preview: theme,
    })),
  ])
  const selectedOption = () => options().find((option) => option.id === props.selectedId)
  const description = () =>
    selectedOption() && selectedOption()?.id !== 'theme'
      ? `The terminal follows ${selectedOption()?.name}.`
      : 'The terminal follows the interface theme.'
  return (
    <SettingsRow title="Terminal" icon={<SquareTerminal />} description={description()}>
      <ThemeSelectMenu
        label="Terminal"
        selectedId={props.selectedId}
        triggerPreview={selectedOption()?.preview ?? props.preview}
        options={options()}
        disabled={props.disabled}
        onSelect={props.onSelect}
      />
    </SettingsRow>
  )
}
