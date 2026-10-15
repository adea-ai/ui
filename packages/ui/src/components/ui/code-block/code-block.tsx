import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
  splitProps,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { Check, Copy } from 'lucide-solid'
import { Button } from '../button'
import { cn } from '#lib/utils'

/**
 * CodeBlock.
 *
 * A fenced block, rendered as a surface. The library ships no highlighter —
 * syntax colouring is a large dependency with its own theme format, and a
 * component that bundled one would force every consumer to pay for it. This
 * renders the block, its chrome, and its behaviour; a caller that wants
 * highlighting passes the result through `highlight`, which is the seam a
 * Shiki/Pierre/Prism integration plugs into.
 *
 * Four details are the reason this exists rather than a styled `<pre>`:
 *
 * **Copy confirms only on success.** `navigator.clipboard.writeText` rejects
 * outside a secure context, in a sandboxed frame, and when the document is not
 * focused. Flipping to a tick unconditionally confirms a copy that did not
 * happen, and the reader pastes something stale and does not know why. The
 * rejection is caught and the button reports the failure instead.
 *
 * **A tall block repeats its action row at the bottom.** Copying from a block
 * that is taller than the viewport otherwise costs a scroll back to the top and
 * another scroll down to where you were. The threshold is a fixed 480px rather
 * than viewport-relative so the behaviour does not change when the window is
 * resized.
 *
 * **The scroller is focusable and named.** A horizontally scrollable region has
 * to be reachable by keyboard — this is axe's `scrollable-region-focusable`, and
 * a region that scrolls but cannot be focused is a WCAG 2.1.1 failure. It is a
 * `region` with a label rather than a bare `tabindex`, so the tab stop announces
 * what it is.
 *
 * **Resolving a streaming block must not move the reader.** When `complete` is
 * false the block shows the code it has plus a generating indicator; the
 * indicator is inside the scroller's own box and does not add a line, because a
 * block that grows the moment its content resolves shifts everything below it.
 * If a caller's `highlight` changes the line box, that is the caller's height to
 * hold — `lineHeight` is a prop for exactly that reason.
 *
 * ## Output, not only source
 *
 * The same surface carries terminal output, logs and diffs inside an agent's
 * activity, so it also:
 *
 * - **loads its highlighter lazily** (`loadHighlight`). The grammar is fetched
 *   only for a block that is complete and has a language, the block renders plain
 *   until it arrives, and a loader that returns nothing — an unknown language, a
 *   failed fetch — leaves the plain text in place without an error. Highlighting
 *   a block on every streamed delta would re-tokenise the whole thing per token,
 *   so a streaming block stays plain until `complete`.
 * - **marks lines** (`lineMarks`) as added, removed, highlighted or failed. A mark
 *   is carried by a gutter glyph and by `<ins>`/`<del>` for the two that change
 *   text, never by colour alone, and the glyph is not selectable so a copied
 *   selection stays the source.
 * - **copies the source exactly.** The copy button writes `code` as given: no
 *   trailing-newline trimming, no line numbers, no gutter glyphs, and the whole
 *   block even when only part of it is rendered (`lineLimit`).
 * - **bounds a large render.** Past `lineLimit` lines the per-line renderer shows
 *   the first lines and a control to show the rest, because tens of thousands of
 *   row elements are a freeze, not a transcript. The plain renderer is a single
 *   text node and needs no limit.
 * - **comes in a small size** (`size="sm"`) for tool output inside a Trace line.
 */
