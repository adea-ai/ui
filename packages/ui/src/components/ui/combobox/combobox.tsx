import { Combobox as KobalteCombobox } from '@kobalte/core/combobox'
import { Check, ChevronDown, X } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { menuContentPadding, menuItem, popoverArrow } from '#lib/overlay'
import { cn } from '#lib/utils'

/**
 * Combobox.
 *
 * A Select whose list is filterable by typing. The difference from Select is
 * not cosmetic: a Combobox has a text input, so the user can narrow forty
 * options to one without reading the list. Above roughly ten options the
 * search is the feature; below it, a Select is quieter and a RadioGroup is
 * better still.
 *
 * Kobalte supplies the filtering, the `aria-activedescendant` wiring, the
 * keyboard selection and the multiple-selection mode, which is the part a
 * hand-rolled version reliably gets wrong.
 */
export function Combobox<Option, OptGroup = never>(
  props: ComponentProps<typeof KobalteCombobox<Option, OptGroup>>
) {
  return <KobalteCombobox {...props} />
}

export function ComboboxControl(props: ComponentProps<typeof KobalteCombobox.Control>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteCombobox.Control
      class={cn(
        'border-input bg-transparent flex h-control-md w-full items-center gap-1.5 rounded-md border px-control-sm',
        'transition-[color,box-shadow,border-color] ease-out',
        'focus-within:border-ring focus-within:ring-3 focus-within:ring-primary-subtle',
        'data-[invalid]:border-destructive data-[invalid]:ring-3 data-[invalid]:ring-destructive-subtle',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        local.class
      )}
      {...rest}
    />
  )
}

export function ComboboxInput(props: ComponentProps<typeof KobalteCombobox.Input>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteCombobox.Input
      class={cn(
        'h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground',
        'disabled:cursor-not-allowed',
        local.class
      )}
      {...rest}
    />
  )
}

export function ComboboxTrigger(props: ComponentProps<typeof KobalteCombobox.Trigger>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteCombobox.Trigger
      class={cn(
        'text-muted-foreground flex shrink-0 items-center justify-center rounded-sm outline-none',
        'transition-colors ease-out hover:text-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'disabled:pointer-events-none disabled:opacity-50',
        local.class
      )}
      {...rest}
    >
      {local.children}
      <KobalteCombobox.Icon>
        <ChevronDown class="size-4" />
      </KobalteCombobox.Icon>
    </KobalteCombobox.Trigger>
  )
}

export function ComboboxContent(props: ComponentProps<typeof KobalteCombobox.Content>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteCombobox.Portal>
      <KobalteCombobox.Content
        class={cn(
          'bg-popover text-popover-foreground rounded-xl border border-border shadow-lg',
          'z-(--z-menu) max-h-72 min-w-(--kb-popper-anchor-width) origin-(--kb-combobox-content-transform-origin) overflow-hidden',
          'data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95',
          'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          'data-expanded:duration-150 data-closed:duration-100',
          local.class
        )}
        {...rest}
      >
        <KobalteCombobox.Listbox class={cn('max-h-72 overflow-y-auto', menuContentPadding)} />
        <KobalteCombobox.Arrow aria-hidden="true" class={popoverArrow} />
      </KobalteCombobox.Content>
    </KobalteCombobox.Portal>
  )
}

export function ComboboxItem(props: ComponentProps<typeof KobalteCombobox.Item>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteCombobox.Item class={cn(menuItem, 'pe-8', local.class)} {...rest}>
      <KobalteCombobox.ItemLabel>{local.children}</KobalteCombobox.ItemLabel>
      <KobalteCombobox.ItemIndicator class="absolute end-2 flex size-4 items-center justify-center">
        <Check class="size-4" />
      </KobalteCombobox.ItemIndicator>
    </KobalteCombobox.Item>
  )
}

export function ComboboxSection(props: ComponentProps<typeof KobalteCombobox.Section>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteCombobox.Section class={cn('flex flex-col', local.class)} {...rest} />
}

/** The clear affordance for a single-select Combobox with a value. */
export function ComboboxClear(props: { class?: string; onClear: () => void }) {
  return (
    <Show when={props.onClear}>
      <button
        type="button"
        aria-label="Clear selection"
        onClick={() => props.onClear()}
        class={cn(
          'text-muted-foreground flex size-4 shrink-0 items-center justify-center rounded-sm',
          'transition-colors ease-out outline-none hover:text-foreground',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
          props.class
        )}
      >
        <X class="size-3.5" />
      </button>
    </Show>
  )
}
