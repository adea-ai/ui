import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * SettingsSection and SettingsRow.
 *
 * A settings page is the most repetitive surface in any application, and the
 * one where drift is most visible: label sizes, control widths and description
 * placement all wander unless something fixes them.
 *
 * The row is a two-column layout at a fixed label width, so controls line up
 * down the page regardless of how long the labels are. That alignment is the
 * difference between a settings page that reads as designed and one that reads
 * as a form.
 *
 * `SettingsRow` puts the control on the trailing side and the label leading;
 * `SettingsField` stacks them for a control too wide for a row (a textarea, a
 * list). Both share the same label and description treatment.
 */
export function SettingsSection(
  props: ComponentProps<'section'> & {
    title: string
    description?: string
    /** A control for the section as a whole, e.g. a master toggle. */
    action?: JSX.Element
  }
) {
  const [local, rest] = splitProps(props, ['class', 'title', 'description', 'action', 'children'])

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
      <div class="divide-y divide-border rounded-xl border border-border">{local.children}</div>
    </section>
  )
}

/**
 * One setting: a label and description on the leading side, a control on the
 * trailing side.
 *
 * `label` is wired to the control through `aria-labelledby` when the control is
 * not already labelled, so a caller can pass a bare `Switch` and still get an
 * accessible name. The row does not invent an id per render — it derives one
 * from the label, which is stable across renders and readable in a snapshot.
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

  return (
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
        <div data-slot="settings-row-label" class="text-sm font-medium">
          {local.label}
        </div>
        <Show when={local.description}>
          <p class="max-w-prose text-sm text-muted-foreground text-pretty">{local.description}</p>
        </Show>
      </div>
      <div
        data-slot="settings-row-control"
        class={cn('shrink-0', local.orientation === 'vertical' && 'w-full')}
      >
        {local.children}
      </div>
    </div>
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
