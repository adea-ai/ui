import { Brain, Check, ChevronsUpDown } from 'lucide-solid'
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  Show,
  splitProps,
} from 'solid-js'
import { cn } from '#lib/utils'
import { Button } from '../../ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { boundText } from '../sources/source'
import {
  findModel,
  groupModels,
  modelSearchValue,
  needsSearch,
  normalizeEfforts,
  resolveEffort,
  type ModelOption,
} from './models'

/**
 * ModelSelector.
 *
 * Two controls in one group beside the composer: *which model*, and *how hard it
 * thinks*. They are one component because the second depends on the first — an
 * effort level belongs to a model, and switching model can make the chosen effort
 * meaningless — so a host should not have to keep two menus consistent by hand.
 *
 * ## What it takes and what it will not decide
 *
 * `models` carries each option's provider, optional description and optional
 * `disabledReason`; `value` and `effort` are the current choice; `onChange` and
 * `onEffortChange` report a new one. The component holds no selection of its own
 * (the host may veto, persist or reset it) and never decides what is allowed:
 *
 * - **An unavailable model stays in the list**, disabled, with the host's reason
 *   beside it in words. Hiding it would leave the person guessing where it went.
 * - **No `onChange`, no menu.** The model is then plain text — a read-only
 *   statement of what is running — not a button that does nothing. The same holds
 *   for effort and `onEffortChange`.
 * - **Effort renders only when the selected model advertises `efforts`.** A model
 *   that does not has no effort control, and a stored `effort` the model does not
 *   offer is shown as unset rather than as a level the model never had.
 * - **A `value` that is not in the list is shown as given**, not swapped for a
 *   model the person did not choose.
 * - `disabledReason` disables both and says why under the group.
 *
 * ## Short list or long
 *
 * Up to `searchThreshold` models (7) the model picker is a `DropdownMenu` with
 * radio rows grouped by provider: arrows, typeahead and Escape come from the menu
 * contract. Beyond it the list is a `Popover` holding a `Command` palette with a
 * search box, because scanning thirty rows is slower than typing four letters.
 * Both close on choice and return focus to the trigger. Triggers use
 * `aria-disabled` so a blocked control is still reachable and its reason read.
 */
export type ModelSelectorProps = {
  models: readonly ModelOption[]
  /** The selected model's id. */
  value?: string
  /** The selected effort's id. */
  effort?: string
  onChange?: (id: string) => void
  onEffortChange?: (effort: string) => void
  /** Show a search box above this many models. Default 7. */
  searchThreshold?: number
  /** Why neither control can be used right now. */
  disabledReason?: string
  /** The group's accessible name. */
  label?: string
  class?: string
}