export type CodeBlockProps = Omit<ComponentProps<'div'>, 'children' | 'onCopy'> & {
  code: string
  /** The language, shown in the header and used as the region's label. */
  language?: string
  /** The code, transformed — highlighted HTML or a component. Omit for plain text. */
  highlight?: (code: string) => JSX.Element
  /** False while the block is still streaming. Adds a generating indicator. */
  complete?: boolean
  /** A filename or title, shown instead of the language. */
  title?: string
  /** Extra header controls, before the copy button. */
  actions?: JSX.Element
  /** Copy label. Override for a non-English application. */
  copyLabel?: string
  copiedLabel?: string
  /** Line height of the rendered code. Set it when `highlight` changes the box. */
  lineHeight?: string
  /** A line-number gutter. Off by default; a short snippet rarely needs one. */
  showLineNumbers?: boolean
  /** The height above which the action row is repeated below the block. */
  tallThreshold?: number
  /**
   * Cap the code body's height and scroll it vertically past that. A number is
   * pixels; a string is any CSS length (`'20rem'`, `'50vh'`). Unset, the block
   * grows with its content.
   */
  maxHeight?: number | string
  /**
   * Soft-wrap long lines inside the block instead of scrolling sideways. Off by
   * default: wrapped code loses its column alignment, so it is for prose-like
   * output (logs, long commands) in a narrow column. Wraps the plain renderer and
   * any `pre` inside `highlight` output; line numbers stay on the first visual line.
   */
  wrap?: boolean
  /** `sm` is the compact chrome for output nested inside a Trace line. */
  size?: 'default' | 'sm'
  /**
   * Marks on 1-based line numbers. Applies to the per-line renderer, which is
   * used whenever marks or line numbers are present and no `highlight` is given.
   */
  lineMarks?: Readonly<Record<number, CodeLineMark>>
  /**
   * Resolve a highlighter for the block's language. Called once the block is
   * complete; resolving to `undefined` (or rejecting) keeps the plain rendering.
   */
  loadHighlight?: (language: string | undefined) => Promise<CodeHighlighter | undefined>
  /** Lines the per-line renderer shows before offering the rest. Default 2000. */
  lineLimit?: number
  /** Called after each copy attempt with whether the clipboard accepted it. */
  onCopy?: (ok: boolean) => void
}

export type CodeLineMark = 'add' | 'remove' | 'highlight' | 'error'
export type CodeHighlighter = (code: string) => JSX.Element

/** Lines the per-line renderer shows before it offers the rest. */
export const CODE_BLOCK_LINE_LIMIT = 2_000

/** The height a block must exceed before its actions are repeated. */
export const TALL_CODE_BLOCK_PX = 480

