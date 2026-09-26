import OtpField from '@corvu/otp-field'
import type { ComponentProps } from 'solid-js'
import { For, Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * InputOtp.
 *
 * A one-time code, entered into separate boxes. The boxes are the *paint*: the
 * value lives in a single real input, so paste works, autofill works, and a
 * password manager sees one field rather than six.
 *
 * That split is the whole reason to use a component rather than six inputs. Six
 * inputs cannot be pasted into, cannot be autofilled, and announce as six unrelated
 * fields — every one of which is a defect a user hits on the first try.
 *
 * corvu supplies the value handling, the caret movement, the paste split and the
 * keyboard behaviour.
 */
/**
 * `maxLength` is omitted rather than exposed: corvu requires it, and a caller who
 * has to set both it and `length` will eventually set them to different numbers.
 * `length` is the one input and it drives the other.
 */
export type InputOtpProps = Omit<ComponentProps<typeof OtpField>, 'maxLength'> & {
  /** How many characters. */
  length?: number
  /** Group the boxes into runs, e.g. `[3, 3]` for a six-character code. */
  groups?: readonly number[]
}

export function InputOtp(props: InputOtpProps) {
  const [local, rest] = splitProps(props, ['class', 'length', 'groups', 'children'])

  const length = () => local.length ?? 6
  const groups = () => local.groups ?? [length()]

  return (
    <OtpField
      maxLength={length()}
      class={cn('flex items-center gap-2', local.class)}
      {...rest}
      children={(field) => (
        <>
          <OtpField.Input
            aria-label={props['aria-label'] ?? 'One-time code'}
            class="absolute inset-0 opacity-0"
          />
          <For each={groups()}>
            {(size, groupIndex) => (
              <>
                <Show when={groupIndex() > 0}>
                  <span aria-hidden="true" class="text-muted-foreground px-1">
                    –
                  </span>
                </Show>
                <span class="flex items-center gap-1.5">
                  <For each={Array.from({ length: size })}>
                    {(_, index) => {
                      // The slot's index across the whole field, so the boxes after a
                      // group boundary continue counting rather than restarting.
                      const offset = groups()
                        .slice(0, groupIndex())
                        .reduce((total, run) => total + run, 0)
                      const slot = offset + index()
                      return (
                        <span
                          class={cn(
                            'border-input bg-transparent flex size-10 items-center justify-center rounded-md border text-sm font-medium',
                            'transition-[color,box-shadow,border-color] ease-out',
                            'data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-primary-subtle',
                            'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'
                          )}
                          data-active={field.activeSlots.includes(slot)}
                          data-disabled={props.disabled}
                        >
                          {field.value[slot] ?? ''}
                        </span>
                      )
                    }}
                  </For>
                </span>
              </>
            )}
          </For>
        </>
      )}
    />
  )
}

/**
 * A caret drawn inside the active box.
 *
 * Exported for a caller building its own slot: the box above renders the character
 * directly, and a blinking caret is the alternative when the field should look
 * empty until something is typed.
 */
export function InputOtpCaret(props: ComponentProps<'span'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <span
      aria-hidden="true"
      class={cn('animate-caret bg-foreground inline-block h-4 w-px', local.class)}
      {...rest}
    />
  )
}
