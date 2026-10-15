import { FileText, Globe, Terminal } from 'lucide-solid'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../../ui/button'
import { Trace } from '../../ui/trace'
import { Tool } from './tool'

const meta = {
  title: 'Composites/Tool',
  component: Tool,
  tags: ['autodocs'],
  args: { name: 'read_file' },
  parameters: {
    docs: {
      description: {
        component:
          'One tool call, from input to output, as a Trace line. Status, input, output and errorText are each optional and each render only when the host passed them; payloads are `unknown` and are formatted by a serializer that cannot throw and stops after a character budget.',
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
} satisfies Meta<typeof Tool>

export default meta
type Story = StoryObj<typeof meta>

/** The whole lifecycle: a mark that stays quiet, and input and output on request. */
export const Success: Story = {
  args: {
    name: 'read_file',
    description: 'src/db/migrations/0054_add_locale.sql',
    status: 'success',
    defaultOpen: true,
    input: { path: 'src/db/migrations/0054_add_locale.sql', lines: [1, 40] },
    output:
      'ALTER TABLE users ADD COLUMN locale text;\nUPDATE users SET locale = profile_language;\nCREATE INDEX CONCURRENTLY users_locale_idx ON users (locale);',
  },
}

/** Still running: the input is known, there is no output yet and none is drawn. */
export const Running: Story = {
  args: {
    name: 'run_command',
    icon: <Terminal />,
    description: 'bun run typecheck',
    status: 'running',
    defaultOpen: true,
    input: { command: 'bun run typecheck', cwd: 'packages/ui' },
  },
}

/** Running with partial output: the output block says it is still generating. */
export const RunningWithPartialOutput: Story = {
  args: {
    name: 'run_command',
    icon: <Terminal />,
    status: 'running',
    defaultOpen: true,
    output: 'bun run lint\n  checking 412 files…',
  },
}

/** Queued behind something else: no detail yet, so a plain line. */
export const Pending: Story = {
  args: {
    name: 'web_search',
    icon: <Globe />,
    description: 'postgres lock levels',
    status: 'pending',
  },
}

/** An error with no output is just the error: no empty "Output" box beside it. */
export const ErrorWithoutOutput: Story = {
  args: {
    name: 'run_command',
    icon: <Terminal />,
    description: 'bun test',
    status: 'error',
    defaultOpen: true,
    errorText: 'Command failed with exit code 1\ntests/users.test.ts: expected 2, received 3',
  },
}

/** An error that also returned something: both are shown, the failure marked in the gutter. */
export const ErrorWithOutput: Story = {
  args: {
    name: 'run_command',
    icon: <Terminal />,
    status: 'error',
    defaultOpen: true,
    input: { command: 'bun run lint' },
    output: '12 errors, 0 warnings',
    errorText: 'exit code 1',
  },
}

/** A failure with no text at all: the mark and word say it failed, and nothing is invented. */
export const ErrorWithNothing: Story = {
  args: {
    name: 'fetch_url',
    icon: <Globe />,
    description: 'https://example.com/changelog',
    status: 'error',
  },
}

/**
 * The reader has something to do, so the line opens. The Approve and Deny
 * controls are the host's, passed as children; the component never decides
 * whether approving is allowed.
 */
export const AwaitingApproval: Story = {
  args: {
    name: 'delete_branch',
    description: 'feat/old-migration',
    status: 'awaiting-approval',
    input: { branch: 'feat/old-migration', remote: true },
    children: (
      <div class="flex items-center gap-2">
        <Button size="xs">Approve</Button>
        <Button size="xs" variant="outline">
          Deny
        </Button>
      </div>
    ),
  },
}

export const Denied: Story = {
  args: {
    name: 'delete_branch',
    description: 'feat/old-migration',
    status: 'denied',
    input: { branch: 'feat/old-migration', remote: true },
  },
}

/**
 * The run was stopped while this call was in flight. Not a failure and not a
 * denial: the word says so, and what the call had produced is kept. Give a call
 * this status only when the host knows it was the one stopped.
 */
export const Cancelled: Story = {
  args: {
    name: 'bun test',
    description: 'packages/db',
    status: 'cancelled',
    defaultOpen: true,
    input: { command: 'bun test packages/db' },
    output: '(pass) applies every migration twice\n(pass) keeps the journal append-only',
  },
}

/** No status: the producer did not say how it went, so there is no tick. */
export const NoStatus: Story = {
  args: { name: 'read_file', icon: <FileText />, description: 'README.md' },
}

/** A string result is shown as given, not quoted and not re-parsed. */
export const StringOutputWithLongLines: Story = {
  args: {
    name: 'run_command',
    icon: <Terminal />,
    status: 'success',
    defaultOpen: true,
    output: `${'0123456789 '.repeat(40)}\nshort line`,
  },
}

const circular: Record<string, unknown> = { id: 1, label: 'node' }
circular['self'] = circular
circular['children'] = [circular, { big: 9007199254740993n, missing: undefined, ratio: Number.NaN }]

/** Circular references, BigInt, undefined and NaN are written as what they are. */
export const AwkwardValues: Story = {
  args: { name: 'inspect', status: 'success', defaultOpen: true, output: circular },
}

/** 200,000 characters of output, cut at the budget with a note saying so. */
export const HugeOutput: Story = {
  args: {
    name: 'run_command',
    icon: <Terminal />,
    status: 'success',
    defaultOpen: true,
    maxChars: 2_000,
    output: 'log line with some detail\n'.repeat(8_000),
  },
}

/** A thousand-entry result: pretty-printed JSON, cut at the default budget, inside a scrolling block. */
export const HugeStructuredOutput: Story = {
  args: {
    name: 'list_files',
    status: 'success',
    defaultOpen: true,
    maxChars: 6_000,
    output: Array.from({ length: 1_000 }, (_, index) => ({ index, path: `src/file-${index}.ts` })),
  },
}

/** Names and descriptions far longer than the column truncate; nothing widens the line. */
export const LongNames: Story = {
  args: {
    name: 'mcp__a_very_long_server_name__and_an_even_longer_tool_name_for_good_measure',
    description:
      'an argument summary that goes on and on and does not fit beside the name on a single row of the transcript',
    status: 'success',
    input: { ok: true },
  },
}

/** Hostile text stays text. */
export const UntrustedText: Story = {
  args: {
    name: '<img src=x onerror=alert(1)>',
    description: '<script>alert(2)</script>',
    status: 'success',
    defaultOpen: true,
    output: '<b>not bold</b> [link](javascript:alert(3))',
  },
}
