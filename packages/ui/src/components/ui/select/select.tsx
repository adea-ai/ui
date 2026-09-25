import { Select as KobalteSelect } from '@kobalte/core/select'
import { Check, ChevronDown, ChevronsUpDown } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { menuContentPadding, menuItem, popoverArrow } from '#lib/overlay'
import { cn } from '#lib/utils'

/**
 * Select.
 *
 * A single choice from a list that is too long to show, or whose options are
 * only known at runtime. The distinction from RadioGroup is disclosure: a
 * Select hides the choices behind a click, which is right above roughly seven
 * options and wrong below it.
 *
 * `Select.Value` renders the human-readable label of the selection, not its
 * value — the reason a Select takes both `options` and `optionValue`/`optionText`
 * rather than a bare list of strings, and the reason the trigger never shows a
 * raw id.
 */
export function Select<Option, OptGroup = never>(
  props: ComponentProps<typeof KobalteSelect<Option, OptGroup>>
) {
  return <KobalteSelect {...props} />
}

export type SelectTriggerProps = ComponentProps<typeof KobalteSelect.Trigger> & {
  size?: 'sm' | 'md' | 'lg'
  /** Hide the chevron, e.g. when a caller draws its own affordance. */
  hideIcon?: boolean
}

export function SelectTrigger(props: SelectTriggerProps) {
  const [local, rest] = splitProps(props, ['class', 'size', 'hideIcon', 'children'])

  return (
    <KobalteSelect.Trigger
      class={cn(
        'border-input bg-transparent flex w-fit items-center justify-between gap-2 rounded-md border px-control-md',
        'whitespace-nowrap transition-[color,box-shadow,border-color] ease-out outline-none',
        'data-[placeholder-shown]:text-muted-foreground',
        'hover:border-input',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive-subtle',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        '*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
        {
          'h-control-sm text-xs': local.size === 'sm',
          'h-control-md text-sm': local.size === 'md' || local.size === undefined,
          'h-control-lg text-sm': local.size === 'lg',
        },
        local.class
      )}
      {...rest}
    >
      {local.children}
      <Show when={!local.hideIcon}>
        <KobalteSelect.Icon class="text-muted-foreground">
          <ChevronDown />
        </KobalteSelect.Icon>
      </Show>
    </KobalteSelect.Trigger>
  )
}

/**
 * What the trigger shows for the current selection.
 *
 * The default renderer is the reason a single-select needs no render prop at all.
 * Kobalte's own `Value` draws *only* its children, so a bare `<SelectValue />`
 * shows the placeholder and then goes blank the moment something is chosen: the
 * value is there, nothing paints it.
 *
 * Kobalte cannot supply a default itself, because an option is the caller's type
 * — it has no way to know which field is the label. So this reads a field by
 * convention: `label`, then `name`, then `textValue`. An option shaped
 * `{ value, label }` therefore needs nothing, and anything else passes
 * `optionLabel`.
 *
 * A multiple-select still supplies its own renderer, because "3 selected" is a
 * summary a caller has to phrase, not something a component can guess.
 */
type SelectValueChildren = ComponentProps<typeof KobalteSelect.Value>['children']

export type SelectValueProps = ComponentProps<typeof KobalteSelect.Value> & {
  /**
   * Read the display text from the selected option. Supply this when the option's
   * label does not live in a field called `label`, `name` or `textValue`.
   */
  optionLabel?: (option: unknown) => string
  /** Replace the default readout entirely, for a multiple-select summary. */
  children?: SelectValueChildren
}

/** Fields a label is read from, in order. See `SelectValueProps.optionLabel`. */
const LABEL_FIELDS = ['label', 'name', 'textValue'] as const

function labelFromOption(option: unknown): string {
  if (option === null || typeof option !== 'object') {
    return typeof option === 'string' ? option : ''
  }

  for (const field of LABEL_FIELDS) {
    const value = (option as Record<string, unknown>)[field]
    if (typeof value === 'string') return value
  }

  return ''
}

export function SelectValue(props: SelectValueProps) {
  const [local, rest] = splitProps(props, ['class', 'children', 'optionLabel'])

  const readLabel = (state: { selectedOption: () => unknown }): string => {
    const option = state.selectedOption()
    return local.optionLabel ? local.optionLabel(option) : labelFromOption(option)
  }

  return (
    <KobalteSelect.Value data-slot="select-value" class={cn('truncate', local.class)} {...rest}>
      {local.children ?? (readLabel as unknown as SelectValueChildren)}
    </KobalteSelect.Value>
  )
}

/**
 * The option list. The items themselves come from the root's `itemComponent`,
 * which is what makes a Select able to render a typed option rather than a
 * string; `children` here is for content above the list, such as a filter hint.
 */
export function SelectContent(props: ComponentProps<typeof KobalteSelect.Content>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteSelect.Portal>
      <KobalteSelect.Content
        class={cn(
          'bg-popover text-popover-foreground rounded-xl border border-border shadow-lg',
          'z-(--z-menu) max-h-(--kb-popper-content-available-height) min-w-[8rem] origin-(--kb-select-content-transform-origin) overflow-y-auto overflow-x-hidden',
          menuContentPadding,
          'data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95',
          'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          'data-expanded:duration-150 data-closed:duration-100',
          local.class
        )}
        {...rest}
      >
        {local.children}
        <KobalteSelect.Listbox class="flex flex-col" />
        <KobalteSelect.Arrow aria-hidden="true" class={popoverArrow} />
      </KobalteSelect.Content>
    </KobalteSelect.Portal>
  )
}

export function SelectItem(props: ComponentProps<typeof KobalteSelect.Item>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteSelect.Item class={cn(menuItem, 'pe-8', local.class)} {...rest}>
      <KobalteSelect.ItemLabel>{local.children}</KobalteSelect.ItemLabel>
      <KobalteSelect.ItemIndicator class="absolute end-2 flex size-4 items-center justify-center">
        <Check class="size-4" />
      </KobalteSelect.ItemIndicator>
    </KobalteSelect.Item>
  )
}

export function SelectSection(props: ComponentProps<typeof KobalteSelect.Section>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteSelect.Section class={cn('flex flex-col', local.class)} {...rest} />
}

export function SelectLabel(props: ComponentProps<typeof KobalteSelect.Label>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteSelect.Label
      class={cn('text-muted-foreground px-2 py-1.5 text-2xs font-medium uppercase', local.class)}
      {...rest}
    />
  )
}

/** The chevron pair used when a Select is composed by hand in a field. */
export function SelectChevronsUpDown(props: ComponentProps<'svg'>) {
  return <ChevronsUpDown aria-hidden="true" {...props} />
}
