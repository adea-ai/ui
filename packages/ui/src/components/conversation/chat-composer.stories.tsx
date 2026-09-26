import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Button } from '../ui/button/button'
import { ChatComposer } from './chat-composer'
import type { BusySendMode } from './busy-send-button'

const meta = {
  title: 'Conversation/Composed input',
  component: ChatComposer,
  args: { value: '', onValueChange: () => undefined, onSubmit: () => undefined },
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof ChatComposer>
export default meta
type Story = StoryObj<typeof meta>
function Composed(props: { blocked?: boolean; collapsed?: boolean; busy?: boolean }) {
  const [draft, setDraft] = createSignal('A draft to keep while reading')
  const [collapsed, setCollapsed] = createSignal(props.collapsed ?? false)
  const [mode, setMode] = createSignal<BusySendMode>('steer')
  return (
    <ChatComposer
      value={draft()}
      onValueChange={setDraft}
      onSubmit={() => {
        setDraft('')
      }}
      collapse={{ value: collapsed(), onChange: setCollapsed }}
      blockedReason={props.blocked ? 'Reconnect to send this draft' : undefined}
      busy={
        props.busy
          ? {
              mode: mode(),
              onModeChange: setMode,
              unavailable: { queue: 'This harness has no queue operation' },
            }
          : undefined
      }
      knowledge={
        <p class="text-muted-foreground text-xs">
          Selected knowledge context stays distinct from the draft.
        </p>
      }
      followUps={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setDraft('Show the supporting evidence')}
        >
          Show supporting evidence
        </Button>
      }
      band={<p class="text-muted-foreground text-xs">Review the plan before sending.</p>}
      attachments={
        <p class="text-muted-foreground px-4 py-2 text-xs">Staged: implementation-plan.md</p>
      }
      context={
        <>
          <Button type="button" variant="ghost" size="sm">
            Agent: Ada
          </Button>
          <Button type="button" variant="ghost" size="sm">
            Model: selected by host
          </Button>
        </>
      }
    />
  )
}
export const ComposedHierarchy: Story = { render: () => <Composed /> }
export const ReadingWithDraft: Story = { render: () => <Composed collapsed /> }
export const OfflineRecovery: Story = { render: () => <Composed blocked /> }
export const BusyCapability: Story = { render: () => <Composed busy /> }
export const ApprovalFocus: Story = {
  render: () => (
    <ChatComposer
      value="Unsent draft"
      onValueChange={() => undefined}
      onSubmit={() => undefined}
      approvalFocus
      approval={<p role="status">Review the pending operation in its owning application.</p>}
    />
  ),
}
