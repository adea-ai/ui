import { RadioGroup as Radio } from '@kobalte/core/radio-group'
import { ChevronDown, ImageUp, Trash2 } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { For, Show, createSignal, createUniqueId, splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { cn } from '#lib/utils'
import { Button } from '../../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import {
  MarkImageError,
  markImageFromFile,
  markImageProblemCopy,
  MARK_IMAGE_MAX_SOURCE_BYTES,
} from './image-data-url'
import { resolveShellIcon, shellIconEntries, shellIconLabel } from './shell-icons'

/**
 * IconPicker.
 *
 * The control behind "choose an icon" for a workspace or a project: a grid of
 * curated glyphs, and optionally an uploaded picture in their place.
 *
 * It is a single-choice group. The glyph grid is a Kobalte radio group, so
 * arrow keys move the choice and Tab enters and leaves the grid as one stop,
 * which is the contract a 56-cell grid needs to stay usable from a keyboard. An
 * uploaded image is a separate state, not a 57th cell: while `image` is set no
 * glyph is checked, and choosing a glyph asks the caller to drop the image, so
 * the stored mark is never both.
 *
 * The picker does not persist anything. The caller owns `value` and `image`
 * and saves them with the rest of its form; the image arrives already resized
 * to the stored square (see `markImageFromFile`).
 */
export type IconPickerProps = {
  /** The group's accessible name, e.g. "Workspace icon". */
  label: string
  /** The checked icon key; ignored while `image` is set. */
  value: string | undefined
  onValueChange(key: string): void
  /** The key the surface treats as unset, labelled "default" in the grid. */
  defaultKey?: string
  /** An uploaded mark (a data URL) currently chosen in place of a glyph. */
  image?: string
  /**
   * Called with the resized upload, or `undefined` for Remove. Omit it for a
   * surface that offers glyphs only; the upload row then does not render.
   */
  onImageChange?(image: string | undefined): void
  disabled?: boolean
  class?: string
}

export function IconPicker(props: IconPickerProps) {
  const inputId = createUniqueId()
  const [problem, setProblem] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)
  const [fileInput, setFileInput] = createSignal<HTMLInputElement>()

  const upload = async (file: File | undefined) => {
    if (!file || !props.onImageChange) return
    setProblem(undefined)
    setBusy(true)
    try {
      props.onImageChange(await markImageFromFile(file))
    } catch (error) {
      setProblem(
        markImageProblemCopy[error instanceof MarkImageError ? error.problem : 'unreadable']
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-slot="icon-picker" class={cn('flex flex-col gap-3', props.class)}>
      <Show when={props.onImageChange}>
        <div class="flex items-center gap-3" data-slot="icon-picker-upload">
          <span
            aria-hidden="true"
            class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
          >
            <Show
              when={props.image}
              fallback={<ImageUp class="size-5 text-muted-foreground" aria-hidden="true" />}
            >
              {(src) => <img src={src()} alt="" class="size-full object-cover" />}
            </Show>
          </span>
          <div class="flex flex-wrap items-center gap-2">
            <input
              ref={setFileInput}
              id={inputId}
              type="file"
              class="sr-only"
              tabIndex={-1}
              // The visible button drives this input; hide the duplicate from assistive
              // technology but keep a name so the form-label rule is satisfied.
              aria-hidden="true"
              aria-label={props.image ? 'Replace image' : 'Upload image'}
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={props.disabled}
              onChange={(event) => {
                const input = event.currentTarget
                void upload(input.files?.[0])
                // Clearing the value lets the same file be chosen again after Remove.
                input.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={props.disabled || busy()}
              onClick={() => fileInput()?.click()}
            >
              <ImageUp aria-hidden="true" />
              {props.image ? 'Replace image' : 'Upload image'}
            </Button>
            <Show when={props.image}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={props.disabled || busy()}
                onClick={() => {
                  setProblem(undefined)
                  props.onImageChange?.(undefined)
                }}
              >
                <Trash2 aria-hidden="true" />
                Remove image
              </Button>
            </Show>
          </div>
        </div>
        <Show when={problem()}>
          {(message) => (
            <p role="alert" class="text-sm text-destructive">
              {message()}
            </p>
          )}
        </Show>
        <p class="text-xs text-muted-foreground">
          PNG, JPEG, WebP or GIF up to {MARK_IMAGE_MAX_SOURCE_BYTES / 1024 / 1024} MB. It is cropped
          to a square.
        </p>
      </Show>
      <Radio
        aria-label={props.label}
        value={props.image ? '' : (props.value ?? '')}
        disabled={props.disabled}
        onChange={(key) => {
          if (key) props.onValueChange(key)
        }}
        class="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5"
      >
        <For each={shellIconEntries}>
          {(entry) => {
            const Icon = resolveShellIcon(entry.key)
            return (
              <Radio.Item value={entry.key} class="contents">
                <Radio.ItemInput class="peer" />
                <Radio.ItemLabel
                  title={entry.key === props.defaultKey ? `${entry.label} (default)` : entry.label}
                  class={cn(
                    'flex size-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-muted-foreground',
                    'transition-colors ease-out',
                    'hover:bg-surface-hover hover:text-foreground',
                    'peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-primary-subtle',
                    'data-[checked]:border-primary data-[checked]:bg-primary-subtle data-[checked]:text-primary',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
                  )}
                >
                  <Icon class="size-5" aria-hidden="true" />
                  <span class="sr-only">
                    {entry.label}
                    {entry.key === props.defaultKey ? ' (default)' : ''}
                  </span>
                </Radio.ItemLabel>
              </Radio.Item>
            )
          }}
        </For>
      </Radio>
    </div>
  )
}

/**
 * IconPickerDropdown.
 *
 * The compact form of the picker for a settings row: one button showing the
 * current mark, opening the full grid (and the upload row, when the host offers
 * it) in a popover. Choosing a glyph applies it and closes the popover; an
 * upload or Remove leaves it open so the result is visible. The host owns the
 * value exactly as it does for `IconPicker`.
 */
export type IconPickerDropdownProps = IconPickerProps & {
  /** The mark shown on the trigger; defaults to the checked glyph or the uploaded image. */
  trigger?: JSX.Element
}

export function IconPickerDropdown(props: IconPickerDropdownProps) {
  const [open, setOpen] = createSignal(false)
  const [local, picker] = splitProps(props, ['trigger', 'class'])
  const Current = () => resolveShellIcon(props.value ?? props.defaultKey ?? '')
  return (
    <Popover open={open()} onOpenChange={setOpen} placement="bottom-start">
      <PopoverTrigger
        as={Button}
        type="button"
        variant="outline"
        data-slot="icon-picker-trigger"
        aria-label={`${props.label}: ${props.image ? 'uploaded image' : shellIconLabel(props.value ?? props.defaultKey ?? '')}`}
        disabled={props.disabled}
        class={cn('gap-2', local.class)}
      >
        <span aria-hidden="true" class="flex size-5 items-center justify-center overflow-hidden">
          <Show
            when={local.trigger}
            fallback={
              <Show
                when={props.image}
                fallback={<Dynamic component={Current()} class="size-4" aria-hidden="true" />}
              >
                {(src) => <img src={src()} alt="" class="size-full rounded-sm object-cover" />}
              </Show>
            }
          >
            {local.trigger}
          </Show>
        </span>
        <ChevronDown class="size-4 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent class="w-[min(22rem,var(--kb-popper-available-width))]">
        <IconPicker
          {...picker}
          onValueChange={(key) => {
            picker.onValueChange(key)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
