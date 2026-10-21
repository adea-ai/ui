import { RadioGroup as Radio } from '@kobalte/core/radio-group'
import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { accents } from '../../../lib/accent-presets'
import { cn } from '../../../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'

/**
 * AccentPicker.
 *
 * A row of accent swatches with a leading "none" choice, for a setting that
 * overrides the accent it would otherwise inherit: a project's icon colour, a
 * workspace's colour over the app's. `null` is a real value, not an empty one:
 * it means "do not override", so the swatch row never has an unchecked state and
 * the control can say what the inherited colour is through `inheritLabel`.
 *
 * The swatches are the theme's own accent presets, each carrying its light and
 * dark colour and switching on the `dark` class, so a swatch is the colour the
 * setting will produce in whichever appearance is in force and the picker needs
 * no theme provider.
 */
export type AccentPickerProps = {
  /** The group's accessible name, e.g. "Icon colour". */
  label: string
  /** An accent preset id, or `null` for no override. */
  value: string | null
  onValueChange(value: string | null): void
  /** What `null` means here, e.g. "Inherit workspace accent". Also the first swatch's name and tooltip. */
  inheritLabel?: string
  disabled?: boolean
  class?: string
}

const NONE = '__none__'

export function AccentPicker(props: AccentPickerProps) {
  return (
    <Radio
      data-slot="swatch-picker"
      aria-label={props.label}
      value={props.value ?? NONE}
      disabled={props.disabled}
      onChange={(id) => props.onValueChange(id === NONE ? null : id)}
      class={cn('flex flex-wrap items-center gap-2', props.class)}
    >
      <SwatchItem id={NONE} label={props.inheritLabel ?? 'Inherit (default)'}>
        <InheritSwatch />
      </SwatchItem>
      <For each={accents}>
        {(accent) => (
          <SwatchItem id={accent.id} label={accent.label}>
            <span
              aria-hidden="true"
              class="block size-full rounded-full bg-(--swatch-light) dark:bg-(--swatch-dark)"
              style={{
                '--swatch-light': accent.light ?? 'currentColor',
                '--swatch-dark': accent.dark ?? accent.light ?? 'currentColor',
              }}
            />
          </SwatchItem>
        )}
      </For>
    </Radio>
  )
}

/**
 * The "inherit" swatch: a black disc with a red slash, the universal "no
 * override" mark. It is drawn rather than painted from a token so it reads the
 * same in every theme and appearance.
 */
function InheritSwatch() {
  return (
    <span
      aria-hidden="true"
      data-slot="swatch-inherit"
      class="relative block size-full overflow-hidden rounded-full bg-(--swatch-inherit)"
      style={{ '--swatch-inherit': '#000' }}
    >
      <span class="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 -rotate-45 bg-destructive" />
    </span>
  )
}

function SwatchItem(props: { id: string; label: string; children: JSX.Element }) {
  return (
    <Radio.Item value={props.id} data-accent-option={props.id} class="contents">
      <Radio.ItemInput class="peer" />
      <Tooltip>
        <TooltipTrigger
          as={Radio.ItemLabel}
          class={cn(
            'flex size-7 cursor-pointer items-center justify-center rounded-full border border-border p-0.5',
            'peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-primary-subtle',
            'data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary',
            'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
          )}
        >
          {props.children}
          <span class="sr-only">{props.label}</span>
        </TooltipTrigger>
        <TooltipContent>{props.label}</TooltipContent>
      </Tooltip>
    </Radio.Item>
  )
}
