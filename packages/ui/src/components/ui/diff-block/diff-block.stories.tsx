import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button'
import { DiffBlock, DiffSummary } from './diff-block'

const patch = [
  'diff --git a/src/lib/keyed-rows.ts b/src/lib/keyed-rows.ts',
  'index 1a2b3c4..5d6e7f8 100644',
  '--- a/src/lib/keyed-rows.ts',
  '+++ b/src/lib/keyed-rows.ts',
  '@@ -14,9 +14,11 @@ export function keyedRows<T, K>(',
  '   let entries = new Map<K, Entry>()',
  '   return createMemo(() => {',
  '-    const rows = list().map((item) => create(item))',
  '-    entries = new Map()',
  '+    const next = new Map<K, Entry>()',
  '+    const rows = list().map((item) => next.get(key(item)) ?? create(item))',
  '+    entries = next',
  '     return rows',
  '   })',
  ' }',
].join('\n')

const added = [
  '--- /dev/null',
  '+++ b/src/new-file.ts',
  '@@ -0,0 +1,3 @@',
  '+one',
  '+two',
  '+three',
].join('\n')

const meta = {
  title: 'UI/Diff Block',
  component: DiffBlock,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A unified diff, classified and toned. The classification is the part that cannot be fixed from a caller: a line beginning with `+++` is a file header *before* the first hunk and an addition beginning with `++` *inside* one, so a renderer testing prefixes without that state mis-colours real patches. Colour is never the only signal — the gutter carries `+`/`−` and the counts are text, so the block works in greyscale.',
      },
    },
  },
  argTypes: {
    complete: { control: 'boolean' },
    showLineNumbers: { control: 'boolean' },
  },
  decorators: [
    () => (
      <div class="w-[42rem]">
        <DiffBlock patch={patch} showLineNumbers />
      </div>
    ),
  ],
} satisfies Meta<typeof DiffBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { patch, showLineNumbers: true } }

/** Without gutters, for a fragment that has no line numbers of its own. */
export const NoLineNumbers: Story = { args: { patch } }

/** An added file: the old side is `/dev/null`, which names no file. */
export const AddedFile: Story = { args: { patch: added, showLineNumbers: true } }

/** A filename instead of the one in the header. */
export const WithTitle: Story = {
  args: { patch, showLineNumbers: true, title: 'keyed-rows.ts (working tree)' },
}

export const WithActions: Story = {
  args: {
    patch,
    showLineNumbers: true,
    actions: (
      <Button variant="outline" size="xs">
        Open file
      </Button>
    ),
  },
}

export const Streaming: Story = {
  args: { patch: patch.split('\n').slice(0, 9).join('\n'), complete: false, showLineNumbers: true },
}

/**
 * The row shape, for a list of changed files rather than one patch. The counts
 * are the summary a reader scans; the patch itself is behind the selection.
 */
export const Summaries: Story = {
  render: () => (
    <div class="w-96 border border-border p-2">
      <DiffSummary patch={patch} />
      <DiffSummary patch={added} />
      <DiffSummary patch={'--- a/x.css\n+++ b/x.css\n@@ -1 +1 @@\n-a{}\n+b{ color: red }'} />
    </div>
  ),
}
