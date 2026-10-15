import {
  createMemo,
  For,
  Index,
  Match,
  Show,
  splitProps,
  Switch,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { cn } from '#lib/utils'
import { CodeBlock, InlineCode, type CodeBlockProps } from '../code-block'
import { parseMessageText, type MessageBlock, type MessageInline } from './parse-message-text'

/**
 * Message.
 *
 * One turn. The two speakers are laid out differently on purpose, and that is
 * the whole design:
 *
 * - **The person's turn is a bubble on the trailing edge** — short, bounded, and
 *   easy to find when scrolling back through a long session.
 * - **The assistant's turn is the page.** It has no surface, spans the reading
 *   column, and holds everything the agent did *for that request* — activity
 *   (a `Trace`), prose, code, a pending decision — in one place, so a turn
 *   reads as an answer with its working underneath it rather than as a chain of
 *   unrelated cards.
 *
 * `label` is the turn's accessible name ("You", "Assistant"): the avatar and
 * name are not drawn for every turn, because a transcript that repeats a speaker
 * on every line is one nobody reads, but the name must still be announced.
 * `streaming` sets `aria-busy`, which tells assistive technology to wait for the
 * turn to settle before reading it instead of announcing every token.
 *
 * `anchorId` is the stable identity `MessageScroller` uses to keep the reader's
 * place when older turns are inserted above it.
 */
export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageProps = Omit<ComponentProps<'article'>, 'role'> & {
  role: MessageRole
  /** The turn's accessible name. */
  label: string
  streaming?: boolean
  anchorId?: string
}

export function Message(props: MessageProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'role',
    'label',
    'streaming',
    'anchorId',
    'children',
  ])
  return (
    <article
      data-slot="message"
      data-role={local.role}
      data-anchor-id={local.anchorId}
      aria-label={local.label}
      aria-busy={local.streaming || undefined}
      class={cn(
        'group/message mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-2 py-2',
        // The engine may skip layout for turns far off screen; the intrinsic size
        // keeps the scrollbar honest while it does.
        '[content-visibility:auto] [contain-intrinsic-size:auto_6rem]',
        {
          'items-end ps-[clamp(0rem,12%,4rem)]': local.role === 'user',
          'items-stretch': local.role !== 'user',
        },
        local.class
      )}
      {...rest}
    >
      {local.children}
    </article>
  )
}

/** The speaker's mark and name, for the turns that draw one. */
export function MessageHeader(
  props: ComponentProps<'header'> & { avatar?: JSX.Element; time?: JSX.Element }
) {
  const [local, rest] = splitProps(props, ['class', 'avatar', 'time', 'children'])
  return (
    <header
      data-slot="message-header"
      class={cn('flex items-center gap-2 text-xs text-muted-foreground', local.class)}
      {...rest}
    >
      <Show when={local.avatar}>{local.avatar}</Show>
      <span class="font-medium text-foreground">{local.children}</span>
      <Show when={local.time}>
        <span class="tabular-nums">{local.time}</span>
      </Show>
    </header>
  )
}

/** The turn's parts, stacked. Gap is the rhythm between prose, activity and code. */
export function MessageContent(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <div
      data-slot="message-content"
      class={cn(
        'flex w-full max-w-3xl min-w-0 flex-col gap-3 font-content text-content',
        local.class
      )}
      {...rest}
    >
      {local.children}
    </div>
  )
}

/**
 * Actions that belong to the turn (copy, retry). Hidden until the turn is hovered
 * or focused so the column is not a wall of buttons, but never `display: none`:
 * a control that only exists under the pointer cannot be reached by keyboard,
 * and on a touch screen there is no hover, so coarse pointers always see them.
 */
export function MessageActions(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <div
      data-slot="message-actions"
      class={cn(
        'flex items-center gap-1 opacity-0 transition-opacity ease-out group-focus-within/message:opacity-100 group-hover/message:opacity-100 [@media(hover:none)]:opacity-100',
        local.class
      )}
      {...rest}
    >
      {local.children}
    </div>
  )
}

export function MessageFooter(props: ComponentProps<'footer'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <footer
      data-slot="message-footer"
      class={cn('flex min-w-0 items-center gap-2 text-xs text-muted-foreground', local.class)}
      {...rest}
    >
      {local.children}
    </footer>
  )
}