/**
 * Copy, reporting whether it worked. `navigator.clipboard` is absent in an
 * insecure context, and `writeText` rejects when the document is not focused —
 * both are normal in an embedded or iframed application, and neither should
 * silently look like success.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function CodeBlock(props: CodeBlockProps) {
  const [local, rest] = splitProps(props, [
    'code',
    'language',
    'highlight',
    'complete',
    'title',
    'actions',
    'copyLabel',
    'copiedLabel',
    'lineHeight',
    'showLineNumbers',
    'tallThreshold',
    'maxHeight',
    'wrap',
    'size',
    'lineMarks',
    'loadHighlight',
    'lineLimit',
    'onCopy',
    'class',
    'ref',
  ])

  const [copied, setCopied] = createSignal(false)
  const [failed, setFailed] = createSignal(false)
  const [tall, setTall] = createSignal(false)

  const [loaded, setLoaded] = createSignal<CodeHighlighter>()
  const [showAll, setShowAll] = createSignal(false)
  let bodyElement: HTMLDivElement | undefined

  // A language string can come from untrusted model output. It is rendered as
  // text, so it cannot inject markup; the cap keeps a pathological one from
  // swallowing the header.
  const language = () => local.language?.trim().slice(0, 40) || undefined
  const label = () => local.title ?? language() ?? 'code'
  const regionLabel = () => (language() ? `${language()} code` : 'code')
  const small = () => local.size === 'sm'
  const lines = createMemo(() => local.code.replace(/\n$/, '').split('\n'))
  const lineLimit = () => local.lineLimit ?? CODE_BLOCK_LINE_LIMIT
  const visibleLines = createMemo(() => (showAll() ? lines() : lines().slice(0, lineLimit())))
  const hiddenLines = () => lines().length - visibleLines().length
  const perLine = () =>
    local.highlight === undefined &&
    (local.showLineNumbers === true || local.lineMarks !== undefined)

  // Load once the block has stopped changing. `on` keys the effect to the
  // language and completion, not to every streamed character, and a stale
  // resolution (the language changed while the grammar was in flight) is dropped.
  createEffect(
    on(
      () => [local.complete, language(), local.loadHighlight] as const,
      ([complete, lang, load]) => {
        setLoaded(undefined)
        if (!complete || !load || local.highlight) return
        let current = true
        onCleanup(() => (current = false))
        // Wrapped, not called bare: a loader that throws before it returns a promise
        // (a bad import path, a missing grammar table) must degrade to plain text
        // like one that rejects, not tear down the tree from inside this effect.
        new Promise<CodeHighlighter | undefined>((resolve) => resolve(load(lang))).then(
          (highlighter) => {
            if (current && highlighter) setLoaded(() => highlighter)
          },
          () => undefined
        )
      }
    )
  )
  const highlighter = (): CodeHighlighter | undefined => local.highlight ?? loaded()
  const maxHeight = () =>
    typeof local.maxHeight === 'number' ? `${local.maxHeight}px` : local.maxHeight

  const copy = async () => {
    const ok = await copyText(local.code)
    setCopied(ok)
    setFailed(!ok)
    local.onCopy?.(ok)
    if (ok) setTimeout(() => setCopied(false), 1500)
  }

  const Actions = () => (
    <div class="flex items-center gap-1 opacity-0 transition-opacity group-focus-within/code:opacity-100 group-hover/code:opacity-100 [@media(hover:none)]:opacity-100">
      {local.actions}
      <Button
        variant="ghost"
        size="icon-2xs"
        touchTarget="comfortable"
        aria-label={copied() ? (local.copiedLabel ?? 'Copied') : (local.copyLabel ?? 'Copy code')}
        title={failed() ? 'Copying is unavailable in this context' : undefined}
        onClick={() => void copy()}
      >
        <Show when={copied()} fallback={<Copy aria-hidden="true" />}>
          <Check aria-hidden="true" />
        </Show>
      </Button>
    </div>
  )

  return (
    <div
      data-slot="code-block"
      data-size={local.size ?? 'default'}
      class={cn(
        'group/code overflow-hidden border border-border bg-card',
        small() ? 'rounded-lg' : 'rounded-xl',
        local.class
      )}
      {...rest}
      ref={(element) => {
        // Composed rather than replaced: a caller's ref must survive.
        if (typeof local.ref === 'function') local.ref(element)
        else if (local.ref) local.ref = element
        // Measured rather than assumed: the caller controls the content, so only
        // the rendered box can say whether the action row has scrolled away.
        const observer = new ResizeObserver(() => {
          setTall(element.offsetHeight > (local.tallThreshold ?? TALL_CODE_BLOCK_PX))
        })
        observer.observe(element)
        onCleanup(() => observer.disconnect())
      }}
    >
      <div
        class={cn('flex items-center justify-between gap-2', small() ? 'px-2 py-0.5' : 'px-3 py-1')}
      >
        <span class="truncate font-code text-code text-muted-foreground">{label()}</span>
        <Actions />
      </div>
      <div
        ref={(element) => (bodyElement = element)}
        data-slot="code-block-body"
        data-wrap={local.wrap ? '' : undefined}
        class={cn('scroll-fade overflow-x-auto', {
          // A capped body scrolls on both axes; the region is already a tab stop,
          // so the keyboard reaches the vertical overflow the same way.
          'overflow-y-auto': local.maxHeight !== undefined,
          '[&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]': local.wrap,
        })}
        style={maxHeight() === undefined ? undefined : { 'max-height': maxHeight() }}
        // A region that scrolls must be focusable, and a tab stop needs a name.
        tabindex="0"
        role="region"
        aria-label={regionLabel()}
      >
        <Show
          when={highlighter()}
          fallback={
            <pre
              class={cn('m-0', small() ? 'px-2 py-1.5' : 'px-3 py-2')}
              style={{ 'line-height': local.lineHeight ?? '1.5' }}
            >
              <code class="font-code text-code">
                <Show when={perLine()} fallback={local.code.replace(/\n$/, '')}>
                  <For each={visibleLines()}>
                    {(line, index) => (
                      <CodeLine
                        line={line}
                        number={index() + 1}
                        numbered={local.showLineNumbers === true}
                        mark={local.lineMarks?.[index() + 1]}
                        wrap={local.wrap === true}
                      />
                    )}
                  </For>
                </Show>
              </code>
            </pre>
          }
        >
          {(highlight) => (
            <div class={small() ? 'px-2 py-1.5' : 'px-3 py-2'}>{highlight()(local.code)}</div>
          )}
        </Show>
        <Show when={perLine() && hiddenLines() > 0}>
          <div class="flex items-center gap-2 border-t border-border px-3 py-1 text-xs text-muted-foreground">
            <span>
              Showing the first {visibleLines().length.toLocaleString()} of{' '}
              {lines().length.toLocaleString()} lines.
            </span>
            <Button
              variant="ghost"
              size="2xs"
              onClick={() => {
                setShowAll(true)
                // This button leaves the document with the click; the scroller
                // is the nearest place focus can stay, so a keyboard user keeps their place.
                bodyElement?.focus({ preventScroll: true })
              }}
            >
              Show all {lines().length.toLocaleString()} lines
            </Button>
          </div>
        </Show>
        {/*
          In the scroller's box, and a single line: the indicator must not add
          height when it disappears, or a streaming block shifts everything below
          it as it resolves.
        */}
        <Show when={!local.complete}>
          <p class="px-3 pb-2 text-xs text-muted-foreground italic">Generating…</p>
        </Show>
      </div>
      <Show when={tall()}>
        <div
          data-code-block-footer=""
          class="flex items-center justify-end border-t border-transparent px-3 py-1 transition-colors group-focus-within/code:border-border group-hover/code:border-border"
        >
          <Actions />
        </div>
      </Show>
    </div>
  )
}

