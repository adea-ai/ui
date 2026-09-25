import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { File, LockKeyhole, Sparkles, Terminal } from 'lucide-solid'
import { createSignal } from 'solid-js'
import { Avatar, AvatarFallback } from '../ui/avatar/avatar'
import { Badge } from '../ui/badge/badge'
import { Button } from '../ui/button/button'
import { ConversationAvatar } from './conversation-avatar'
import { ConversationSurface } from './conversation-surface'
import { ComposerAttachmentButton, MessageComposer } from './message-composer'
import { MessageBody, MessageDayDivider, MessageRow } from './message-row'
import { AttachmentCard, ThreadPanel } from './thread-panel'

/**
 * The conversation layer.
 *
 * A transcript, a composer, and the pieces around them. This is the layer an
 * application's chat view is built from, and it is the one that would be most
 * tempting to write against a domain model — which is exactly what the first version
 * did, taking adea's `MessageSummary` and `AgentSummary`. That version could only ever
 * have been used by adea.
 *
 * Here the components take presentation only: a speaker's kind and name, a timestamp,
 * and the body as children. Attachments, a linked task, an action row, the mention
 * menu and the dictation control are all slots. A caller with an agent model renders a
 * mention menu; a caller without one gets a composer without it.
 */
const meta = {
  title: 'Conversation/Message row',
  component: MessageRow,
  parameters: { layout: 'padded' },
  args: { senderKind: 'agent', senderName: 'Ada Lovelace' },
  tags: ['autodocs'],
} satisfies Meta<typeof MessageRow>

export default meta
type Story = StoryObj<typeof meta>

/** The three voices, and the mirroring that separates a user's turn from an agent's. */
export const Voices: Story = {
  render: () => (
    <div class="flex w-[44rem] flex-col gap-1 rounded-xl border border-border p-2">
      <MessageRow
        senderKind="agent"
        senderName="Ada Lovelace"
        time="09:12"
        dateTime="2026-09-25T09:12:00Z"
        avatar={
          <Avatar size="sm">
            <AvatarFallback name="Ada Lovelace" />
          </Avatar>
        }
        onOpenThread={() => undefined}
      >
        <MessageBody text="I've read the worktree spec. The copy-on-write path is the one to take — the stream loop was never going to be fast enough for a 300MB tree." />
      </MessageRow>

      <MessageRow senderKind="user" senderName="You" time="09:14" dateTime="2026-09-25T09:14:00Z">
        <MessageBody text="Agreed. Can you check the ACL case before we commit to it?" />
      </MessageRow>

      <MessageRow
        senderKind="system"
        senderName="Adea"
        time="09:14"
        dateTime="2026-09-25T09:14:30Z"
      >
        <MessageBody text="Lane 'worktree evidence' finished in 2m 14s. 3 passed, 1 skipped." />
      </MessageRow>
    </div>
  ),
}

/**
 * The states a row takes.
 *
 * Each of these is a state a user will hit, and each one has to be legible without
 * reading the text: an edited message says so, a pending one says it is in flight, a
 * deleted one replaces its body, and a highlighted one is the row a search result
 * landed on.
 */
export const States: Story = {
  render: () => (
    <div class="flex w-[44rem] flex-col gap-1 rounded-xl border border-border p-2">
      <MessageRow senderKind="agent" senderName="Agent" time="09:12" edited>
        <MessageBody text="Edited after sending." />
      </MessageRow>
      <MessageRow senderKind="user" senderName="You" time="09:13" pending>
        <MessageBody text="Still in flight. The receipt is withheld until it lands." />
      </MessageRow>
      <MessageRow senderKind="agent" senderName="Agent" time="09:14" deleted>
        <MessageBody text="unused" />
      </MessageRow>
      <MessageRow
        senderKind="agent"
        senderName="Agent"
        time="09:15"
        highlighted
        onEdit={() => undefined}
        onDelete={() => undefined}
        onRetry={() => undefined}
        onOpenThread={() => undefined}
      >
        <MessageBody text="Highlighted, with every action available. Hover the row to reveal them." />
      </MessageRow>
    </div>
  ),
}

/** Attachments and a linked task, which are slots rather than built-ins. */
export const WithSlots: Story = {
  render: () => (
    <div class="flex w-[44rem] flex-col gap-1 rounded-xl border border-border p-2">
      <MessageRow
        senderKind="agent"
        senderName="Ada Lovelace"
        time="09:20"
        attachments={
          <>
            <AttachmentCard
              name="worktree-report.json"
              detail="application/json · 24,120 bytes"
              icon={<File />}
            />
            <AttachmentCard
              name="containment.txt"
              detail="Not authorized on this device"
              unavailable
              icon={<LockKeyhole />}
            />
          </>
        }
        link={
          <Button variant="outline" size="xs" class="gap-1.5">
            <Terminal />
            Task · Materialise four worktrees
          </Button>
        }
      >
        <MessageBody text="Two artifacts, and the evidence is attached." />
      </MessageRow>
    </div>
  ),
}

/** A code fence in a body, which a plain paragraph cannot render. */
/**
 * A fenced block in a body is a real `CodeBlock` — header, copy, focusable
 * scroller — and an inline span is `InlineCode`. Both are rendered from the text,
 * so a caller that has markdown gets the code surface without a markdown library.
 */