/** The props of a fenced block the host may set. */
export type MessageCodeBlockProps = Pick<
  CodeBlockProps,
  'loadHighlight' | 'maxHeight' | 'wrap' | 'showLineNumbers' | 'lineMarks' | 'lineLimit'
>

/** What the host is told about a fenced block when it chooses that block's props. */
export type MessageCodeBlockInfo = Readonly<{
  /** Position among the text's fenced blocks, from 0. */
  index: number
  language: string | undefined
  code: string
  complete: boolean
}>

/**
 * How `MessageText` draws citation markers. `count` is how many sources the host
 * has; a `[^n]` marker is a citation only when every `n` is within it. `render`
 * receives the 1-based source numbers and draws the marker, so the host decides
 * what a number means (`messageCitations` in the inline-citation composite does
 * this for a `Source` list).
 */
export type MessageCitations = Readonly<{
  count: number
  render: (numbers: readonly number[]) => JSX.Element
}>

export type MessageTextProps = Omit<ComponentProps<'div'>, 'children'> & {
  text: string
  /** True while text may still arrive: a trailing open fence renders as partial code. */
  streaming?: boolean
  /**
   * Forwarded to each fenced block, e.g. to supply a lazy highlighter. A function
   * chooses per block, which is how line marks reach a block: marks belong to the
   * host's knowledge of the code (a diff, a failing line), never to the text.
   */
  codeBlockProps?: MessageCodeBlockProps | ((block: MessageCodeBlockInfo) => MessageCodeBlockProps)
  /** Without it, `[^1]` stays the literal text it was written as. */
  citations?: MessageCitations
}

function sameBlock(a: MessageBlock | undefined, b: MessageBlock): boolean {
  return (
    a !== undefined &&
    a.kind === b.kind &&
    a.raw === b.raw &&
    (a.kind !== 'code' || (b.kind === 'code' && a.complete === b.complete))
  )
}

/**
 * Text, read safely.
 *
 * Renders `parseMessageText`'s blocks as elements: nothing is interpreted as
 * HTML and a link only becomes an anchor when its scheme is http, https or
 * mailto. Blocks are kept by *position* and reuse their previous parsed object
 * when unchanged, so a streaming turn updates the block that is growing and
 * leaves every earlier paragraph and code block — and any selection or focus
 * inside them — untouched.
 */
export function MessageText(props: MessageTextProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'text',
    'streaming',
    'codeBlockProps',
    'citations',
  ])
  let previous: readonly MessageBlock[] = []
  let previousCount = 0
  // Only the number of sources reaches the parser, so a new `render` function
  // does not reparse the text, and a changed count does.
  const citationCount = () => local.citations?.count ?? 0
  const blocks = createMemo(() => {
    const count = citationCount()
    if (count !== previousCount) previous = []
    previousCount = count
    const next = parseMessageText(local.text, {
      streaming: local.streaming,
      citations: count || undefined,
    })
    const merged = next.map((block, index) =>
      sameBlock(previous[index], block) ? previous[index]! : block
    )
    previous = merged
    return merged
  })
  // The nth fenced block, so a host can address it. Blocks keep their positions
  // while text streams in after them, so an index stays attached to its block.
  const codeIndexes = createMemo(() => {
    let next = 0
    return blocks().map((block) => (block.kind === 'code' ? next++ : -1))
  })
  const lastIsProse = () => {
    const last = blocks().at(-1)
    return last !== undefined && last.kind !== 'code'
  }
  return (
    <div data-slot="message-text" class={cn('flex min-w-0 flex-col gap-3', local.class)} {...rest}>
      <Index each={blocks()}>
        {(block, index) => (
          <BlockView
            block={block()}
            codeProps={local.codeBlockProps}
            codeIndex={() => codeIndexes()[index] ?? 0}
            citations={local.citations}
          />
        )}
      </Index>
      <Show when={local.streaming && lastIsProse()}>
        <span class="streaming-caret" aria-hidden="true" />
      </Show>
    </div>
  )
}

