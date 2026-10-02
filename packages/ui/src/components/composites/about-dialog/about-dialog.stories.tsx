import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Button } from '../../ui/button'
import { AboutDialog } from './about-dialog'

const meta = {
  title: 'Composites/About Dialog',
  component: AboutDialog,
  tags: ['autodocs'],
  render: (args) => {
    const [open, setOpen] = createSignal(args.open)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open about</Button>
        <AboutDialog {...args} open={open()} onOpenChange={setOpen} />
      </>
    )
  },
  args: {
    appName: 'Cortana',
    appIcon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='4' y='4' width='56' height='56' rx='14' fill='none' stroke='GrayText'/%3E%3Cpath d='M42 21a16 16 0 1 0 0 22' fill='none' stroke='GrayText'/%3E%3C/svg%3E",
    version: '0.64.0',
    platform: 'desktop',
    copyright: 'Copyright © 2026 Cortana contributors',
    sourceUrl: 'https://github.com/adea-ai/cortana',
    open: true,
    onOpenChange: () => {},
    copyVersionInfo: async () => {},
    openExternal: async () => {},
  },
} satisfies Meta<typeof AboutDialog>
export default meta
type Story = StoryObj<typeof meta>

/** The app name is the title; no duplicate About heading or marketing description. */
export const Default: Story = {}
/** A missing native version stays honest and does not render an invented fallback. */
export const VersionUnavailable: Story = { args: { version: undefined } }
/** A denied clipboard permission leaves a retryable message in the dialog. */
export const ClipboardDenied: Story = {
  args: {
    copyVersionInfo: async () => {
      throw new Error('Denied')
    },
  },
}
