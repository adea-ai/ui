import { FileText, Terminal } from 'lucide-solid'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Bubble } from '../../ui/bubble'
import { Message, MessageContent, MessageText } from '../../ui/message'
import { Trace } from '../../ui/trace'
import { Plan } from '../plan'
import { Queue } from '../queue'
import { Reasoning } from '../reasoning'
import { Subagent } from '../subagent'
import { Tool } from './tool'

/**
 * One turn, mid-run: the person asked for a migration, and the agent has
 * thought, made a plan, read a file, started a subagent on the tests and is
 * partway through its own todo list. Everything is folded except what the reader
 * would want to see — the plan, and the call that is running — and every line
 * says only what the host told it: the running tool has no duration, the plan
 * has no Approve button, the subagent has no result yet.
 */
function ActivityScenario() {
  return (
    <div class="flex flex-col">
      <Message role="user" label="You">
        <Bubble>
          Add a locale column to users, backfill it, and make sure the tests still pass.
        </Bubble>
      </Message>
      <Message role="assistant" label="Assistant" streaming>
        <MessageContent>
          <Trace aria-label="Activity">
            <Reasoning
              duration={6}
              text={
                'The `users` table is hot, so the column has to be added as nullable and backfilled in batches.\n\nI will check the migration folder for the next number before writing anything.'
              }
            />
            <Plan
              title="Add a locale column"
              description="Adds `locale` without holding a lock on `users`."
              steps={[
                { label: 'Add a nullable locale column', status: 'complete' },
                {
                  label: 'Backfill from profile.language in batches',
                  description: '5,000 rows at a time',
                  status: 'active',
                },
                { label: 'Add the not-null constraint', status: 'pending' },
                { label: 'Run the tests', status: 'pending' },
              ]}
            />
            <Tool
              name="read_file"
              icon={<FileText />}
              description="src/db/migrations/0053_users.sql"
              status="success"
              input={{ path: 'src/db/migrations/0053_users.sql' }}
              output={'CREATE TABLE users (\n  id bigint PRIMARY KEY,\n  email text NOT NULL\n);'}
            />
            <Subagent
              name="Test runner"
              task="Run the unit tests for packages/db"
              status="running"
              model="haiku-4"
              defaultOpen
            >
              <Tool
                name="run_command"
                icon={<Terminal />}
                description="bun test packages/db"
                status="success"
              />
              <Tool
                name="run_command"
                icon={<Terminal />}
                description="bun run typecheck"
                status="running"
              />
            </Subagent>
          </Trace>
          <Queue
            items={[
              { text: 'Read the migration folder', status: 'complete' },
              { text: 'Write 0054_add_locale.sql', status: 'complete' },
              { text: 'Backfill locale in batches', status: 'active' },
              { text: 'Add the not-null constraint', status: 'pending' },
              { text: 'Summarise the result' },
            ]}
          />
          <MessageText
            streaming
            text="The column is in and the backfill is running. I will add the constraint once the last batch finishes, then report the test results"
          />
        </MessageContent>
      </Message>
    </div>
  )
}

const meta = {
  title: 'Composites/Activity Scenario',
  component: ActivityScenario,
  parameters: {
    docs: {
      description: {
        component:
          "Reasoning, Plan, Tool, Subagent and Queue composed in one assistant turn under the person's request. A single coherent scene rather than a catalogue: the activity is one quiet column of Trace lines and the answer is still arriving beneath it.",
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[40rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActivityScenario>

export default meta
type Story = StoryObj<typeof meta>

export const MidRun: Story = {}
