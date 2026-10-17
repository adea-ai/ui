import { FileText, Search, Terminal } from 'lucide-solid'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { MessageText } from '../../ui/message'
import { Trace, TraceLine } from '../../ui/trace'
import { Tool } from '../tool'
import { Subagent } from './subagent'

const meta = {
  title: 'Composites/Subagent',
  component: Subagent,
  tags: ['autodocs'],
  args: { name: 'Test runner' },
  parameters: {
    docs: {
      description: {
        component:
          'A subagent run as a Trace line: name, task, status, model and duration on the line, and a nested Trace of its own steps beneath. The collapsed summary shows the step count; a result and a failure are slots that appear only when supplied.',
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
} satisfies Meta<typeof Subagent>

export default meta
type Story = StoryObj<typeof meta>

/** Finished and folded: the line alone says who, what, with which model, how many steps, how long. */
export const Finished: Story = {
  args: {
    name: 'Test runner',
    task: 'Run the unit tests for packages/ui',
    status: 'success',
    model: 'sonnet-5',
    duration: 42,
  },
  render: (args) => (
    <Subagent {...args}>
      <Tool name="run_command" icon={<Terminal />} description="bun test" status="success" />
      <Tool
        name="read_file"
        icon={<FileText />}
        description="tests/users.test.ts"
        status="success"
      />
      <TraceLine title="Summarised the failures" />
    </Subagent>
  ),
}

/** Opened, with its result: steps first, then what it handed back. */
export const OpenWithResult: Story = {
  args: {
    name: 'Test runner',
    task: 'Run the unit tests for packages/ui',
    status: 'success',
    model: 'sonnet-5',
    duration: 42,
    defaultOpen: true,
    result: (
      <MessageText text={'All **1,204** tests passed.\n\nSlowest: `tree-navigation` at 1.9s.'} />
    ),
  },
  render: (args) => (
    <Subagent {...args}>
      <Tool name="run_command" icon={<Terminal />} description="bun test" status="success" />
      <Tool
        name="read_file"
        icon={<FileText />}
        description="tests/users.test.ts"
        status="success"
      />
    </Subagent>
  ),
}

/** Still working: steps are arriving, the duration is not known, and none is claimed. */
export const Running: Story = {
  args: {
    name: 'Researcher',
    task: 'Find prior art for the migration',
    status: 'running',
    model: 'haiku-4',
    defaultOpen: true,
  },
  render: (args) => (
    <Subagent {...args}>
      <Tool
        name="web_search"
        icon={<Search />}
        description="online schema change"
        status="success"
      />
      <Tool name="fetch_url" description="https://example.com/gh-ost" status="running" />
    </Subagent>
  ),
}

/** Just started: nothing to open yet, so a plain line that becomes a disclosure with its first step. */
export const NoStepsYet: Story = {
  args: { name: 'Researcher', task: 'Find prior art', status: 'running' },
}

/** Failed with a reason and no result: the error as text, no empty "Result". */
export const Failed: Story = {
  args: {
    name: 'Deployer',
    task: 'Deploy to staging',
    status: 'error',
    defaultOpen: true,
    errorText: 'Deployment rejected: the staging environment is locked by another run.',
  },
}

/** No status, model or duration given: only what is known is drawn. */
export const Minimal: Story = {
  args: { name: 'Helper' },
  render: (args) => (
    <Subagent {...args}>
      <TraceLine title="Looked at the file" />
    </Subagent>
  ),
}

/** The host knows the run had more steps than it has loaded. */
export const StepCountOverride: Story = {
  args: { name: 'Indexer', task: 'Index the repository', status: 'success', stepCount: 128 },
  render: (args) => (
    <Subagent {...args}>
      <TraceLine title="Indexed packages/ui" />
      <TraceLine title="Indexed packages/themes" />
    </Subagent>
  ),
}

/** A subagent inside a subagent is the same lines, one level further in. */
export const Nested: Story = {
  args: { name: 'Planner', task: 'Break the work down', status: 'success', defaultOpen: true },
  render: (args) => (
    <Subagent {...args}>
      <Subagent
        name="Schema reviewer"
        task="Check the migration order"
        status="success"
        duration={9}
      >
        <Tool name="read_file" description="0053_users.sql" status="success" />
      </Subagent>
      <TraceLine title="Merged the findings" />
    </Subagent>
  ),
}

/** A long name, task and model label truncate; the line never widens. */
export const LongNames: Story = {
  args: {
    name: 'An exceptionally descriptive subagent name that keeps going past the edge of the column',
    task: 'A task description that is just as long and also has to give way to the status on the right',
    status: 'success',
    model: 'a-model-label-with-an-unreasonably-long-identifier-v2026-10-15-preview',
    duration: 3_725,
  },
  render: (args) => (
    <Subagent {...args}>
      <TraceLine title="One step" />
    </Subagent>
  ),
}

/** Two hundred steps: the nested trace is long, and the count on the folded line is right. */
export const ManySteps: Story = {
  args: { name: 'Crawler', task: 'Visit every page', status: 'success' },
  render: (args) => (
    <Subagent {...args}>
      {Array.from({ length: 200 }, (_, index) => (
        <TraceLine title={`Visited /page/${index + 1}`} />
      ))}
    </Subagent>
  ),
}
