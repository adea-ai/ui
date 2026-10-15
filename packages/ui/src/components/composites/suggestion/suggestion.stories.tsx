import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Suggestion, Suggestions } from './suggestion'

// A right-to-left override, built from its code point so the file holds no hidden characters.
const RLO = String.fromCharCode(0x202e)

const meta = {
  title: 'Composites/Suggestion',
  component: Suggestions,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A row of one-click prompt chips. Each chip is the text that will be sent; onSelect reports which one. Wraps by default, or scrolls on one line; chips are real buttons so overflow is reachable by keyboard. Disabled chips stay focusable and the reason is in words.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[34rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Suggestions>

export default meta
type Story = StoryObj<typeof meta>

const prompts = [
  'Summarise the open risks',
  'Draft the release notes',
  'Explain this stack trace',
  'Write a test for the parser',
  'What changed since Monday?',
]

/** Choosing a chip reports its text; what to do with it (send, or fill the composer) is the host's. */
export const Default: Story = {
  render: () => {
    const [chosen, setChosen] = createSignal<string>()
    return (
      <div class="flex flex-col gap-2">
        <Suggestions onSelect={setChosen}>
          {prompts.map((text) => (
            <Suggestion text={text} />
          ))}
        </Suggestions>
        <p class="m-0 text-xs text-muted-foreground" role="status">
          {chosen() ? `Chosen: ${chosen()}` : 'Nothing chosen yet.'}
        </p>
      </div>
    )
  },
}

/** A narrow column: the chips wrap onto further lines instead of overflowing. */
export const Narrow: Story = {
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-56 max-w-full">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Suggestions onSelect={() => undefined}>
      {prompts.map((text) => (
        <Suggestion text={text} />
      ))}
    </Suggestions>
  ),
}

/** One line that scrolls sideways; tabbing through the chips scrolls each into view. */
export const Scrolling: Story = {
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Suggestions layout="scroll" onSelect={() => undefined}>
      {prompts.map((text) => (
        <Suggestion text={text} />
      ))}
    </Suggestions>
  ),
}

/** A chip is one line: long text is clipped in the label, kept in the title, and sent whole. */
export const LongAndHostileText: Story = {
  render: () => (
    <Suggestions onSelect={(text) => console.info('sent', text.length)}>
      <Suggestion text={`Review every file in the repository and ${'keep going '.repeat(40)}`} />
      <Suggestion text="<img src=x onerror=alert(1)>" />
      <Suggestion text={`RTL${RLO}txt.exe`} />
      <Suggestion text="Short" />
    </Suggestions>
  ),
}

/** The host says why: the chips stay, stay focusable, and the reason is read with each. */
export const DisabledWithReason: Story = {
  render: () => (
    <Suggestions
      onSelect={() => undefined}
      disabledReason="Wait for the current reply to finish before choosing a suggestion."
    >
      {prompts.slice(0, 3).map((text) => (
        <Suggestion text={text} />
      ))}
    </Suggestions>
  ),
}

/** No handler: disabled, and still explained. */
export const NoHandler: Story = {
  render: () => (
    <Suggestions>
      {prompts.slice(0, 3).map((text) => (
        <Suggestion text={text} />
      ))}
    </Suggestions>
  ),
}