const MARK_GLYPH: Readonly<Record<CodeLineMark, string>> = {
  add: '+',
  remove: '−',
  highlight: '',
  error: '!',
}

/**
 * One rendered line. The gutter glyph and the element (`ins`/`del`) carry what a
 * mark means so it survives greyscale and a screen reader; both gutters are
 * unselectable so dragging across the block and copying yields only source.
 */
function CodeLine(props: {
  line: string
  number: number
  numbered: boolean
  mark?: CodeLineMark
  wrap: boolean
}) {
  const content = () => (
    <>
      <Show when={props.numbered}>
        <span class="text-right text-muted-foreground select-none" aria-hidden="true">
          {props.number}
        </span>
      </Show>
      <span
        class="w-[1ch] text-center text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="code-line-mark"
      >
        {props.mark ? MARK_GLYPH[props.mark] : ''}
      </span>
      <span class={cn({ 'min-w-0': props.wrap })}>{props.line || ' '}</span>
    </>
  )
  const rowClass = () =>
    cn(
      'grid gap-3 no-underline',
      props.numbered ? 'grid-cols-[3ch_1ch_1fr]' : 'grid-cols-[1ch_1fr]',
      {
        'bg-success-subtle': props.mark === 'add',
        'bg-destructive-subtle': props.mark === 'remove' || props.mark === 'error',
        'bg-primary-subtle': props.mark === 'highlight',
      }
    )
  return (
    <Show
      when={props.mark === 'add' || props.mark === 'remove'}
      fallback={
        <span data-mark={props.mark} class={rowClass()}>
          {content()}
        </span>
      }
    >
      <Show
        when={props.mark === 'add'}
        fallback={
          <del data-mark="remove" class={rowClass()}>
            {content()}
          </del>
        }
      >
        <ins data-mark="add" class={rowClass()}>
          {content()}
        </ins>
      </Show>
    </Show>
  )
}

/**
 * InlineCode.
 *
 * The `code` inside a sentence. It is a component rather than a class because it
 * has to hold three properties at once: it uses the shared code family and size
 * preference, and it wraps rather than overflows a narrow column
 * (`overflow-wrap: anywhere` — an identifier with
 * no spaces is one long token), and it must be legible against whatever surface
 * it lands on, which is why the fill is a token and not a fixed grey.
 */
export function InlineCode(props: ComponentProps<'code'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <code
      class={cn(
        'rounded-sm bg-muted px-[0.4em] py-[0.15em] font-code text-code text-foreground [overflow-wrap:anywhere]',
        local.class
      )}
      {...rest}
    />
  )
}
