import type { ComponentProps, JSX } from 'solid-js'
import { createUniqueId, Show, splitProps } from 'solid-js'
import { createFormFieldContext, FormFieldContext } from '../../../lib/form-field'
import { cn } from '../../../lib/utils'

/**
 * SettingsSection and SettingsRow.
 *
 * A settings page is the most repetitive surface in any application, and the
 * one where drift is most visible: label sizes, control widths and description
 * placement all wander unless something fixes them.
 *
 * The row is a two-column layout at a fixed label width, so controls line up
 * down the page regardless of how long the labels are. `SettingsRow` also
 * exposes its label and description through the shared form-field context to
 * the first control inside it. `SettingsField` is the visual stacked layout;
 * use `FormField` when the control needs label, help, or validation wiring.
 */
export function SettingsSection(
  props: ComponentProps<'section'> & {
    title: string
    description?: string
    /** A control for the section as a whole, e.g. a master toggle. */
    action?: JSX.Element
    /** Use a spaced content stack for fields, alerts, and cards instead of divided rows. */
    bodyLayout?: 'rows' | 'content'
  }
) {
  const [local, rest] = splitProps(props, [
    'class',
    'title',
    'description',
    'action',
    'bodyLayout',
    'children',
  ])

  return (
    <section
      data-slot="settings-section"
      class={cn('flex flex-col gap-4 px-5 py-5', local.class)}
      {...rest}
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-0.5">
          <h2 class="text-base font-semibold tracking-tight">{local.title}</h2>
          <Show when={local.description}>
            <p class="max-w-prose text-sm text-muted-foreground text-pretty">{local.description}</p>
          </Show>
        </div>
        <Show when={local.action}>
          <div class="flex shrink-0 items-center gap-2">{local.action}</div>
        </Show>
      </div>
      <div
        data-slot="settings-section-body"
        class={cn(
          local.bodyLayout === 'content'
            ? 'flex flex-col gap-4'
            : 'divide-y divide-border rounded-xl border border-border'
        )}
      >
        {local.children}
      </div>
    </section>
  )
}

/**
 * One setting: a label and description on the leading side, a control on the
 * trailing side.
 *
 * The label and description are linked to a shared control through field
 * context. An explicit `aria-label` or `aria-labelledby` on the control keeps
 * precedence; otherwise the visible row label names it.
 */
export function SettingsRow(
  props: ComponentProps<'div'> & {
    label: string
    description?: string
    /** Render a vertical stack when the control needs the full width. */
    orientation?: 'horizontal' | 'vertical'
    /** Hide the divider this row would otherwise contribute. */
    bare?: boolean
  }
) {
  const [local, rest] = splitProps(props, [
    'class',
    'label',
    'description',
    'orientation',
    'bare',
    'children',
  ])
  const rowId = createUniqueId()
  const labelId = `${rowId}-label`
  const descriptionId = `${rowId}-description`
  const field = createFormFieldContext({
    defaultControlId: rowId,
    labelId,
    descriptionId,
    hint: () => local.description,
    error: () => undefined,
    group: () => false,
  })

  return (
    <FormFieldContext.Provider value={field}>
      <div
        data-slot="settings-row"
        class={cn(
          'flex gap-4 p-4',
          local.orientation === 'vertical'
            ? 'flex-col'
            : 'flex-col sm:flex-row sm:items-center sm:justify-between',
          local.class
        )}
        {...rest}
      >
        <div class="flex min-w-0 flex-col gap-0.5">
          <div id={labelId} data-slot="settings-row-label" class="text-sm font-medium">
            {local.label}
          </div>
          <Show when={local.description}>
            <p id={descriptionId} class="max-w-prose text-sm text-muted-foreground text-pretty">
              {local.description}
            </p>
          </Show>
        </div>
        <div
          data-slot="settings-row-control"
          class={cn('shrink-0', local.orientation === 'vertical' && 'w-full')}
        >
          {local.children}
        </div>
      </div>
    </FormFieldContext.Provider>
  )
}

/** A stacked label-and-control pair, for a control too wide for a row. */
export function SettingsField(
  props: ComponentProps<'div'> & { label: string; description?: string; htmlFor?: string }
) {
  const [local, rest] = splitProps(props, ['class', 'label', 'description', 'htmlFor', 'children'])

  return (
    <div data-slot="settings-field" class={cn('flex flex-col gap-2 p-4', local.class)} {...rest}>
      <div class="flex flex-col gap-0.5">
        <label for={local.htmlFor} class="text-sm font-medium">
          {local.label}
        </label>
        <Show when={local.description}>
          <p class="max-w-prose text-sm text-muted-foreground text-pretty">{local.description}</p>
        </Show>
      </div>
      <div>{local.children}</div>
    </div>
  )
}

/** A settings page's scrolling body, with the header sticky at the top. */
export function SettingsPage(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="settings-page"
      class={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', local.class)}
      {...rest}
    />
  )
}