function BlockView(props: {
  block: MessageBlock
  codeProps?: MessageTextProps['codeBlockProps']
  codeIndex: () => number
  citations?: MessageCitations
}) {
  return (
    <Switch>
      <Match when={props.block.kind === 'code' && props.block}>
        {(block) => {
          const code = () => block() as Extract<MessageBlock, { kind: 'code' }>
          const chosen = () => {
            const choice = props.codeProps
            return typeof choice === 'function'
              ? choice({
                  index: props.codeIndex(),
                  language: code().language,
                  code: code().code,
                  complete: code().complete,
                })
              : choice
          }
          return (
            <CodeBlock
              code={code().code}
              language={code().language}
              complete={code().complete}
              {...chosen()}
            />
          )
        }}
      </Match>
      <Match when={props.block.kind === 'heading' && props.block}>
        {(block) => {
          const heading = () => block() as Extract<MessageBlock, { kind: 'heading' }>
          return (
            <p
              role="heading"
              aria-level={heading().level + 2}
              class="font-semibold text-foreground [overflow-wrap:anywhere]"
            >
              <Inline nodes={heading().inline} citations={props.citations} />
            </p>
          )
        }}
      </Match>
      <Match when={props.block.kind === 'list' && props.block}>
        {(block) => {
          const list = () => block() as Extract<MessageBlock, { kind: 'list' }>
          return (
            <Show
              when={list().ordered}
              fallback={
                <ul class="m-0 ms-5 flex list-disc flex-col gap-1 p-0 marker:text-muted-foreground">
                  <For each={list().items}>
                    {(item) => (
                      <li class="[overflow-wrap:anywhere]">
                        <Inline nodes={item} citations={props.citations} />
                      </li>
                    )}
                  </For>
                </ul>
              }
            >
              <ol
                start={list().start}
                class="m-0 ms-5 flex list-decimal flex-col gap-1 p-0 marker:text-muted-foreground"
              >
                <For each={list().items}>
                  {(item) => (
                    <li class="[overflow-wrap:anywhere]">
                      <Inline nodes={item} citations={props.citations} />
                    </li>
                  )}
                </For>
              </ol>
            </Show>
          )
        }}
      </Match>
      <Match when={props.block.kind === 'quote' && props.block}>
        {(block) => {
          const quote = () => block() as Extract<MessageBlock, { kind: 'quote' }>
          return (
            <blockquote class="m-0 border-s-2 border-border ps-3 whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
              <Inline nodes={quote().inline} citations={props.citations} />
            </blockquote>
          )
        }}
      </Match>
      <Match when={props.block.kind === 'paragraph' && props.block}>
        {(block) => {
          const paragraph = () => block() as Extract<MessageBlock, { kind: 'paragraph' }>
          return (
            <p class="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">
              <Inline nodes={paragraph().inline} citations={props.citations} />
            </p>
          )
        }}
      </Match>
    </Switch>
  )
}

function Inline(props: { nodes: readonly MessageInline[]; citations?: MessageCitations }) {
  return (
    <For each={props.nodes}>
      {(node) => (
        <Switch>
          <Match when={node.kind === 'text' && node}>
            {(text) => (text() as { text: string }).text}
          </Match>
          <Match when={node.kind === 'code' && node}>
            {(code) => <InlineCode>{(code() as { text: string }).text}</InlineCode>}
          </Match>
          <Match when={node.kind === 'strong' && node}>
            {(strong) => (
              <strong class="font-semibold">
                <Inline
                  nodes={(strong() as { children: readonly MessageInline[] }).children}
                  citations={props.citations}
                />
              </strong>
            )}
          </Match>
          <Match when={node.kind === 'em' && node}>
            {(em) => (
              <em>
                <Inline
                  nodes={(em() as { children: readonly MessageInline[] }).children}
                  citations={props.citations}
                />
              </em>
            )}
          </Match>
          <Match when={node.kind === 'link' && node}>
            {(link) => (
              <a
                href={(link() as { href: string }).href}
                target="_blank"
                rel="noreferrer noopener"
                class="text-primary underline underline-offset-2 hover:no-underline"
              >
                <Inline nodes={(link() as { children: readonly MessageInline[] }).children} />
              </a>
            )}
          </Match>
          <Match when={node.kind === 'cite' && node}>
            {(cite) => {
              const marker = () => cite() as { numbers: readonly number[]; raw: string }
              // The parser read this as a citation only while the host had sources;
              // if they have gone since, the marker is the text it was written as.
              return props.citations ? props.citations.render(marker().numbers) : marker().raw
            }}
          </Match>
        </Switch>
      )}
    </For>
  )
}
