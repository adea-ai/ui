import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { CodeBlock, InlineCode } from './code-block'

const sample = `export function keyedRows<T, K>(
  list: () => readonly T[],
  key: (item: T) => K
): Accessor<readonly KeyedRow<T>[]> {
  let entries = new Map<K, Entry>()
  return createMemo(() => {
    const next = new Map<K, Entry>()
    return list().map((item) => next.get(key(item)) ?? create(item))
  })
}`

const meta = {
  title: 'UI/Code Block',
  component: CodeBlock,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A fenced block as a surface. No highlighter is bundled — syntax colouring is a large dependency with its own theme format — so `highlight` is the seam a Shiki/Pierre/Prism integration plugs into. Copy confirms only on success, a tall block repeats its actions below so copying never costs a scroll back to the top, and the scroller is focusable and named (`scrollable-region-focusable`).',
      },
    },
  },
  argTypes: {
    language: { control: 'text' },
    complete: { control: 'boolean' },
    showLineNumbers: { control: 'boolean' },
  },
  decorators: [
    () => (
      <div class="w-[36rem]">
        <CodeBlock code={sample} language="tsx" />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { code: sample, language: 'tsx' } }

export const WithLineNumbers: Story = {
  args: { code: sample, language: 'tsx', showLineNumbers: true },
}

/** A filename instead of a language. */
export const WithTitle: Story = {
  args: { code: sample, language: 'tsx', title: 'src/lib/keyed-rows.ts' },
}

/**
 * While streaming, the block shows what it has and a generating indicator. The
 * indicator lives inside the scroller's own box and occupies one line, so it does
 * not change the block's height when it disappears.
 */
export const Streaming: Story = {
  args: { code: sample.split('\n').slice(0, 4).join('\n'), language: 'tsx', complete: false },
}

/**
 * Past 480px the action row is repeated below the block. Scroll this one and the
 * copy button is still where your hand is.
 */
export const TallRepeatsActions: Story = {
  args: {
    code: Array.from({ length: 60 }, (_, index) => `const line${index + 1} = ${index + 1}`).join(
      '\n'
    ),
    language: 'ts',
  },
}

/**
 * `highlight` is the integration point. Here it is a toy that bolds every
 * occurrence of `const` — the real one is a highlighter's HTML.
 */
export const WithHighlight: Story = {
  args: {
    code: sample,
    language: 'tsx',
    highlight: (code: string) => (
      <pre class="m-0 font-mono text-xs leading-5 whitespace-pre">
        {code
          .split(/(\bconst\b|\breturn\b)/)
          .map((part) =>
            part === 'const' || part === 'return' ? (
              <span class="text-info">{part}</span>
            ) : (
              <span>{part}</span>
            )
          )}
      </pre>
    ),
  },
}

/** Inline code inside a sentence, which is the other half of the code surface. */
export const Inline: Story = {
  render: () => (
    <p class="max-w-md text-sm">
      Pass the list to <InlineCode>keyedRows</InlineCode> with a key function and the rows keep
      their DOM across refetches. A long identifier like{' '}
      <InlineCode>__adea_internal_shell_bridge_channel_name__</InlineCode> wraps rather than
      overflowing the column.
    </p>
  ),
}
