import { Copy } from 'lucide-solid'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Bubble } from '../bubble'
import { Button } from '../button'
import { ConversationAvatar } from '../../conversation/conversation-avatar'
import { messageCitations } from '../../composites/inline-citation'
import {
  Message,
  MessageActions,
  MessageContent,
  MessageHeader,
  MessageText,
  type MessageCodeBlockProps,
} from './message'

const meta = {
  title: 'UI/Message',
  component: Message,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One turn. The person's turn is a bubble on the trailing edge; the assistant's turn is the page, holding everything the agent did for that request. `MessageText` reads untrusted text safely: fenced code, a small Markdown subset, and links only for http, https and mailto.",
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
} satisfies Meta<typeof Message>

export default meta
type Story = StoryObj<typeof meta>

const answer = `The plan is ready. Two risks are worth fixing before approval:

1. **Migration order**: \`0054\` depends on \`0053\`, so a partial deploy fails.
2. The rollback script is *not* idempotent.

- Run \`bun run db:check\` first
- Then read [the runbook](https://example.com/runbook)

\`\`\`sh
bun run --cwd packages/db db:check
\`\`\``

export const Conversation: Story = {
  args: { role: 'assistant', label: 'Conversation' },
  render: () => (
    <div class="flex flex-col">
      <Message role="user" label="You">
        <Bubble>Review the deployment plan and summarise the risks.</Bubble>
      </Message>
      <Message role="assistant" label="Assistant">
        <MessageHeader avatar={<ConversationAvatar kind="agent" />} time="10:02">
          Assistant
        </MessageHeader>
        <MessageContent>
          <MessageText text={answer} />
        </MessageContent>
        <MessageActions>
          <Button variant="ghost" size="icon-sm" aria-label="Copy reply">
            <Copy />
          </Button>
        </MessageActions>
      </Message>
    </div>
  ),
}

/** The turn is still arriving: aria-busy, a caret after the prose, and a partial fence drawn as code. */
export const Streaming: Story = {
  args: { role: 'assistant', label: 'Assistant', streaming: true },
  render: () => (
    <Message role="assistant" label="Assistant" streaming>
      <MessageContent>
        <MessageText streaming text={'Running the check now:\n\n```sh\nbun run lint\nbun run ty'} />
      </MessageContent>
    </Message>
  ),
}

/** Hostile text is text: no HTML, no script links, unsupported syntax stays readable. */
export const UntrustedText: Story = {
  args: { role: 'assistant', label: 'Assistant' },
  render: () => (
    <Message role="assistant" label="Assistant">
      <MessageContent>
        <MessageText
          text={
            '<img src=x onerror=alert(1)> and <script>alert(2)</script>\n\n[click](javascript:alert(3)) [ok](https://example.com) [mail](mailto:a@example.com)\n\n| a | b |\n| - | - |\n| 1 | 2 |'
          }
        />
      </MessageContent>
    </Message>
  ),
}

/**
 * Citation markers. The host supplies the sources the reply really used and
 * `messageCitations` turns `[^n]` into their badges. A number with no source
 * (`[^9]`), an array index (`arr[1]`) and code are left exactly as written.
 */
export const Citations: Story = {
  args: { role: 'assistant', label: 'Assistant' },
  render: () => (
    <Message role="assistant" label="Assistant">
      <MessageContent>
        <MessageText
          citations={messageCitations([
            {
              title: 'Migration guide',
              url: 'https://example.com/guide',
              snippet: 'Apply additive changes before the backfill.',
            },
            { title: 'Runbook', url: 'https://example.com/runbook' },
          ])}
          text={
            'Add the column first [^1], then backfill [^2]. Both documents agree on the order [^1,2]. A marker with no source [^9] and `arr[1]` stay text.'
          }
        />
      </MessageContent>
    </Message>
  ),
}

/**
 * Line marks. The host chooses a block's props by position, because only it knows
 * which lines changed or failed; the text itself can never mark a line.
 */
export const LineMarks: Story = {
  args: { role: 'assistant', label: 'Assistant' },
  render: () => (
    <Message role="assistant" label="Assistant">
      <MessageContent>
        <MessageText
          codeBlockProps={(block): MessageCodeBlockProps =>
            block.index === 0
              ? { lineMarks: { 2: 'add', 3: 'remove' } }
              : { lineMarks: { 1: 'error' } }
          }
          text={
            'The change:\n\n```diff\nkeep\nadded\nremoved\n```\n\nThe failing line:\n\n```ts\nbroken(\n```'
          }
        />
      </MessageContent>
    </Message>
  ),
}
