import { FileText, Globe, Search } from 'lucide-solid'
import { createSignal, For, Index, onCleanup } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Trace } from '../../ui/trace'
import {
  ChainOfThought,
  ChainOfThoughtResult,
  ChainOfThoughtResults,
  ChainOfThoughtStep,
} from './chain-of-thought'

const meta = {
  title: 'Composites/Chain Of Thought',
  component: ChainOfThought,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A summary line that opens onto the steps behind it. A step carries a label, an optional description, an optional status (complete, active, pending) and optional evidence such as search-result badges. A step without a status makes no claim.',
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
} satisfies Meta<typeof ChainOfThought>

export default meta
type Story = StoryObj<typeof meta>

/** Finished: the summary opens onto what was searched and what it found. */
export const Finished: Story = {
  args: { summary: 'Compared three migration strategies', defaultOpen: true },
  render: (args) => (
    <ChainOfThought {...args}>
      <ChainOfThoughtStep icon={<Search />} label="Searched the docs" status="complete">
        <ChainOfThoughtResults aria-label="Search results">
          <ChainOfThoughtResult icon={<FileText />} label="docs/migrations.md" />
          <ChainOfThoughtResult icon={<FileText />} label="docs/rollbacks.md" />
          <ChainOfThoughtResult icon={<Globe />} label="postgresql.org/docs/current/ddl-alter" />
        </ChainOfThoughtResults>
      </ChainOfThoughtStep>
      <ChainOfThoughtStep
        label="Compared the lock behaviour"
        description="3 options"
        status="complete"
      />
      <ChainOfThoughtStep label="Chose a nullable column first" status="complete" />
    </ChainOfThought>
  ),
}

/** Mid-run: one step done, one in progress, one not started. Each is also spoken. */
export const InProgress: Story = {
  args: { summary: 'Reading the codebase', defaultOpen: true },
  render: (args) => (
    <ChainOfThought {...args}>
      <ChainOfThoughtStep icon={<Search />} label="Found the schema files" status="complete" />
      <ChainOfThoughtStep label="Reading the latest migration" status="active" />
      <ChainOfThoughtStep label="Checking the rollback script" status="pending" />
    </ChainOfThought>
  ),
}

/** No statuses supplied: no marks implying progress, only the labels. */
export const NoStatus: Story = {
  args: { summary: 'Notes on the approach', defaultOpen: true },
  render: (args) => (
    <ChainOfThought {...args}>
      <ChainOfThoughtStep label="The index is on a hot table" />
      <ChainOfThoughtStep label="Build it concurrently" description="avoids the write lock" />
    </ChainOfThought>
  ),
}

/** A summary with no steps is a plain line: nothing to open. */
export const SummaryOnly: Story = {
  args: { summary: 'Nothing else to consider' },
}

/** Defaults: no summary text given, no steps. The line still says what it is. */
export const Bare: Story = {}

/** Long labels truncate on the line; the full text belongs in the step's children. */
export const LongNames: Story = {
  args: {
    summary:
      'Compared every migration strategy that was mentioned anywhere in the repository history and its documentation',
    defaultOpen: true,
  },
  render: (args) => (
    <ChainOfThought {...args}>
      <ChainOfThoughtStep
        label="Searched for prior art in a repository whose name is much longer than the column"
        description="a description that is also far too long to fit beside the label on one row"
        status="complete"
      >
        <ChainOfThoughtResults aria-label="Search results">
          <ChainOfThoughtResult label="packages/an-extraordinarily-long-package-name/src/components/some/deeply/nested/file-with-a-long-name.tsx" />
        </ChainOfThoughtResults>
      </ChainOfThoughtStep>
    </ChainOfThought>
  ),
}

/** Sixty results wrap; the step does not grow sideways. */
export const ManyResults: Story = {
  args: { summary: 'Searched widely', defaultOpen: true },
  render: (args) => (
    <ChainOfThought {...args}>
      <ChainOfThoughtStep icon={<Search />} label="Searched the repository" status="complete">
        <ChainOfThoughtResults aria-label="Search results">
          <For each={Array.from({ length: 60 }, (_, index) => `src/module-${index + 1}.ts`)}>
            {(name) => <ChainOfThoughtResult label={name} />}
          </For>
        </ChainOfThoughtResults>
      </ChainOfThoughtStep>
    </ChainOfThought>
  ),
}

/** Steps arrive while the summary is open: new lines are added and earlier ones keep their place. */
export const GrowingSteps: Story = {
  args: { summary: 'Working through it', defaultOpen: true },
  render: (args) => {
    const labels = [
      'Listed the files',
      'Opened the migration',
      'Read the tests',
      'Compared the schemas',
      'Wrote the plan',
    ]
    const [count, setCount] = createSignal(1)
    const timer = setInterval(() => {
      if (count() >= labels.length) clearInterval(timer)
      else setCount((value) => value + 1)
    }, 1200)
    onCleanup(() => clearInterval(timer))
    return (
      <ChainOfThought {...args}>
        <Index each={labels.slice(0, count())}>
          {(label, index) => (
            <ChainOfThoughtStep
              label={label()}
              status={index === count() - 1 && count() < labels.length ? 'active' : 'complete'}
            />
          )}
        </Index>
      </ChainOfThought>
    )
  },
}
