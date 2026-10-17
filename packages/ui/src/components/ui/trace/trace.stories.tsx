import { FileText, Globe, Search, Terminal } from 'lucide-solid'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { CodeBlock } from '../code-block'
import { Trace, TraceDetail, TraceLine } from './trace'

const meta = {
  title: 'UI/Trace',
  component: Trace,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One quiet column of agent activity. Reasoning, tool calls, sources, plan steps and subagent runs share one row: a mark, a title, an optional description and status, and a disclosure when there is more to say. Status is optional because a row without one makes no claim about success.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[34rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Trace>

export default meta
type Story = StoryObj<typeof meta>

/** Every status, with the title and mark carrying the state and not only the colour. */
export const Statuses: Story = {
  render: () => (
    <Trace aria-label="Statuses">
      <TraceLine
        icon={<Search />}
        title="Searched the project"
        description="4 results"
        status="success"
      />
      <TraceLine title="Reading migration plan" status="running" meta="2s" />
      <TraceLine title="Waiting for a free runner" status="pending" />
      <TraceLine title="Ran the type check" description="exit code 2" status="error" />
      <TraceLine title="Fetched the changelog" status="cancelled" />
      <TraceLine icon={<Globe />} title="No status given" description="the producer did not say" />
    </Trace>
  ),
}

/** A summary expands into steps, and a step into its output. */
export const Nested: Story = {
  render: () => (
    <Trace aria-label="Nested activity">
      <TraceLine
        icon={<Terminal />}
        title="Checked the build"
        description="3 steps"
        status="success"
        defaultOpen
      >
        <Trace size="sm" aria-label="Build steps">
          <TraceLine title="bun run lint" status="success" meta="4.1s" />
          <TraceLine title="bun run typecheck" status="error" meta="12s" defaultOpen>
            <TraceDetail>
              <CodeBlock
                size="sm"
                language="text"
                code={'src/a.ts(3,1): error TS2322\nsrc/b.ts(9,5): error TS2339'}
                complete
              />
            </TraceDetail>
          </TraceLine>
          <TraceLine title="bun run test" status="pending" />
        </Trace>
      </TraceLine>
    </Trace>
  ),
}

/** A link and an opener are lines that go somewhere; a static line is not a tab stop. */
export const LinksAndOpeners: Story = {
  render: () => (
    <Trace aria-label="Sources">
      <TraceLine
        icon={<FileText />}
        title="docs/specs/dev-runtime.md"
        href="https://example.com/spec"
      />
      <TraceLine icon={<Terminal />} title="Open full output" onSelect={() => undefined} />
      <TraceLine icon={<Search />} title="Static line" description="no action" />
    </Trace>
  ),
}