export function ModelSelector(props: ModelSelectorProps) {
  const [local] = splitProps(props, [
    'models',
    'value',
    'effort',
    'onChange',
    'onEffortChange',
    'searchThreshold',
    'disabledReason',
    'label',
    'class',
  ])
  const blocked = () => local.disabledReason !== undefined
  const selected = () => findModel(local.models, local.value)
  const efforts = createMemo(() => normalizeEfforts(selected()?.efforts))
  const effortChoice = () => resolveEffort(selected(), local.effort)
  const reason = () => (local.disabledReason ? boundText(local.disabledReason, 240) : undefined)
  const reasonId = `${createUniqueId()}-reason`
  const describedBy = () => (reason() ? reasonId : undefined)

  return (
    <div data-slot="model-selector" class={cn('flex min-w-0 flex-col gap-1', local.class)}>
      <div
        role="group"
        aria-label={local.label ?? 'Model and thinking effort'}
        class="flex min-w-0 items-center gap-1"
      >
        <Show
          when={local.onChange}
          fallback={
            <Show when={local.value}>
              <span class="truncate px-2 text-sm text-muted-foreground">
                <span class="visually-hidden">Model: </span>
                {triggerText({ selected: selected(), value: local.value })}
              </span>
            </Show>
          }
        >
          <Show
            when={needsSearch(local.models.length, local.searchThreshold)}
            fallback={
              <ModelMenu
                models={local.models}
                selected={selected()}
                value={local.value}
                blocked={blocked()}
                describedBy={describedBy()}
                onChange={(id) => local.onChange?.(id)}
              />
            }
          >
            <ModelSearch
              models={local.models}
              selected={selected()}
              value={local.value}
              blocked={blocked()}
              describedBy={describedBy()}
              onChange={(id) => local.onChange?.(id)}
            />
          </Show>
        </Show>
        <Show when={efforts().length > 0}>
          <Show
            when={local.onEffortChange}
            fallback={
              <Show when={effortChoice()}>
                {(choice) => (
                  <span class="flex items-center gap-1 truncate px-2 text-sm text-muted-foreground">
                    <Brain aria-hidden="true" class="size-3.5 shrink-0" />
                    <span class="visually-hidden">Thinking effort: </span>
                    {choice().label}
                  </span>
                )}
              </Show>
            }
          >
            <EffortMenu
              efforts={efforts()}
              value={effortChoice()?.id}
              blocked={blocked()}
              describedBy={describedBy()}
              onChange={(id) => local.onEffortChange?.(id)}
            />
          </Show>
        </Show>
      </div>
      <Show when={reason()}>
        <p id={reasonId} role="status" class="m-0 text-xs text-muted-foreground">
          {reason()}
        </p>
      </Show>
    </div>
  )
}

function triggerText(props: { selected?: ModelOption; value?: string }): string {
  if (props.selected) return boundText(props.selected.label, 60)
  return props.value ? boundText(props.value, 60) : 'Choose a model'
}

function ModelOptionBody(props: { model: ModelOption }) {
  return (
    <span class="flex min-w-0 flex-col">
      <span class="[overflow-wrap:anywhere]">{boundText(props.model.label, 60)}</span>
      <Show when={props.model.description}>
        <span class="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {boundText(props.model.description ?? '', 160)}
        </span>
      </Show>
      <Show when={props.model.disabledReason}>
        <span class="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          <span class="visually-hidden">Unavailable: </span>
          {boundText(props.model.disabledReason ?? '', 160)}
        </span>
      </Show>
    </span>
  )
}

type PickerProps = {
  models: readonly ModelOption[]
  selected?: ModelOption
  value?: string
  blocked: boolean
  describedBy?: string
  onChange: (id: string) => void
}

function ModelTrigger(props: { selected?: ModelOption; value?: string; empty: boolean }) {
  return (
    <>
      <span class="max-w-48 truncate">
        {props.empty ? 'No models available' : triggerText(props)}
      </span>
      <ChevronsUpDown aria-hidden="true" />
    </>
  )
}

