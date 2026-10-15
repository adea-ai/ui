import { render } from 'solid-js/web'
import { StackTrace } from '../../src/components/composites/stack-trace'
import '../../src/styles/globals.css'

/**
 * Hostile-size traces for the browser spec. Each is built here, in the page, so
 * the test does not push tens of megabytes through the automation channel; the
 * copy spy compares what the component wrote with the exact string it was given.
 */
type Recorded = { copies: { name: string; exact: boolean; length: number }[]; opened: unknown[] }
const recorded: Recorded = { copies: [], opened: [] }
;(window as Window & { recorded?: Recorded }).recorded = recorded

const HEADER_MESSAGE = 'h'.repeat(1_000_000)
const header = `Error: ${HEADER_MESSAGE}\n    at run (/app/src/run.ts:10:5)\n    at main (/app/src/main.ts:2:1)`

// One Python frame with 9 996 source/locals lines of about 4 000 characters.
const DETAIL_LINES = 9_996
const detail = Array.from(
  { length: DETAIL_LINES },
  (_, index) => `    ${String(index).padStart(4, '0')} ${'d'.repeat(3_989)}`
)
const python = [
  'Traceback (most recent call last):',
  '  File "/app/job.py", line 3, in run',
  ...detail,
  'ValueError: bad input',
].join('\n')

// A dependency run of 9 997 frames between two of the reader's own, 10 000 lines in all.
const GROUP_FRAMES = 9_997
const group = [
  'Error: boom',
  '    at app (/app/src/app.ts:1:1)',
  ...Array.from(
    { length: GROUP_FRAMES },
    (_, index) => `    at dep${index} (/app/node_modules/pkg/index.js:${index + 1}:1)`
  ),
  '    at last (/app/src/last.ts:9:9)',
].join('\n')

const cases = [
  { name: 'Huge header', text: header },
  { name: 'Huge frame detail', text: python },
  { name: 'Huge dependency group', text: group },
]

const writeText = navigator.clipboard.writeText.bind(navigator.clipboard)
navigator.clipboard.writeText = async (text: string) => {
  const match = cases.find((item) => item.text === text)
  recorded.copies.push({ name: match?.name ?? '', exact: match !== undefined, length: text.length })
  // Forward only what can be read back cheaply; the spy has the comparison.
  await writeText(text.length > 2_000_000 ? '' : text)
}

render(
  () => (
    <main class="w-2xl max-w-full p-4">
      {cases.map((item) => (
        <section aria-label={item.name} class="mb-6">
          <StackTrace
            text={item.text}
            onCopy={() => undefined}
            onOpenFrame={(frame) =>
              recorded.opened.push({
                case: item.name,
                function: frame.function,
                raw: frame.raw,
                detailLength: frame.detail?.length ?? 0,
              })
            }
          />
        </section>
      ))}
    </main>
  ),
  document.body
)
