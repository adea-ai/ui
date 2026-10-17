import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Attachment, AttachmentList, formatAttachmentSize } from './attachment'

const meta = {
  title: 'UI/Attachment',
  component: Attachment,
  tags: ['autodocs'],
  args: { name: 'deployment-plan.md', kind: 'text', size: 18_432 },
  parameters: {
    docs: {
      description: {
        component:
          'A file that travels with a message or sits in the composer. It draws an action only when the caller supplied the handler, so an attachment the host cannot reopen is a static chip, not a dead button.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[30rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Attachment>

export default meta
type Story = StoryObj<typeof meta>

/** No handlers: static text. This is what an echoed-back name should be. */
export const Static: Story = {}

export const Removable: Story = { args: { onRemove: () => undefined } }

export const Openable: Story = { args: { onOpen: () => undefined, onRemove: () => undefined } }

export const Card: Story = { args: { variant: 'card', onOpen: () => undefined } }

export const Uploading: Story = {
  args: { status: 'uploading', progress: 42, onRemove: () => undefined },
}

export const Failed: Story = {
  args: { status: 'error', statusLabel: 'Larger than 10 MB', onRemove: () => undefined },
}

export const Unavailable: Story = {
  args: { status: 'unavailable', statusLabel: 'File no longer stored' },
}

/** An unsafe preview source (script-capable SVG, javascript:) is ignored, not rendered. */
export const UnsafePreviewIgnored: Story = {
  args: {
    variant: 'tile',
    kind: 'image',
    name: 'diagram.svg',
    previewSrc: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
  },
}

export const LongName: Story = {
  args: {
    name: `${'very-long-file-name-'.repeat(6)}final.tsx`,
    kind: 'code',
    onRemove: () => undefined,
  },
}

export const List: Story = {
  render: () => (
    <AttachmentList aria-label="3 attachments">
      <li>
        <Attachment name="plan.md" kind="text" size={2048} />
      </li>
      <li>
        <Attachment name="trace.log" kind="text" size={4_800_000} onRemove={() => undefined} />
      </li>
      <li>
        <Attachment
          name="spec.pdf"
          kind="document"
          size={formatAttachmentSize(1)?.length}
          status="uploading"
        />
      </li>
    </AttachmentList>
  ),
}
