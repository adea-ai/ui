import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Sources } from './sources'
import type { Source } from './source'

const RLO = String.fromCharCode(0x202e)

const meta = {
  title: 'Composites/Sources',
  component: Sources,
  tags: ['autodocs'],
  args: { sources: [] },
  parameters: {
    docs: {
      description: {
        component:
          'The links a reply used: one Trace line, "Used N sources", that expands into the list. A row is a link only with an http, https or mailto address; the host is read from the parsed URL; nothing is merged, so two entries with one URL are two rows. No sources, no line.',
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
} satisfies Meta<typeof Sources>

export default meta
type Story = StoryObj<typeof meta>

const reading: Source[] = [
  {
    id: 'a',
    title: 'Solid reactivity, explained',
    url: 'https://docs.solidjs.com/concepts/intro-to-reactivity',
    snippet: 'Signals are the building block of reactivity. They track and notify subscribers.',
  },
  {
    id: 'b',
    title: 'Kobalte popover',
    url: 'https://kobalte.dev/docs/core/components/popover',
    snippet: 'A popover is a non-modal dialog that floats near its trigger.',
  },
  { id: 'c', title: 'Release notes 0.131', url: 'https://github.com/adea-ai/ui/releases' },
  { id: 'd', title: 'docs/conventions.md' },
]

export const Collapsed: Story = {
  args: { sources: reading },
}

/** Open, with a source that has no address (a local file) and a host shown under each linked title. */
export const Open: Story = {
  args: { sources: reading, defaultOpen: true },
}

/** Two passages from one page stay two rows: citations point at positions, so merging would renumber them. */
export const SharedUrl: Story = {
  args: {
    defaultOpen: true,
    sources: [
      {
        id: '1',
        title: 'Pricing, section 2',
        url: 'https://example.com/pricing#limits',
        snippet: 'Limits reset monthly.',
      },
      {
        id: '2',
        title: 'Pricing, section 5',
        url: 'https://example.com/pricing#limits',
        snippet: 'Overage is billed at the end of the cycle.',
      },
    ],
  },
}

/**
 * Everything a web result can be made to say. The script address is neither linked
 * nor printed; credentials in a URL make the shown host a lie, so that row is not
 * linked either; the direction override and the megabyte title are cleaned and clipped;
 * the look-alike host appears in its punycode form.
 */
export const HostileValues: Story = {
  args: {
    defaultOpen: true,
    sources: [
      { title: 'Click here to claim your prize', url: 'javascript:alert(document.cookie)' },
      { title: 'docs.example.com', url: 'https://trusted.example@evil.example/login' },
      { title: `Bank statement${RLO}fdp.exe`, url: 'https://example.com/statement' },
      { title: 'A'.repeat(4000), url: 'https://example.com/long' },
      { title: 'Look-alike', url: 'https://exаmple.com/' },
      { title: '<img src=x onerror=alert(1)>', url: 'data:text/html,<script>alert(1)</script>' },
      {
        title: 'Very long snippet',
        url: 'https://example.com/snippet',
        snippet: 'This sentence repeats to prove the snippet is clipped. '.repeat(60),
      },
    ],
  },
}

/** Two hundred sources: 25 rows, then a button that names the rest. The button stays put and toggles. */
export const TwoHundredSources: Story = {
  args: {
    defaultOpen: true,
    sources: Array.from({ length: 200 }, (_, index) => ({
      id: `s-${index}`,
      title: `Result ${index + 1}: ${'a longer title '.repeat(index % 4)}`,
      url: `https://site-${index % 17}.example.com/page/${index}`,
      snippet: index % 3 === 0 ? 'A short excerpt from the page.' : undefined,
    })),
  },
}

/** One source reads in the singular. */
export const Single: Story = {
  args: { sources: [reading[0]!] },
}

/** Nothing used, nothing said: "Used 0 sources" would be a claim about an ungrounded answer. */
export const Empty: Story = {
  args: { sources: [] },
  render: (args) => (
    <div class="flex flex-col gap-2">
      <p class="m-0 text-sm">An answer with no sources. Nothing is drawn under it.</p>
      <Sources {...args} />
    </div>
  ),
}
