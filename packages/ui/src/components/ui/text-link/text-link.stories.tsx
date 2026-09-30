import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { TextLink } from './text-link'

const meta = {
  title: 'Primitives/Navigation/TextLink',
  component: TextLink,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof TextLink>

export default meta
type Story = StoryObj<typeof meta>

/** The inline link remains legible through its underline in either theme. */
export const Inline: Story = {
  render: () => (
    <main class="max-w-prose space-y-4">
      <h1 class="text-xl font-semibold">Help and documentation</h1>
      <p class="text-sm text-muted-foreground">
        Read the <TextLink href="#usage">usage guide</TextLink> before connecting a new source.
      </p>
      <section id="usage" tabIndex={-1} aria-label="Usage guide">
        <h2 class="text-base font-semibold">Usage guide</h2>
      </section>
    </main>
  ),
}

/** External navigation retains its destination and caller-supplied safety attributes. */
export const External: Story = {
  render: () => (
    <p>
      Visit the{' '}
      <TextLink href="https://example.com/docs" target="_blank" rel="noopener noreferrer">
        documentation site
      </TextLink>
      .
    </p>
  ),
}
