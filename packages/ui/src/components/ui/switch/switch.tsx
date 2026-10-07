import { Switch as KobalteSwitch } from '@kobalte/core/switch'
import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { useFormFieldControl } from '#lib/form-field'
import { cn } from '#lib/utils'

/**
 * Switch.
 *
 * For a setting that takes effect the moment it is flipped. The distinction
 * from Checkbox is behaviour, not looks: a switch applies immediately and
 * belongs in a settings row, while a checkbox is a value the user is still
 * composing and is applied when a form is submitted. A switch inside an unsaved
 * form is the mistake this split exists to prevent.
 *
 * `Switch.Input` renders a real hidden checkbox, so the control is
 * form-native, keyboard-operable, and its `aria-checked` follows the state the
 * user sees.
 */
export type SwitchProps = Omit<ComponentProps<typeof KobalteSwitch>, 'children'> & {
  /** ID for the hidden native switch input; useful with an external label. */
  inputId?: string
  controlClass?: string
  thumbClass?: string
  labelClass?: string
  descriptionClass?: string
  label?: JSX.Element
  description?: JSX.Element
  /**
   * Replaces the control and label. Omit it to get the default control beside
   * `label` and `description`; supply it to compose the parts yourself.
   */
  children?: JSX.Element
}

export function Switch(props: SwitchProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'controlClass',
    'thumbClass',
    'labelClass',
    'descriptionClass',
    'children',
    'label',
    'description',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-invalid',
    'aria-errormessage',
    'aria-busy',
    'id',
    'inputId',
    'title',
  ])
  const field = useFormFieldControl('control', {
    id: local.inputId ?? local.id,
    'aria-label': local['aria-label'],
    'aria-labelledby': local['aria-labelledby'],
    'aria-describedby': local['aria-describedby'],
    'aria-invalid': local['aria-invalid'],
    'aria-errormessage': local['aria-errormessage'],
  })

  return (
    <KobalteSwitch
      data-slot="switch"
      id={field ? undefined : local.id}
      title={local.title}
      class={cn('group/switch flex items-center gap-2.5', local.class)}
      {...rest}
    >
      {/* The name belongs on the input; see Checkbox for why. */}
      <KobalteSwitch.Input
        id={field?.id ?? local.inputId}
        aria-label={local['aria-label']}
        aria-labelledby={field?.['aria-labelledby'] ?? local['aria-labelledby']}
        aria-describedby={field?.['aria-describedby'] ?? local['aria-describedby']}
        aria-invalid={field?.['aria-invalid'] ?? local['aria-invalid']}
        aria-errormessage={field?.['aria-errormessage'] ?? local['aria-errormessage']}
        aria-busy={local['aria-busy']}
        title={local.title}
      />
      <KobalteSwitch.Control
        class={cn(
          'bg-input inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent',
          'transition-colors ease-out outline-none',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
          'data-[checked]:bg-primary',
          'data-[invalid]:border-destructive',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          local.controlClass
        )}
      >
        <KobalteSwitch.Thumb
          class={cn(
            'bg-background pointer-events-none block size-4 rounded-full shadow-xs',
            'transition-transform ease-out',
            'data-[checked]:translate-x-4',
            local.thumbClass
          )}
        />
      </KobalteSwitch.Control>
      {local.children ??
        (local.label || local.description ? (
          <div class="grid gap-0.5">
            {local.label ? (
              <KobalteSwitch.Label class={cn('text-sm leading-none font-medium', local.labelClass)}>
                {local.label}
              </KobalteSwitch.Label>
            ) : null}
            {local.description ? (
              <KobalteSwitch.Description
                class={cn('text-muted-foreground text-sm', local.descriptionClass)}
              >
                {local.description}
              </KobalteSwitch.Description>
            ) : null}
          </div>
        ) : null)}
    </KobalteSwitch>
  )
}

/**
 * The switch's own label. Valid only inside a `<Switch>`: it is Kobalte's label
 * for that root's control, and outside one there is nothing to associate with.
 * A label drawn *beside* a switch — a settings row with the control trailing —
 * is plain text, and the switch takes an `aria-label` instead.
 */
export function SwitchLabel(props: ComponentProps<typeof KobalteSwitch.Label>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteSwitch.Label class={cn('text-sm leading-none font-medium', local.class)} {...rest} />
  )
}

export function SwitchDescription(props: ComponentProps<typeof KobalteSwitch.Description>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteSwitch.Description class={cn('text-muted-foreground text-sm', local.class)} {...rest} />
  )
}
