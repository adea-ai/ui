import { BookOpen } from 'lucide-solid'
import { createSignal, For, Show, splitProps } from 'solid-js'
import { Button } from '../../ui/button'
import { TextLink } from '../../ui/text-link'
import { Trace, TraceDetail, TraceLine, type TraceProps } from '../../ui/trace'
import {
  SOURCE_SNIPPET_LIMIT,
  boundText,
  safeSourceUrl,
  sourceHost,
  sourceTitle,
  sourcesLabel,
  type Source,
} from './source'

/**
 * Sources.
 *
 * The links a reply used, as one `Trace` line — "Used 4 sources" — that expands
 * into the list. It lives under the answer with the rest of the agent's activity
 * rather than as a card of its own, because a reader who wants to check a claim
 * will open it and one who does not should not have to scroll past it. For a
 * marker inside a sentence use `InlineCitation`, which points at the same
 * `Source` shape; the two are numbered the same way (position in this list).
 *
 * ## What it will and will not say
 *
 * - **No sources, no line.** An empty list renders nothing: "Used 0 sources" is a
 *   claim about an answer that may simply not have been grounded.
 * - **A row is a link only with a safe address.** `http:`, `https:` and `mailto:`
 *   without embedded credentials (`safeSourceUrl`). Any other address is not
 *   linked and not printed — the row says the address was not linked, so the
 *   reader knows something was withheld instead of finding a dead title.
 * - **The host is read from the parsed URL**, never from the title, so a title
 *   that reads "docs.example.com" cannot make a link to somewhere else look like it.
 * - **Nothing is merged.** Two entries that share a URL are two rows, with their
 *   own numbers; the host may have cited two passages and the citations point at
 *   positions.
 * - **Hostile and long values are bounded.** Titles, hosts and snippets are
 *   clipped and stripped of direction overrides (`boundText`), and are only ever
 *   text nodes.
 * - **A long list is shown in pages.** Past `initialVisible` the rest is behind a
 *   button that names how many there are, so a 200-source answer is not 200 rows
 *   the moment it opens. The button stays in place and toggles, so focus is never
 *   left on a control that has just disappeared.
 */
export type SourcesProps = Omit<TraceProps, 'children'> & {
  sources: readonly Source[]
  /** Replaces the default "Used N sources" for another language or a different verb. */
  label?: string
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Rows shown before the "Show all" button. Default 25. */
  initialVisible?: number
}

const DEFAULT_VISIBLE = 25

export function Sources(props: SourcesProps) {
  const [local, rest] = splitProps(props, [
    'sources',
    'label',
    'open',
    'defaultOpen',
    'onOpenChange',
    'initialVisible',
  ])
  const [expanded, setExpanded] = createSignal(false)
  const limit = () => Math.max(1, Math.floor(local.initialVisible ?? DEFAULT_VISIBLE))
  const hidden = () => Math.max(0, local.sources.length - limit())
  const visible = () => (expanded() ? local.sources : local.sources.slice(0, limit()))

  return (
    <Show when={local.sources.length > 0}>
      <Trace aria-label="Sources" data-slot="sources" {...rest}>
        <TraceLine
          icon={<BookOpen />}
          title={local.label ?? sourcesLabel(local.sources.length)}
          open={local.open}
          defaultOpen={local.defaultOpen}
          onOpenChange={local.onOpenChange}
        >
          <TraceDetail>
            <ol class="m-0 flex list-none flex-col gap-2 p-0" aria-label="Sources used">
              <For each={visible()}>
                {(source, index) => <SourceRow source={source} position={index() + 1} />}
              </For>
            </ol>
            <Show when={hidden() > 0}>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                class="mt-1"
                aria-expanded={expanded()}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded() ? 'Show fewer sources' : `Show all ${local.sources.length} sources`}
              </Button>
            </Show>
          </TraceDetail>
        </TraceLine>
      </Trace>
    </Show>
  )
}

function SourceRow(props: { source: Source; position: number }) {
  const href = () => safeSourceUrl(props.source.url)
  const host = () => sourceHost(props.source.url)
  const title = () => sourceTitle(props.source)
  const snippet = () =>
    props.source.snippet ? boundText(props.source.snippet, SOURCE_SNIPPET_LIMIT) : ''
  // An address was supplied but is not one we link: say so rather than go silent.
  const withheld = () => props.source.url !== undefined && props.source.url !== '' && !href()

  return (
    <li data-slot="source" class="flex min-w-0 items-baseline gap-2">
      <span
        aria-hidden="true"
        class="w-5 shrink-0 text-end text-xs text-muted-foreground tabular-nums"
      >
        {props.position}
      </span>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <Show
          when={href()}
          fallback={
            <span class="text-sm text-foreground [overflow-wrap:anywhere]">
              <span class="visually-hidden">Source {props.position}: </span>
              {title()}
            </span>
          }
        >
          {(url) => (
            <TextLink
              href={url()}
              target="_blank"
              rel="noreferrer noopener"
              class="w-fit max-w-full text-sm [overflow-wrap:anywhere]"
            >
              <span class="visually-hidden">Source {props.position}: </span>
              {title()}
              <span class="visually-hidden"> (opens in a new tab)</span>
            </TextLink>
          )}
        </Show>
        <Show when={host() || withheld()}>
          <span class="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {host()}
            <Show when={withheld()}>{host() ? ' · ' : ''}Address not linked</Show>
          </span>
        </Show>
        <Show when={snippet()}>
          <p class="m-0 line-clamp-3 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {snippet()}
          </p>
        </Show>
      </div>
    </li>
  )
}
