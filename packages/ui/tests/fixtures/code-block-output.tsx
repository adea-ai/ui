import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { CodeBlock, type CodeHighlighter } from '../../src/components/ui/code-block'
import '../../src/styles/globals.css'

/**
 * CodeBlock as it is used for tool output: copy exactness, marks, lazy
 * highlighting, bounded rendering and capped scrolling. The sources are exposed
 * on `window.sources` so a spec compares the clipboard to the string the block
 * was given instead of repeating it.
 */
type Controls = {
  sources: Record<string, string>
  copies: { id: string; ok: boolean }[]
  calls: Record<string, (string | undefined)[]>
  renderMs: number
  resolveLate: () => void
  resolveLateLimited: () => void
  rejectLate: () => void
  setComplete: (complete: boolean) => void
  appendStreamed: () => void
  streamedCode: () => string
}
const controls: Controls = {
  sources: {},
  copies: [],
  calls: {},
  renderMs: 0,
  resolveLate: () => undefined,
  resolveLateLimited: () => undefined,
  rejectLate: () => undefined,
  setComplete: () => undefined,
  appendStreamed: () => undefined,
  streamedCode: () => '',
}
;(window as Window & { fixture?: Controls }).fixture = controls

const lines = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`).join('\n')

controls.sources = {
  trailing: 'alpha\nbeta\n',
  marked: lines(30, 'row'),
  partial: 'function partial(a, b) {\n  return a +',
  unknown: "qapla\nbat'leth",
  unicode: 'héllo wörld 😀 日本語 👩‍👩‍👧\r\nsecond line\r\n\ttabbed ☃​end',
  selection: 'first line\nsecond line\nthird line\nfourth line\nfifth line',
  late: lines(12, 'const value ='),
  lateLimited: lines(30, 'limited row'),
  big: lines(20_000, 'output line'),
  medium: lines(1_500, 'medium line'),
  scroll: lines(100, 'scrolling line'),
}

/** A highlighter that keeps the plain renderer's box so the swap cannot move anything. */
const highlighter: CodeHighlighter = (code) => (
  <pre class="m-0 leading-normal" data-highlighted="">
    <code class="font-code text-code">
      {code.split('\n').map((line, index, all) => (
        <span class="text-primary">{index < all.length - 1 ? `${line}\n` : line}</span>
      ))}
    </code>
  </pre>
)

const record = (id: string, language: string | undefined) =>
  (controls.calls[id] ??= []).push(language)

let resolveLate: (value: CodeHighlighter | undefined) => void = () => undefined
let rejectLate: (reason: unknown) => void = () => undefined
const late = new Promise<CodeHighlighter | undefined>((resolve, reject) => {
  resolveLate = resolve
  rejectLate = reject
})
late.catch(() => undefined)
let resolveLateLimited: (value: CodeHighlighter | undefined) => void = () => undefined
const lateLimited = new Promise<CodeHighlighter | undefined>((resolve) => {
  resolveLateLimited = resolve
})
controls.resolveLateLimited = () => resolveLateLimited(highlighter)
controls.resolveLate = () => resolveLate(highlighter)
controls.rejectLate = () => rejectLate(new Error('grammar failed to load'))

const [complete, setComplete] = createSignal(false)
controls.setComplete = setComplete
const [streamed, setStreamed] = createSignal(lines(3, 'streamed'))
controls.appendStreamed = () =>
  setStreamed((value) => `${value}\nstreamed ${value.split('\n').length + 1}`)
controls.streamedCode = streamed

const onCopy = (id: string) => (ok: boolean) => controls.copies.push({ id, ok })

const start = performance.now()
render(
  () => (
    <main class="flex w-xl max-w-full flex-col gap-4 p-4">
      <CodeBlock
        id="trailing"
        language="txt"
        complete
        code={controls.sources['trailing']!}
        onCopy={onCopy('trailing')}
      />
      <CodeBlock
        id="marked"
        language="txt"
        complete
        showLineNumbers
        lineLimit={10}
        lineMarks={{ 2: 'add', 3: 'remove', 4: 'highlight', 5: 'error' }}
        code={controls.sources['marked']!}
        onCopy={onCopy('marked')}
      />
      <CodeBlock
        id="partial"
        language="js"
        complete={false}
        code={controls.sources['partial']!}
        onCopy={onCopy('partial')}
      />
      <CodeBlock
        id="unknown"
        language="klingon"
        complete
        code={controls.sources['unknown']!}
        loadHighlight={async (language) => (record('unknown', language), undefined)}
        onCopy={onCopy('unknown')}
      />
      <CodeBlock
        id="unicode"
        language="txt"
        complete
        showLineNumbers
        code={controls.sources['unicode']!}
        onCopy={onCopy('unicode')}
      />
      <CodeBlock
        id="selection"
        language="txt"
        complete
        showLineNumbers
        lineMarks={{ 2: 'add', 3: 'remove', 4: 'error' }}
        code={controls.sources['selection']!}
      />
      <CodeBlock
        id="late"
        language="ts"
        complete
        code={controls.sources['late']!}
        loadHighlight={(language) => (record('late', language), late)}
      />
      <CodeBlock
        id="late-limited"
        language="ts"
        complete
        showLineNumbers
        lineLimit={10}
        lineMarks={{ 2: 'add', 3: 'remove' }}
        code={controls.sources['lateLimited']!}
        loadHighlight={() => lateLimited}
        onCopy={onCopy('late-limited')}
      />
      <CodeBlock
        id="rejected"
        language="ts"
        complete
        code="const rejected = true"
        loadHighlight={(language) => (
          record('rejected', language),
          Promise.reject(new Error('network down'))
        )}
      />
      <CodeBlock
        id="throws"
        language="ts"
        complete
        code="const throws = true"
        loadHighlight={(language): Promise<undefined> => {
          record('throws', language)
          throw new Error('loader threw synchronously')
        }}
      />
      <CodeBlock
        id="returns-nothing"
        language="ts"
        complete
        code="const sloppy = true"
        loadHighlight={
          ((language: string | undefined) => {
            record('returns-nothing', language)
          }) as unknown as () => Promise<undefined>
        }
      />
      <CodeBlock
        id="no-language"
        complete
        code="no language here"
        loadHighlight={async (language) => (record('no-language', language), undefined)}
      />
      <CodeBlock
        id="explicit"
        language="ts"
        complete
        code="const explicit = 1"
        highlight={highlighter}
        loadHighlight={async (language) => (record('explicit', language), undefined)}
      />
      <CodeBlock
        id="streaming"
        language="ts"
        complete={complete()}
        code={streamed()}
        loadHighlight={async (language) => (record('streaming', language), highlighter)}
      />
      <CodeBlock
        id="marks"
        language="diff"
        complete
        lineMarks={{ 1: 'add', 2: 'remove', 3: 'highlight', 4: 'error' }}
        code={'added line\nremoved line\nhighlighted line\nfailed line\nplain line'}
      />
      <CodeBlock
        id="big"
        language="txt"
        complete
        showLineNumbers
        code={controls.sources['big']!}
        onCopy={onCopy('big')}
      />
      <CodeBlock
        id="medium"
        language="txt"
        complete
        showLineNumbers
        lineLimit={100}
        code={controls.sources['medium']!}
      />
      <CodeBlock
        id="scroll"
        language="txt"
        complete
        showLineNumbers
        maxHeight={160}
        code={controls.sources['scroll']!}
      />
    </main>
  ),
  document.body
)
controls.renderMs = performance.now() - start
