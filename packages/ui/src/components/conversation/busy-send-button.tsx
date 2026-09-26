/*
 * Substantially translated from KiroCrew website/src/components/BusySendButton.tsx
 * at 283e136c0f902e965a535a7c9548c57c7504fed0.
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * Licensed under Apache-2.0; see LICENSE and NOTICE.
 */
import { ArrowUpFromLine, ChevronDown, Target } from 'lucide-solid'
import { For, Show, createUniqueId } from 'solid-js'
import { Button } from '../ui/button/button'
import { ButtonGroup } from '../ui/button-group/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu/dropdown-menu'

export type BusySendMode = 'steer' | 'queue'
export type BusySendButtonProps = {
  mode: BusySendMode
  onModeChange: (mode: BusySendMode) => void
  /** Executes only the selected action. The host owns the draft and command. */
  onFire: () => void
  /** An empty draft or pending delivery disables fire, but not choosing a mode. */
  disabled?: boolean
  /** Disable mode selection when the host has no authority to change preferences. */
  selectionDisabled?: boolean
  /** Host capability/authority failures: unavailable rows remain visible. */
  unavailable?: Partial<Record<BusySendMode, string>>
  /** Supply only when the host implements this alternate-action keyboard chord. */
  alternateActionHint?: string
}

const modes: BusySendMode[] = ['steer', 'queue']
const labels = { steer: 'Steer', queue: 'Queue' }
const descriptions = {
  steer: 'Act on this right away',
  queue: 'Run after the current work finishes',
}

/**
 * Kiro's split action/menu composition, with app-owned mode and availability.
 * Picking a mode never fires it. Persistence, migration and same-session
 * broadcasts belong to the consumer; this component has no storage or global listeners.
 * Kobalte replaces the donor manual portal/positioning and document listeners:
 * arrows wrap and selection/Escape return focus. Kobalte 0.13.14 prevents Tab
 * without moving focus, so a menu-scoped translation of the donor Tab cycle
 * fills that gap. It discovers enabled radio rows only; no document trap.
 * No force-reset timer or runtime authority is translated from the adjacent
 * donor stop flow.
 */
export function BusySendButton(props: BusySendButtonProps) {
  const reasonId = createUniqueId()
  const reason = () => props.unavailable?.[props.mode]
  const variant = () => (props.mode === 'steer' ? ('default' as const) : ('secondary' as const))
  return (
    <div data-slot="busy-send-button" class="flex w-fit flex-col gap-1">
      <DropdownMenu placement="top-end" modal={false}>
        <ButtonGroup label="Send while busy">
          <Button
            type="button"
            size="icon-sm"
            variant={variant()}
            aria-label={props.mode === 'steer' ? 'Steer' : 'Queue message'}
            aria-describedby={reason() ? reasonId : undefined}
            disabled={props.disabled || !!reason()}
            onClick={() => {
              if (!props.disabled && !reason()) props.onFire()
            }}
          >
            <Show when={props.mode === 'steer'} fallback={<ArrowUpFromLine />}>
              <Target />
            </Show>
          </Button>
          <DropdownMenuTrigger
            as={Button}
            type="button"
            size="icon-sm"
            variant={variant()}
            aria-label="Send options"
            disabled={props.selectionDisabled}
          >
            <ChevronDown />
          </DropdownMenuTrigger>
        </ButtonGroup>
        <DropdownMenuContent hideArrow>
          <DropdownMenuRadioGroup
            on:keydown={(event: KeyboardEvent) => {
              if (
                event.key !== 'Tab' ||
                event.isComposing ||
                !(event.currentTarget instanceof HTMLElement)
              )
                return
              const rows = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  '[role="menuitemradio"]:not([aria-disabled="true"])'
                )
              )
              if (!rows.length) return
              event.preventDefault()
              event.stopPropagation()
              const active = document.activeElement
              const index = active instanceof HTMLElement ? rows.indexOf(active) : -1
              const next =
                index < 0
                  ? event.shiftKey
                    ? rows.length - 1
                    : 0
                  : (index + (event.shiftKey ? -1 : 1) + rows.length) % rows.length
              rows[next]?.focus()
            }}
            value={props.mode}
            onChange={(value) => {
              if (
                (value === 'steer' || value === 'queue') &&
                !props.selectionDisabled &&
                !props.unavailable?.[value]
              )
                props.onModeChange(value)
            }}
          >
            <For each={modes}>
              {(mode) => (
                <DropdownMenuRadioItem
                  value={mode}
                  closeOnSelect
                  disabled={props.selectionDisabled || !!props.unavailable?.[mode]}
                >
                  <Show when={mode === 'steer'} fallback={<ArrowUpFromLine />}>
                    <Target />
                  </Show>
                  <div class="flex min-w-0 flex-col gap-1">
                    <span>{labels[mode]}</span>
                    <span class="text-muted-foreground text-xs">{descriptions[mode]}</span>
                    <Show when={props.unavailable?.[mode]}>
                      {(message) => <span class="text-muted-foreground text-xs">{message()}</span>}
                    </Show>
                  </div>
                </DropdownMenuRadioItem>
              )}
            </For>
          </DropdownMenuRadioGroup>
          <Show when={props.alternateActionHint}>
            <DropdownMenuSeparator />
            <p class="text-muted-foreground px-2 py-1 text-xs">{props.alternateActionHint}</p>
          </Show>
        </DropdownMenuContent>
      </DropdownMenu>
      <Show when={reason()}>
        {(message) => (
          <p id={reasonId} class="text-muted-foreground text-xs">
            {message()}
          </p>
        )}
      </Show>
    </div>
  )
}