export const CodeInBody: Story = {
  render: () => (
    <div class="flex w-[44rem] flex-col gap-1 rounded-xl border border-border p-2">
      <MessageRow senderKind="agent" senderName="Ada Lovelace" time="09:24">
        <MessageBody
          text={
            'Here is the change:\n\n```ts\nconst digest = await hashTree(base)\n```\n\nIt replaces the stream loop, and the `keyedRows` helper keeps the rows alive.'
          }
        />
      </MessageRow>
    </div>
  ),
}

/**
 * `streaming` is a different state from `pending`. `pending` is the user's own
 * message still being sent; `streaming` is a turn that is still arriving. The
 * caret is what says "more is coming" without a spinner competing with the text.
 */
export const Streaming: Story = {
  render: () => (
    <div class="flex w-[44rem] flex-col gap-1 rounded-xl border border-border p-2">
      <MessageRow senderKind="user" senderName="You" time="09:23" pending>
        <MessageBody text="Summarise the diff for me" />
      </MessageRow>
      <MessageRow senderKind="agent" senderName="Ada Lovelace" streaming>
        <MessageBody
          streaming
          text={
            'The change replaces the stream loop with a digest:\n\n```ts\nconst digest = await hashTree(base)'
          }
        />
      </MessageRow>
    </div>
  ),
}

/** The composer, with a draft, an attach control and the keyboard hint. */
export const Composer: Story = {
  render: () => {
    const [draft, setDraft] = createSignal('')
    return (
      <div class="w-[44rem]">
        <MessageComposer
          value={draft()}
          onValueChange={setDraft}
          onSubmit={() => undefined}
          showHint
          placeholder="Write a message…"
          leading={<ComposerAttachmentButton count={2} />}
          trailing={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dictate"
              class="text-muted-foreground"
            >
              <Sparkles />
            </Button>
          }
        />
      </div>
    )
  },
}

/** A reply target, which is a strip above the field rather than a hidden mode. */
export const ComposerReplying: Story = {
  render: () => {
    const [draft, setDraft] = createSignal('Yes, the ACL case is handled.')
    return (
      <div class="w-[44rem]">
        <MessageComposer
          value={draft()}
          onValueChange={setDraft}
          onSubmit={() => undefined}
          submitLabel="Reply"
          replyTo={{ label: 'Ada Lovelace', onDismiss: () => undefined }}
        />
      </div>
    )
  },
}

/**
 * The scrolling surface.
 *
 * Scroll it: the jump-to-latest control appears once you are away from the end, and
 * an arriving message does **not** pull you back while you are reading. That second
 * behaviour is the one that matters — being yanked to the bottom mid-sentence is the
 * most common way a chat surface is made unusable.
 */
export const Surface: Story = {
  render: () => (
    <div class="h-96 w-[44rem] overflow-hidden rounded-xl border border-border">
      <ConversationSurface
        empty={<p class="text-muted-foreground text-center text-sm">No messages yet.</p>}
      >
        <MessageDayDivider label="Today" />
        {Array.from({ length: 24 }, (_, index) => (
          <MessageRow
            senderKind={index % 3 === 0 ? 'user' : 'agent'}
            senderName={index % 3 === 0 ? 'You' : 'Ada Lovelace'}
            time={`09:${String(index).padStart(2, '0')}`}
          >
            <MessageBody text={`Message ${index + 1}. Scroll up and the jump control appears.`} />
          </MessageRow>
        ))}
      </ConversationSurface>
    </div>
  ),
}

/** The thread panel, with its root message repeated above the replies. */
export const Thread: Story = {
  render: () => (
    <div class="h-96 w-[44rem] overflow-hidden rounded-xl border border-border">
      <ThreadPanel
        label="Ada Lovelace"
        count={2}
        onClose={() => undefined}
        root={
          <MessageRow senderKind="user" senderName="You" time="09:14">
            <MessageBody text="Can you check the ACL case before we commit to it?" />
          </MessageRow>
        }
        composer={
          <MessageComposer
            value=""
            onValueChange={() => undefined}
            onSubmit={() => undefined}
            submitLabel="Reply"
            placeholder="Reply…"
          />
        }
      >
        <MessageRow senderKind="agent" senderName="Ada Lovelace" time="09:16">
          <MessageBody text="Checked. A bulk clone inherits ACLs that CoW skips, which is why the stream loop was banned." />
        </MessageRow>
        <MessageRow senderKind="agent" senderName="Ada Lovelace" time="09:17">
          <MessageBody text="The manifest digest covers it, so a later reader can tell which path produced a tree." />
        </MessageRow>
      </ThreadPanel>
    </div>
  ),
}

/** The avatar's three kinds, at both sizes. */
export const Avatars: Story = {
  render: () => (
    <div class="flex items-center gap-4">
      <ConversationAvatar kind="user" size="lg" />
      <ConversationAvatar kind="agent" size="lg" />
      <ConversationAvatar kind="system" size="lg" />
      <ConversationAvatar kind="user" />
      <ConversationAvatar kind="agent" />
      <ConversationAvatar kind="system" />
      <ConversationAvatar kind="agent">
        <Badge size="sm" variant="success">
          A
        </Badge>
      </ConversationAvatar>
    </div>
  ),
}
