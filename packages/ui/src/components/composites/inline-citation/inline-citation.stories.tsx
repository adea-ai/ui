import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import type { Source } from '../sources/source'
import { InlineCitation } from './inline-citation'

const RLO = String.fromCharCode(0x202e)

const meta = {
  title: 'Composites/Inline Citation',
  component: InlineCitation,
  tags: ['autodocs'],
  args: { sources: [] },
  parameters: {
    docs: {
      description: {
        component:
          'A badge inside a sentence that opens the source behind the claim. Hover or keyboard focus peeks; click, tap, Enter or Space pins it and moves focus in. Several sources share one badge with Previous and Next. No sources renders nothing.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[34rem] max-w-full font-content text-content">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InlineCitation>

export default meta
type Story = StoryObj<typeof meta>

const solid: Source = {
  title: 'Solid reactivity, explained',
  url: 'https://docs.solidjs.com/concepts/intro-to-reactivity',
  snippet: 'Signals are the building block of reactivity. They track and notify subscribers.',
}
const kobalte: Source = {
  title: 'Kobalte popover',
  url: 'https://kobalte.dev/docs/core/components/popover',
  snippet: 'A popover is a non-modal dialog that floats near its trigger.',
}
const notes: Source = { title: 'docs/conventions.md' }

/** The badge sits on the baseline, never splits across a line, and the prose wraps around it. */
export const InProse: Story = {
  render: () => (
    <p class="m-0">
      Signals notify only the computations that read them
      <InlineCitation index={1} sources={[solid]} /> which is why components run once and updates
      are fine-grained. A popover is non-modal by default
      <InlineCitation index={2} sources={[kobalte]} /> so focus is not trapped unless asked for, and
      the conventions file says the same about primitives
      <InlineCitation index={3} sources={[notes]} />.
    </p>
  ),
}

/** Without a number the badge shows the host; a number is never guessed. */
export const HostBadge: Story = {
  render: () => (
    <p class="m-0">
      Reactivity is signal-based <InlineCitation sources={[solid]} /> and the popover is Kobalte's{' '}
      <InlineCitation sources={[kobalte]} />. A source with no address falls back to its title{' '}
      <InlineCitation sources={[notes]} />.
    </p>
  ),
}

/** Several sources behind one claim: the badge says so, and the popover pages through them. */
export const SeveralSources: Story = {
  render: () => (
    <p class="m-0">
      Both agree that updates are fine-grained
      <InlineCitation index={1} sources={[solid, kobalte, notes]} />.
    </p>
  ),
}

/**
 * Everything a web result can be made to say. The script address is not linked
 * and not printed; credentials in the URL are refused; the direction override and
 * the 4000-character title are cleaned and clipped; markup is text.
 */
export const HostileSource: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      <p class="m-0">
        A script address{' '}
        <InlineCitation
          index={1}
          sources={[{ title: 'Claim your prize', url: 'javascript:alert(1)' }]}
        />
      </p>
      <p class="m-0">
        Credentials in the URL{' '}
        <InlineCitation
          index={2}
          sources={[{ title: 'docs.example.com', url: 'https://docs.example.com@evil.example/' }]}
        />
      </p>
      <p class="m-0">
        Markup and a direction override{' '}
        <InlineCitation
          index={3}
          sources={[
            {
              title: `<img src=x onerror=alert(1)> invoice${RLO}fdp.exe`,
              url: 'https://example.com/invoice',
              snippet: '<script>alert(2)</script> '.repeat(40),
            },
          ]}
        />
      </p>
      <p class="m-0">
        A very long title and host{' '}
        <InlineCitation
          sources={[
            {
              title: 'T'.repeat(4000),
              url: `https://${'long-subdomain.'.repeat(8)}example.com/`,
              snippet: 'A long snippet that keeps going. '.repeat(60),
            },
          ]}
        />
      </p>
    </div>
  ),
}

/** Narrow column: the prose wraps and the badge goes with the word before it. */
export const NarrowColumn: Story = {
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-48 max-w-full font-content text-content">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <p class="m-0">
      Signals notify only the computations that read them
      <InlineCitation index={12} sources={[solid]} /> and nothing else re-runs
      <InlineCitation sources={[kobalte]} />.
    </p>
  ),
}

/** No sources, no badge: a marker that points nowhere is not a citation. */
export const NoSources: Story = {
  render: () => (
    <p class="m-0">
      This sentence cites nothing
      <InlineCitation sources={[]} /> and shows nothing after it.
    </p>
  ),
}