function ModelMenu(props: PickerProps) {
  const [open, setOpen] = createSignal(false)
  const groups = createMemo(() => groupModels(props.models))
  const inert = () => props.blocked || props.models.length === 0

  createEffect(() => {
    if (inert()) setOpen(false)
  })

  return (
    <DropdownMenu
      open={open()}
      onOpenChange={(next) => setOpen(next && !inert())}
      placement="top-start"
      gutter={6}
    >
      <DropdownMenuTrigger
        as={Button}
        variant="ghost"
        size="sm"
        aria-label={`Model: ${props.models.length === 0 ? 'none available' : triggerText(props)}`}
        aria-disabled={inert() || undefined}
        aria-describedby={props.describedBy}
      >
        <ModelTrigger
          selected={props.selected}
          value={props.value}
          empty={props.models.length === 0}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent hideArrow class="w-72 max-w-full">
        <DropdownMenuRadioGroup
          value={props.value ?? ''}
          onChange={(id: unknown) => {
            // Disabled rows cannot be activated, but the guard is the contract.
            const model = typeof id === 'string' ? findModel(props.models, id) : undefined
            if (!props.blocked && model && model.disabledReason === undefined) {
              props.onChange(model.id)
            }
          }}
        >
          <For each={groups()}>
            {(group) => (
              <DropdownMenuGroup>
                <DropdownMenuLabel>{group.provider}</DropdownMenuLabel>
                <For each={group.models}>
                  {(model) => (
                    <DropdownMenuRadioItem
                      value={model.id}
                      disabled={inert() || model.disabledReason !== undefined}
                    >
                      <ModelOptionBody model={model} />
                    </DropdownMenuRadioItem>
                  )}
                </For>
              </DropdownMenuGroup>
            )}
          </For>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModelSearch(props: PickerProps) {
  const [open, setOpen] = createSignal(false)
  const groups = createMemo(() => groupModels(props.models))

  createEffect(() => {
    if (props.blocked) setOpen(false)
  })

  return (
    <Popover
      open={open()}
      onOpenChange={(next) => setOpen(next && !props.blocked)}
      placement="top-start"
      gutter={6}
    >
      <PopoverTrigger
        as={Button}
        variant="ghost"
        size="sm"
        aria-label={`Model: ${triggerText(props)}`}
        aria-disabled={props.blocked || undefined}
        aria-describedby={props.describedBy}
      >
        <ModelTrigger selected={props.selected} value={props.value} empty={false} />
      </PopoverTrigger>
      <PopoverContent class="w-80 max-w-full">
        <Command label="Choose a model">
          <CommandInput placeholder="Search models" />
          <CommandList>
            <CommandEmpty>No model matches.</CommandEmpty>
            <For each={groups()}>
              {(group) => (
                <CommandGroup heading={group.provider}>
                  <For each={group.models}>
                    {(model) => (
                      <CommandItem
                        value={modelSearchValue(model)}
                        disabled={props.blocked || model.disabledReason !== undefined}
                        onSelect={() => {
                          if (props.blocked || model.disabledReason !== undefined) return
                          props.onChange(model.id)
                          setOpen(false)
                        }}
                      >
                        <ModelOptionBody model={model} />
                        <Show when={model.id === props.value}>
                          <Check aria-hidden="true" class="ms-auto text-primary" />
                          <span class="visually-hidden">Current model</span>
                        </Show>
                      </CommandItem>
                    )}
                  </For>
                </CommandGroup>
              )}
            </For>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function EffortMenu(props: {
  efforts: ReturnType<typeof normalizeEfforts>
  value?: string
  blocked: boolean
  describedBy?: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = createSignal(false)
  const label = () => props.efforts.find((effort) => effort.id === props.value)?.label

  createEffect(() => {
    if (props.blocked) setOpen(false)
  })

  return (
    <DropdownMenu
      open={open()}
      onOpenChange={(next) => setOpen(next && !props.blocked)}
      placement="top-start"
      gutter={6}
    >
      <DropdownMenuTrigger
        as={Button}
        variant="ghost"
        size="sm"
        aria-label={`Thinking effort: ${label() ?? 'not set'}`}
        aria-disabled={props.blocked || undefined}
        aria-describedby={props.describedBy}
      >
        <Brain aria-hidden="true" />
        <span aria-hidden="true">{label() ?? 'Effort'}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent hideArrow class="w-56 max-w-full">
        <DropdownMenuRadioGroup
          value={props.value ?? ''}
          onChange={(id: unknown) => {
            if (!props.blocked && typeof id === 'string') props.onChange(id)
          }}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Thinking effort</DropdownMenuLabel>
            <For each={props.efforts}>
              {(effort) => (
                <DropdownMenuRadioItem value={effort.id} disabled={props.blocked}>
                  <span class="flex min-w-0 flex-col">
                    <span>{effort.label}</span>
                    <Show when={effort.description}>
                      <span class="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {effort.description}
                      </span>
                    </Show>
                  </span>
                </DropdownMenuRadioItem>
              )}
            </For>
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
