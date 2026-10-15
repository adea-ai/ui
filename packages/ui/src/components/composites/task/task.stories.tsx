import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Trace } from '../../ui/trace'
import { Task, type TaskItem } from './task'

const meta = {
  title: 'Composites/Task',
  component: Task,
  tags: ['autodocs'],
  args: { title: 'Update the docs', items: [] },
  parameters: {
    docs: {
      description: {
        component:
          'A piece of work as a Trace line that opens onto its items. Each item is a sentence with an optional status and optional file chips. Progress ("2 of 4 done") appears only when items carry statuses; a task with no items is a plain line.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[34rem] max-w-full">
        <Trace aria-label="Activity">
          <Story />
        </Trace>
      </div>
    ),
  ],
} satisfies Meta<typeof Task>

export default meta
type Story = StoryObj<typeof meta>

const items: readonly TaskItem[] = [
  {
    text: 'Document the new locale column',
    status: 'complete',
    files: [
      { name: 'docs/schema.md', kind: 'document' },
      { name: 'docs/migrations.md', kind: 'document' },
    ],
  },
  {
    text: 'Add the backfill to the runbook',
    description: 'Batches of 5,000 rows',
    status: 'active',
    files: [{ name: 'docs/runbook.md', kind: 'text' }],
  },
  { text: 'Update the changelog', status: 'pending' },
  { text: 'Link the rollback script', status: 'pending' },
]

/** Statuses are supplied, so the line says how far along it is, in words. */
export const WithStatuses: Story = {
  args: { items, defaultOpen: true },
}

/** No statuses: no marks, no progress. The host did not say, so the task does not. */
export const NoStatuses: Story = {
  args: {
    defaultOpen: true,
    items: [
      { text: 'Document the new locale column', files: [{ name: 'docs/schema.md' }] },
      { text: 'Update the changelog' },
    ],
  },
}

/** Every status, including the ones that did not go well. */
export const AllStatuses: Story = {
  args: {
    title: 'Release checklist',
    defaultOpen: true,
    items: [
      { text: 'Tag the release', status: 'complete' },
      { text: 'Build the packages', status: 'active' },
      { text: 'Publish to the registry', status: 'pending' },
      { text: 'Notify the channel', status: 'skipped' },
      { text: 'Verify the smoke test', status: 'failed', description: 'Timed out after 30s' },
    ],
  },
}

/** No items: a plain line, not a disclosure that opens onto nothing. */
export const Empty: Story = {
  args: { items: [] },
}

const manyFiles = Array.from({ length: 15 }, (_, index) => ({
  name: `src/components/feature-${index + 1}/feature-${index + 1}.tsx`,
  kind: 'code' as const,
}))

/** Past six files, the rest sit behind one toggle whose label changes in place. */
export const ManyFiles: Story = {
  args: {
    defaultOpen: true,
    items: [{ text: 'Rename the prop across the codebase', status: 'complete', files: manyFiles }],
  },
}

/** Names that are hostile or enormous stay text and truncate inside their chip. */
export const AwkwardFileNames: Story = {
  args: {
    defaultOpen: true,
    items: [
      {
        text: 'Inspect the uploads',
        files: [
          { name: '<img src=x onerror=alert(1)>.png', kind: 'image' },
          {
            name: `${'very-long-file-name-'.repeat(12)}.tar.gz`,
            kind: 'archive',
            size: 52_428_800,
          },
          { name: '../../etc/passwd', kind: 'text' },
        ],
      },
    ],
  },
}

/** Long item text wraps and is clamped to three lines; the full text is in the tooltip. */
export const LongText: Story = {
  args: {
    defaultOpen: true,
    items: [
      {
        text: 'Backfill the locale column from profile.language for every user created before the migration, falling back to the account region and then to "en", in batches small enough that replication lag stays under a second the whole way through, and report the count of rows that needed the fallback.',
        description: 'This description is also long. '.repeat(10),
        status: 'active',
      },
      { text: 'x'.repeat(5_000), status: 'pending' },
    ],
  },
}

/** Two hundred items scroll inside the task; the answer below is not pushed away. */
export const TwoHundredItems: Story = {
  args: {
    title: 'Migrate every package',
    defaultOpen: true,
    items: Array.from({ length: 200 }, (_, index) => ({
      text: `Migrate package ${index + 1}`,
      status:
        index < 120
          ? ('complete' as const)
          : index === 120
            ? ('active' as const)
            : ('pending' as const),
    })),
  },
}

/** The title is long too. */
export const LongTitle: Story = {
  args: {
    title:
      'A task title written by someone who did not expect it to share a line with a progress count',
    items,
  },
}
