import { createUniqueId, Show, type JSX } from 'solid-js'
import { Badge } from '../../ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '../../ui/card'

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
    <article class="grid min-w-0 gap-4" data-catalog-detail>
      <Card>
        <CardHeader class="flex-row items-start gap-3">
          <Show when={props.leading}>
            <span class="shrink-0">{props.leading}</span>
          </Show>
          <div class="grid min-w-0 gap-1.5">
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
        </CardHeader>
        <CardFooter class="flex-wrap justify-between gap-3">
          {props.action}
          {props.status}
        </CardFooter>
      </Card>
      <div class="grid min-w-0 gap-3">{props.children}</div>
    </article>
  )
}

/** A shared surface and heading for host-specific fields, permissions, and copy. */
export function CatalogDetailSection(props: { title: string; children?: JSX.Element }) {
  const headingId = `catalog-detail-section-${createUniqueId()}`
  return (
    <section class="min-w-0" aria-labelledby={headingId}>
      <Card>
        <CardHeader>
          <h3 id={headingId} class="text-sm font-semibold tracking-tight">
            {props.title}
          </h3>
        </CardHeader>
        <CardContent class="grid min-w-0 gap-3">{props.children}</CardContent>
      </Card>
    </section>
  )
}
