import { createUniqueId, Show, type JSX } from 'solid-js'
import { Badge } from '../../ui/badge'

/** Shared item summary and action frame for catalog-owned detail content. */
export function CatalogDetail(props: {
  title: string
  description: string
  category: string
  publisher: string
  publishedByLabel: (publisher: string) => string
  leading?: JSX.Element
  eyebrow?: string
  badges?: JSX.Element
  action?: JSX.Element
  status?: JSX.Element
  children?: JSX.Element
}) {
  return (
    <article class="grid min-w-0 gap-2" data-catalog-detail>
      <div class="flex min-w-0 items-start gap-3 rounded-xl border border-border p-3">
        <Show when={props.leading}>
          <span class="shrink-0">{props.leading}</span>
        </Show>
        <div class="grid min-w-0 flex-1 gap-1">
          <div class="flex min-w-0 flex-wrap items-center gap-1.5">
            <Show when={props.eyebrow}>
              <Badge variant="outline">{props.eyebrow}</Badge>
            </Show>
            <Badge variant="secondary">{props.category}</Badge>
            {props.badges}
          </div>
          <h2 class="text-base leading-tight font-semibold tracking-tight">{props.title}</h2>
          <p class="text-muted-foreground text-sm">{props.description}</p>
          <p class="text-muted-foreground text-xs">{props.publishedByLabel(props.publisher)}</p>
        </div>
        <Show when={props.action || props.status}>
          <div class="flex shrink-0 flex-col items-end gap-2">
            {props.action}
            {props.status}
          </div>
        </Show>
      </div>
      <div class="grid min-w-0 gap-2">{props.children}</div>
    </article>
  )
}

/** A shared compact row for host-specific fields, permissions, and copy. */
export function CatalogDetailSection(props: { title: string; children?: JSX.Element }) {
  const headingId = `catalog-detail-section-${createUniqueId()}`
  return (
    <section
      class="grid min-w-0 gap-1.5 rounded-xl border border-border p-3"
      aria-labelledby={headingId}
    >
      <h3
        id={headingId}
        class="text-2xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {props.title}
      </h3>
      <div class="grid min-w-0 gap-1.5">{props.children}</div>
    </section>
  )
}
