import { createContext, createUniqueId, Show, useContext, type JSX } from 'solid-js'
import { Badge } from '../../ui/badge'
import { cva } from 'class-variance-authority'

type SectionsLayout = 'stacked' | 'columns'
const SectionsLayoutContext = createContext<() => SectionsLayout>((): SectionsLayout => 'stacked')
const sectionsVariants = cva('grid min-w-0', {
  variants: {
    layout: {
      stacked: 'gap-2',
      columns:
        'gap-4 rounded-xl border border-border p-3 md:auto-cols-fr md:grid-flow-col md:gap-0',
    },
  },
})
const sectionVariants = cva('grid min-w-0 content-start gap-1.5 wrap-anywhere', {
  variants: {
    layout: {
      stacked: 'rounded-xl border border-border p-3',
      columns:
        'md:border-s md:border-border md:px-3 md:first:border-s-0 md:first:ps-0 md:last:pe-0',
    },
  },
})

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
  /** Groups related fields in one padded card; stacks them on narrow screens. */
  sectionsLayout?: SectionsLayout
  children?: JSX.Element
}) {
  return (
    <article class="grid min-w-0 gap-2" data-catalog-detail>
      <div
        data-catalog-detail-header
        class="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-border p-3 sm:flex-nowrap"
      >
        <Show when={props.leading}>
          <span class="shrink-0">{props.leading}</span>
        </Show>
        <div data-catalog-detail-identity class="grid min-w-0 flex-1 gap-1 wrap-anywhere">
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
          <div
            data-catalog-detail-actions
            class="flex min-w-0 basis-full flex-col items-start gap-2 wrap-anywhere sm:max-w-xs sm:basis-auto sm:items-end"
          >
            {props.action}
            {props.status}
          </div>
        </Show>
      </div>
      <SectionsLayoutContext.Provider value={() => props.sectionsLayout ?? 'stacked'}>
        <div
          data-catalog-detail-sections
          data-layout={props.sectionsLayout ?? 'stacked'}
          class={sectionsVariants({ layout: props.sectionsLayout ?? 'stacked' })}
        >
          {props.children}
        </div>
      </SectionsLayoutContext.Provider>
    </article>
  )
}

/** A shared compact row for host-specific fields, permissions, and copy. */
export function CatalogDetailSection(props: { title: string; children?: JSX.Element }) {
  const layout = useContext(SectionsLayoutContext)
  const headingId = `catalog-detail-section-${createUniqueId()}`
  return (
    <section class={sectionVariants({ layout: layout() })} aria-labelledby={headingId}>
      <h3
        id={headingId}
        class="text-2xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {props.title}
      </h3>
      <div class="grid min-w-0 content-start gap-1.5">{props.children}</div>
    </section>
  )
}
