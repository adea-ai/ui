import {
  createMemo,
  createSignal,
  For,
  Show,
  splitProps,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { Check, Copy } from 'lucide-solid'
import { Button } from '../button'
import { cn } from '../../../lib/utils'

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
 */
export type CodeBlockProps = Omit<ComponentProps<'div'>, 'children'> & {
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
}

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
    'class',
    'ref',
  ])

  const [copied, setCopied] = createSignal(false)
  const [failed, setFailed] = createSignal(false)
  const [tall, setTall] = createSignal(false)

  const label = () => local.title ?? local.language ?? 'code'
  const regionLabel = () => (local.language ? `${local.language} code` : 'code')
  const lines = createMemo(() => local.code.replace(/\n$/, '').split('\n'))

  const copy = async () => {
    const ok = await copyText(local.code)
    setCopied(ok)
    setFailed(!ok)
    if (ok) setTimeout(() => setCopied(false), 1500)
  }

  const Actions = () => (
    <div class="flex items-center gap-1 opacity-0 transition-opacity group-focus-within/code:opacity-100 group-hover/code:opacity-100">
      {local.actions}
      <Button
        variant="ghost"
        size="icon-2xs"
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
      class={cn('group/code overflow-hidden rounded-xl border border-border bg-card', local.class)}
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
      }}
    >
      <div class="flex items-center justify-between gap-2 px-3 py-1">
        <span class="truncate font-mono text-xs text-muted-foreground">{label()}</span>
        <Actions />
      </div>
      <div
        class="scroll-fade overflow-x-auto"
        // A region that scrolls must be focusable, and a tab stop needs a name.
        tabindex="0"
        role="region"
        aria-label={regionLabel()}
      >
        <Show
          when={local.highlight}
          fallback={
            <pre class="m-0 px-3 py-2" style={{ 'line-height': local.lineHeight ?? '1.5' }}>
              <code class="font-mono text-xs">
                <Show when={local.showLineNumbers} fallback={local.code.replace(/\n$/, '')}>
                  <For each={lines()}>
                    {(line, index) => (
                      <span class="grid grid-cols-[3ch_1fr] gap-3">
                        <span
                          class="text-right text-muted-foreground select-none"
                          aria-hidden="true"
                        >
                          {index() + 1}
                        </span>
                        <span>{line || ' '}</span>
                      </span>
                    )}
                  </For>
                </Show>
              </code>
            </pre>
          }
        >
          {(highlight) => <div class="px-3 py-2">{highlight()(local.code)}</div>}
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

/**
 * InlineCode.
 *
 * The `code` inside a sentence. It is a component rather than a class because it
 * has to hold three properties at once: it must not break the line's rhythm
 * (`font-size: 0.9em`, so it tracks the surrounding text), it must wrap rather
 * than overflow a narrow column (`overflow-wrap: anywhere` — an identifier with
 * no spaces is one long token), and it must be legible against whatever surface
 * it lands on, which is why the fill is a token and not a fixed grey.
 */
export function InlineCode(props: ComponentProps<'code'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <code
      class={cn(
        'rounded-sm bg-muted px-[0.4em] py-[0.15em] font-mono text-[0.9em] text-foreground [overflow-wrap:anywhere]',
        local.class
      )}
      {...rest}
    />
  )
}
