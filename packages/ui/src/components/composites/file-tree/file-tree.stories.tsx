import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Trace, TraceLine } from '../../ui/trace'
import { FileTree } from './file-tree'
import type { FileChangeInput } from './build-file-tree'

const meta = {
  title: 'Composites/File Tree',
  component: FileTree,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The files an agent changed, as a folder tree. Built on the shared `Tree` for its ARIA roles and keyboard model (arrows, Home/End, Enter) with typeahead added. A change kind is drawn, as a word, only for a file the host gave one; rows select only when the host supplies `onSelect`; a collapsed folder is never rendered, so a 5 000-file tree costs what is visible.',
      },
    },
  },
  args: { files: [] },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[34rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileTree>

export default meta
type Story = StoryObj<typeof meta>

const changed: FileChangeInput[] = [
  {
    path: 'packages/ui/src/components/composites/terminal/terminal.tsx',
    change: 'added',
    additions: 412,
    deletions: 0,
  },
  {
    path: 'packages/ui/src/components/composites/terminal/ansi.ts',
    change: 'added',
    additions: 530,
    deletions: 0,
  },
  {
    path: 'packages/ui/src/components/composites/terminal/ansi.test.ts',
    change: 'added',
    additions: 388,
    deletions: 0,
  },
  {
    path: 'packages/ui/src/components/ui/code-block/code-block.tsx',
    change: 'modified',
    additions: 18,
    deletions: 4,
  },
  {
    path: 'packages/ui/src/components/ui/code-block/index.ts',
    change: 'modified',
    additions: 2,
    deletions: 0,
  },
  { path: 'packages/ui/src/lib/clipboard.ts', change: 'deleted', additions: 0, deletions: 44 },
  {
    path: 'packages/ui/src/lib/copy-text.ts',
    change: 'renamed',
    renamedFrom: 'packages/ui/src/lib/clip.ts',
    additions: 3,
    deletions: 3,
  },
  { path: 'docs/ai-elements.md', change: 'modified', additions: 9, deletions: 1 },
  { path: 'README.md' },
]

/**
 * A change set with every kind. The kind is a word on the row, so it is spoken as
 * well as tinted; the deleted file is struck through; folders with one folder
 * inside are compacted into one row; and `README.md` has no kind, so it is listed
 * and nothing is said about it.
 */
export const Default: Story = { args: { files: changed } }

/** Selection exists only because the host passed `onSelect`. Enter on a file selects; Enter on a folder toggles it. */
export const Selectable: Story = {
  render: () => {
    const [selected, setSelected] = createSignal<string>()
    return (
      <div class="flex flex-col gap-2">
        <FileTree files={changed} selected={selected()} onSelect={(path) => setSelected(path)} />
        <p class="text-xs text-muted-foreground" role="status">
          {selected() ? `Host received ${selected()}` : 'Nothing selected.'}
        </p>
      </div>
    )
  },
}

/** No `onSelect`: no `aria-selected` anywhere, and files do nothing on Enter. */
export const NotSelectable: Story = { args: { files: changed, defaultExpanded: true } }

/** Paths are listed with no change kind at all: the tree says nothing about what happened to them. */
export const StatusAbsent: Story = {
  args: {
    files: ['src/index.ts', 'src/lib/util.ts', 'src/lib/format.ts', 'tests/util.test.ts'],
  },
}

export const Empty: Story = { args: { files: [] } }

/** Windows and posix separators, duplicates and empty segments meet in one tree; `..` and control characters are refused and counted. */
export const AwkwardPaths: Story = {
  args: {
    files: [
      'src\\lib\\a.ts',
      'src/lib/a.ts',
      './src//lib/b.ts',
      'C:\\repo\\notes.txt',
      '../../etc/passwd',
      'src/../../escape.ts',
      'bad\nname.ts',
      'rtl\u202Eevil.ts',
      '__proto__/constructor.ts',
    ],
  },
}

const bigTree: FileChangeInput[] = Array.from({ length: 5000 }, (_, i) => ({
  path: `packages/pkg-${String(i % 40).padStart(2, '0')}/src/module-${i % 9}/file-${i}.ts`,
  change: (['added', 'modified', 'modified', 'deleted'] as const)[i % 4],
}))

/**
 * 5 000 files. Only the top level opens, and expanding a folder renders only its
 * children. Press End, or open everything with `defaultExpanded`, and rows are
 * mounted a page at a time with the rest counted.
 */
export const FiveThousandFiles: Story = { args: { files: bigTree, maxHeight: '24rem' } }

/** Everything open: 5 000 files is more than 5 000 rows, so only the first page mounts and the control says how many remain. */
export const FiveThousandFilesExpanded: Story = {
  args: { files: bigTree, defaultExpanded: true, maxHeight: '24rem' },
}

/** Type a letter to jump to the next row whose name starts with it; type it again to cycle, or more letters to refine. */
export const Typeahead: Story = {
  args: {
    files: [
      'alpha/one.ts',
      'alpha/two.ts',
      'beta/one.ts',
      'gamma/one.ts',
      'gamma/two.ts',
      'readme.md',
      'sample.ts',
    ],
    defaultExpanded: true,
  },
}

/** In the body of a Trace line, which is where a change set usually lives. */
export const InsideTrace: Story = {
  render: () => (
    <Trace aria-label="Activity">
      <TraceLine title="Changed 9 files" status="success" defaultOpen>
        <FileTree files={changed} showSummary={false} />
      </TraceLine>
    </Trace>
  ),
}
