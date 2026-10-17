import { Archive, Pencil } from 'lucide-solid'
import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { ChatComposer } from '../../conversation/chat-composer'
import { Bubble } from '../../ui/bubble'
import { Button } from '../../ui/button'
import { Message, MessageContent, MessageText } from '../../ui/message'
import { StatusChip } from '../../ui/status-chip'
import { ActionButton } from '../action-button'
import { MessageScroller } from '../message-scroller'
import { Suggestion, Suggestions } from '../suggestion'
import { Chat, ChatEmpty, ChatHeader, ChatNotice } from './chat'

/**
 * The frame, not the conversation: these stories show the four pieces on their
 * own with only the simplest content inside them. The realistic full scenes
 * (a streaming turn, a pending approval, a finished run, a dropped connection)
 * live in `Composites/Chat Scenario`.
 */
const meta = {
  title: 'Composites/Chat',
  component: Chat,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The frame a conversation lives in: a header, a row for notices about the whole conversation, the thread and the composer. It is layout only: every part is a slot, and the notice row collapses when it is empty.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="h-128 w-full max-w-160 overflow-hidden rounded-lg border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Chat>

export default meta
type Story = StoryObj<typeof meta>

function Composer(props: { blockedReason?: string }) {
  const [draft, setDraft] = createSignal('')
  return (
    <ChatComposer
      value={draft()}
      onValueChange={setDraft}
      onSubmit={() => {
        setDraft('')
      }}
      blockedReason={props.blockedReason}
    />
  )
}

function Turns() {
  return (
    <MessageScroller gutter announcement="">
      <Message role="user" label="You" anchorId="chat-user">
        <Bubble>Which branch is the release cut from?</Bubble>
      </Message>
      <Message role="assistant" label="Assistant" anchorId="chat-reply">
        <MessageContent>
          <MessageText text="The release is cut from `main`. Release Please opens a pull request with the changelog, and merging it tags the version." />
        </MessageContent>
      </Message>
    </MessageScroller>
  )
}

/** Header, thread and composer. No notices, so the notice row takes no space. */
export const Default: Story = {
  render: () => (
    <Chat
      header={
        <ChatHeader
          title="Release process"
          subtitle="adea-ai/ui · main"
          status={<StatusChip tone="success" label="Idle" />}
          actions={
            <>
              <ActionButton
                variant="ghost"
                size="icon-sm"
                aria-label="Rename conversation"
                tooltip="Rename"
              >
                <Pencil />
              </ActionButton>
              <ActionButton
                variant="ghost"
                size="icon-sm"
                aria-label="Archive conversation"
                tooltip="Archive"
              >
                <Archive />
              </ActionButton>
            </>
          }
        />
      }
      composer={<Composer />}
    >
      <Turns />
    </Chat>
  ),
}

/**
 * Notices are about the conversation, not about a turn, so they sit between the
 * header and the thread and never scroll away. Each says its cause in words and
 * carries its own remedy; one that reports a change is announced.
 */
export const WithNotices: Story = {
  render: () => (
    <Chat
      header={
        <ChatHeader
          title="Release process"
          subtitle="adea-ai/ui · main"
          status={<StatusChip tone="warning" label="Offline" />}
        />
      }
      notices={
        <>
          <ChatNotice
            tone="info"
            title="This transcript starts at 09:14"
            description="Earlier turns were compacted into a summary."
          />
          <ChatNotice
            tone="warning"
            live="polite"
            title="Reconnecting…"
            description="The connection dropped. New messages are held until it is back."
            action={
              <Button type="button" variant="outline" size="sm">
                Retry now
              </Button>
            }
          />
          <ChatNotice
            tone="danger"
            live="assertive"
            title="The session ended unexpectedly"
            description="Exit code 137. The last turn may be incomplete."
            action={
              <Button type="button" variant="outline" size="sm">
                Start a new session
              </Button>
            }
          />
        </>
      }
      composer={<Composer blockedReason="Reconnecting. Your message is kept until it is back." />}
    >
      <Turns />
    </Chat>
  ),
}

/** No turns yet: the empty state is centred in the thread, with the host's real prompts. */
export const Empty: Story = {
  render: () => {
    const [draft, setDraft] = createSignal('')
    return (
      <Chat
        header={
          <ChatHeader
            title="New conversation"
            subtitle="adea-ai/ui · main"
            status={<StatusChip tone="neutral" label="Ready" />}
          />
        }
        composer={<ChatComposer value={draft()} onValueChange={setDraft} onSubmit={() => {}} />}
      >
        <MessageScroller
          gutter
          empty={
            <ChatEmpty
              title="What are you working on?"
              description="Ask about the code, or hand the agent a task."
              suggestions={
                <Suggestions label="Ways to start" onSelect={setDraft}>
                  <Suggestion text="Explain how the release is cut" />
                  <Suggestion text="Find where the theme tokens are defined" />
                  <Suggestion text="Review my staged changes" />
                </Suggestions>
              }
            />
          }
        />
      </Chat>
    )
  },
}

/** The header alone: title and subtitle truncate, the status and actions never wrap. */
export const HeaderOnly: Story = {
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-full max-w-160 rounded-lg border border-border">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <ChatHeader
      title="Migrate the users table to the new locale column without downtime"
      subtitle="adea-ai/ui · feature/user-locale · started 14:02"
      status={<StatusChip tone="pending" label="Working" />}
      actions={
        <ActionButton
          variant="ghost"
          size="icon-sm"
          aria-label="Archive conversation"
          tooltip="Archive"
        >
          <Archive />
        </ActionButton>
      }
    />
  ),
}

/** The three tones, with and without a remedy. A standing condition is not announced. */
export const NoticeTones: Story = {
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="flex w-full max-w-160 flex-col overflow-hidden rounded-lg border border-border">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <>
      <ChatNotice
        tone="info"
        title="Read-only"
        description="You are viewing this session from a shared link."
      />
      <ChatNotice
        tone="warning"
        live="polite"
        title="Reconnecting…"
        description="The connection dropped 12 seconds ago."
        action={
          <Button type="button" variant="outline" size="sm">
            Retry now
          </Button>
        }
      />
      <ChatNotice
        tone="danger"
        live="assertive"
        title="Could not load earlier turns"
        description="The server returned an error."
        action={
          <Button type="button" variant="outline" size="sm">
            Try again
          </Button>
        }
      />
    </>
  ),
}

/** The empty state on its own, with and without prompts. */
export const EmptyWithSuggestions: Story = {
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-full max-w-160 rounded-lg border border-border">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <ChatEmpty
      title="Nothing here yet"
      description="Ask a question to start the conversation."
      suggestions={
        <Suggestions label="Ways to start" onSelect={() => {}}>
          <Suggestion text="Summarise the open pull requests" />
          <Suggestion text="What changed since the last release?" />
        </Suggestions>
      }
    />
  ),
}
