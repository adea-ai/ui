import { ChevronDownIcon } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { createEffect, onMount, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

export type NativeSelectProps = ComponentProps<'select'> & {
  /** Initialize an uncontrolled selection after its native options mount. */
  defaultValue?: ComponentProps<'select'>['value']
}

function setSelectedValue(
  select: HTMLSelectElement,
  value: ComponentProps<'select'>['value'],
  multiple: boolean
) {
  if (value === undefined) return

  if (multiple && Array.isArray(value)) {
    const selected = new Set(value.map(String))
    for (const option of select.options) option.selected = selected.has(option.value)
    return
  }

  select.value = String(Array.isArray(value) ? (value[0] ?? '') : value)
}

function initializeDefaultSelection(
  select: HTMLSelectElement,
  value: ComponentProps<'select'>['value'],
  multiple: boolean
) {
  if (value === undefined) return

  const defaultValues =
    multiple && Array.isArray(value)
      ? new Set(value.map(String))
      : new Set([String(Array.isArray(value) ? (value[0] ?? '') : value)])

  for (const option of select.options) option.defaultSelected = defaultValues.has(option.value)
  setSelectedValue(select, value, multiple)
}

/**
 * NativeSelect.
 *
 * A styled native `<select>` for compact, finite choices. Use `Select` when the
 * list needs a custom popover, typed options, or runtime filtering; this keeps
 * the browser's built-in keyboard, form, option, and label behavior.
 *
 * Translated from shadcn/ui's MIT-licensed NativeSelect wrapper to SolidJS and
 * the Adea token system; see the root NOTICE for source and attribution.
 */
export function NativeSelect(props: NativeSelectProps) {
  const [local, rest] = splitProps(props, ['class', 'children', 'defaultValue'])
  let select: HTMLSelectElement | undefined

  // Set selection after native options exist; setting select.value before its
  // children are mounted makes browsers fall back to the first option.
  createEffect(() => {
    if (!select) return
    setSelectedValue(select, rest.value, Boolean(rest.multiple))
  })
  onMount(() => {
    if (select && rest.value === undefined) {
      initializeDefaultSelection(select, local.defaultValue, Boolean(rest.multiple))
    }
  })

  return (
    <span data-slot="native-select-wrapper" class="relative inline-flex min-w-0">
      <select
        ref={(element) => {
          select = element
        }}
        data-slot="native-select"
        class={cn(
          'h-control-md min-w-0 appearance-none rounded-md border border-input bg-transparent px-control-md pr-9 text-sm',
          'transition-[color,box-shadow,border-color] ease-out outline-none',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
          'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive-subtle',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
          local.class
        )}
        {...rest}
      >
        {local.children}
      </select>
      <ChevronDownIcon
        data-slot="native-select-icon"
        aria-hidden="true"
        class="pointer-events-none absolute end-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  )
}
