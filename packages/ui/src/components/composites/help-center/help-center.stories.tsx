import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { HelpCenter } from './help-center'

const meta = {
  title: 'Composites/Help Center',
  component: HelpCenter,
  tags: ['autodocs'],
  args: {
    appName: 'Adea',
    shortcuts: [
      { label: 'Open settings', keys: ['⌘', ','] },
      { label: 'Find in workspace', keys: ['⌘', 'K'] },
    ],
    links: [
      {
        label: 'Adea on GitHub',
        description: 'Source code, releases, and project discussions.',
        url: 'https://github.com/adea-ai/adea',
      },
      {
        label: 'Send Feedback',
        url: 'https://github.com/adea-ai/adea/issues/new?template=feedback.yml',
      },
    ],
  },
} satisfies Meta<typeof HelpCenter>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
/** Long resource labels wrap within the page at narrow widths. */
export const LongResources: Story = {
  args: {
    links: [
      {
        label: 'Project documentation and detailed desktop setup instructions',
        description: 'Guides for desktop updates, shortcuts, and workspace setup.',
        url: 'https://github.com/adea-ai/adea',
      },
    ],
  },
}
