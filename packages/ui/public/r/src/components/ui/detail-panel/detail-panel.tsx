import { createUniqueId, Show, splitProps, type ComponentProps, type JSX } from 'solid-js'
import { X } from 'lucide-solid'
import { Button } from '../button'
import { cn } from '../../../lib/utils'

/**
 * DetailPanel.
 *
 * The companion surface to a list: something is selected over there, and its
 * detail is here. Every application grows one — an artifact, a task, a member, a
 * file, a commit — and every one of them is a header, a body, and a way to close.
 *
 * It is an `<aside>` with a label, not a `<div>`. That is the whole reason it is a
 * component: a detail panel is a *second region* next to the main content, and a
 * screen reader user needs to be able to skip to it, name it, and know when it
 * appeared. A div with a heading inside is invisible to that navigation. The
 * label is wired to the title by id, so the panel announces itself as the thing
 * it is showing rather than as "complementary".
 *
 * The header is sticky and the body scrolls, because a detail panel is usually
 * taller than its viewport and the close affordance must not scroll away — the
 * panel is dismissed far more often than it is read to the end.
 *
 * `DetailPanelSection` is the repeating unit of a detail body: a small caption
 * and its value. Definition-list semantics, because these are facets of one
 * subject rather than a table with columns to compare.
 */
export type DetailPanelProps = ComponentProps<'aside'> & {
  /** The panel's name, for its accessible label. Usually the selected item's name. */
  label: string
}

export function DetailPanel(props: DetailPanelProps) {
  const [local, rest] = splitProps(props, ['label', 'class', 'children'])

  return (
    <aside
      class={cn(
        'flex h-full min-h-0 flex-col overflow-hidden border-l border-border bg-card',
        local.class
      )}
      aria-label={local.label}
      {...rest}
    >
      {local.children}
    </aside>
  )
}

export type DetailPanelHeaderProps = ComponentProps<'header'> & {
  /** A small caption above the title: what kind of thing this is. */
  eyebrow?: string
  title: string
  /** Trailing controls, before the close button. */
  actions?: JSX.Element
  onDismiss?: () => void
  /** Accessible name for the dismiss control. Defaults to `Dismiss <title>`. */
  dismissLabel?: string
}

export function DetailPanelHeader(props: DetailPanelHeaderProps) {
  const [local, rest] = splitProps(props, [
    'eyebrow',
    'title',
    'actions',
    'onDismiss',
    'dismissLabel',
    'class',
    'children',
  ])
  const titleId = createUniqueId()

  return (
    <header
      class={cn(
        'sticky top-0 z-(--z-sticky) flex shrink-0 items-start justify-between gap-3 border-b border-border bg-card px-4 py-3',
        local.class
      )}
      {...rest}
    >
      <div class="min-w-0">
        <Show when={local.eyebrow}>
          <p class="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
            {local.eyebrow}
          </p>
        </Show>
        <h2 id={titleId} class="truncate text-sm font-semibold text-foreground">
          {local.title}
        </h2>
        {local.children}
      </div>
      <div class="flex shrink-0 items-center gap-1">
        {local.actions}
        <Show when={local.onDismiss}>
          {(dismiss) => (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={local.dismissLabel ?? `Dismiss ${local.title}`}
              onClick={() => dismiss()()}
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </Show>
      </div>
    </header>
  )
}

export function DetailPanelBody(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <div class={cn('min-h-0 flex-1 overflow-y-auto px-4 py-3', local.class)} {...rest}>
      {local.children}
    </div>
  )
}

/**
 * A group of related facets. Renders a `<dl>`, so its children are
 * `DetailPanelField`s; a section whose content is not name/value pairs — a
 * preview, a list, a form — belongs directly in `DetailPanelBody` with its own
 * layout rather than inside this.
 */
export function DetailPanelSection(props: ComponentProps<'dl'> & { title: string }) {
  const [local, rest] = splitProps(props, ['title', 'class', 'children'])

  return (
    <div class="grid gap-2">
      <h3 class="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {local.title}
      </h3>
      <dl class={cn('grid gap-2', local.class)} {...rest}>
        {local.children}
      </dl>
    </div>
  )
}

/**
 * One facet: a name and its value. `muted` is for a value that is absent or
 * unknown, so "—" reads as *no value* rather than as a value that happens to be
 * a dash.
 */
export function DetailPanelField(props: {
  name: string
  value?: JSX.Element
  /** Render the value in the muted colour: an absent, unknown, or inherited value. */
  muted?: boolean
}) {
  return (
    <div class="flex items-baseline justify-between gap-4 text-sm">
      <dt class="text-muted-foreground">{props.name}</dt>
      <dd class={cn('text-right', props.muted ? 'text-muted-foreground' : 'text-foreground')}>
        {props.value ?? '—'}
      </dd>
    </div>
  )
}
