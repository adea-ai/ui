import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Trace, TraceLine } from '../../ui/trace'
import { StackTrace } from './stack-trace'
import type { StackFrame } from './parse-stack-trace'

const meta = {
  title: 'Composites/Stack Trace',
  component: StackTrace,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A failed call and its frames. V8/Node, Python and Rust backtraces are parsed into frames; the reader's own code is prominent and runs of dependency and runtime frames fold into one disclosure. Every line of the input stays on screen, a format it does not know is shown whole, and copy writes the text exactly as given. A frame is a button only when the host supplies `onOpenFrame`.",
      },
    },
  },
  args: { text: '' },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[40rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StackTrace>

export default meta
type Story = StoryObj<typeof meta>

const nodeTrace = `TypeError: Cannot read properties of undefined (reading 'id')
    at getRow (/repo/src/lib/keyed-rows.ts:42:17)
    at Array.map (<anonymous>)
    at render (/repo/src/app.tsx:10:5)
    at Object.<anonymous> (/repo/node_modules/solid-js/dist/solid.js:812:20)
    at runUpdates (/repo/node_modules/solid-js/dist/solid.js:900:3)
    at async Promise.all (index 0)
    at node:internal/process/task_queues:95:5
    at main (/repo/src/main.ts:7:3)`

/**
 * The reader's frames are prominent; the four framework and runtime frames in the
 * middle are one line that says what it holds. Nothing here is a button, because
 * the host did not say how to open a file.
 */
export const Node: Story = { args: { text: nodeTrace } }

/** With `onOpenFrame` the frames that name a file become buttons; `<anonymous>` stays text. */
export const OpenableFrames: Story = {
  render: () => {
    const [opened, setOpened] = createSignal<StackFrame>()
    return (
      <div class="flex flex-col gap-2">
        <StackTrace text={nodeTrace} onOpenFrame={setOpened} />
        <p class="text-xs text-muted-foreground" role="status">
          {opened()
            ? `Host asked to open ${opened()!.file}:${opened()!.line}`
            : 'Nothing opened yet.'}
        </p>
      </div>
    )
  },
}

export const Python: Story = {
  args: {
    text: `Traceback (most recent call last):
  File "/app/main.py", line 12, in <module>
    run()
  File "/usr/lib/python3.12/site-packages/click/core.py", line 1157, in __call__
    return self.main(*args, **kwargs)
  File "/usr/lib/python3.12/site-packages/click/core.py", line 1078, in main
    rv = self.invoke(ctx)
  File "/app/cli.py", line 31, in invoke
    data = json.loads(raw)
  File "/usr/lib/python3.12/json/decoder.py", line 355, in raw_decode
    raise JSONDecodeError("Expecting value", s, err.value) from None
json.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0)`,
  },
}

export const Rust: Story = {
  args: {
    text: `thread 'main' panicked at src/main.rs:5:9:
called \`Option::unwrap()\` on a \`None\` value
stack backtrace:
   0: rust_begin_unwind
             at /rustc/abc123/library/std/src/panicking.rs:645:5
   1: core::panicking::panic_fmt
             at /rustc/abc123/library/core/src/panicking.rs:72:14
   2: core::option::unwrap_failed
             at /rustc/abc123/library/core/src/option.rs:1978:5
   3: demo::main
             at ./src/main.rs:5:9
   4: std::rt::lang_start::{{closure}}
   5: tokio::runtime::task::harness::Harness<T,S>::poll
             at /home/me/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tokio-1.40.0/src/runtime/task/harness.rs:155:9
note: Some details are omitted, run with \`RUST_BACKTRACE=full\` for a verbose backtrace.`,
  },
}

/**
 * A format the parser does not recognise (a Go panic here). Nothing is invented
 * and nothing is hidden: the text is shown whole in a code block that copies it.
 */
export const UnknownFormat: Story = {
  args: {
    text: 'panic: runtime error: index out of range [3] with length 3\n\ngoroutine 1 [running]:\nmain.main()\n\t/app/main.go:7 +0x1d\nexit status 2',
  },
}

/** No frame belongs to the reader, so nothing folds: collapsing it all would hide the trace. */
export const AllDependencies: Story = {
  args: {
    text: `Error: socket hang up
    at connResetException (node:internal/errors:720:14)
    at Socket.socketOnEnd (node:_http_client:525:23)
    at /repo/node_modules/undici/lib/core/request.js:112:9
    at /repo/node_modules/undici/lib/core/client.js:1032:5`,
  },
}

/** Messages, source lines and paths are text: nothing here is markup or a link. */
export const HostileText: Story = {
  args: {
    text: `<img src=x onerror=alert(1)>: <script>alert(2)</script>
    at <b>bold</b> (javascript:alert(3):1:1)
    at ${'a'.repeat(300)} (/repo/src/long.ts:1:1)
    at fn (/repo/src/${'deeply/'.repeat(30)}file.ts:9:9)`,
  },
}

/** A run of one dependency frame is dimmed and spoken as "in a dependency" rather than folded behind a disclosure. */
export const SingleDependencyFrame: Story = {
  args: {
    text: `RangeError: Maximum call stack size exceeded
    at a (/repo/src/a.ts:1:1)
    at b (/repo/node_modules/lib/index.js:2:2)
    at c (/repo/src/c.ts:3:3)`,
  },
}

const longTrace = `Error: deep recursion\n${Array.from(
  { length: 1200 },
  (_, i) => `    at level${i} (/repo/src/recursion.ts:${i + 1}:5)`
).join('\n')}`

/** 1 200 frames: the first 200 are mounted and "show more" reveals the rest in pages. */
export const VeryLong: Story = { args: { text: longTrace } }

/** Inside the Trace line for the call that failed. */
export const InsideTrace: Story = {
  render: () => (
    <Trace aria-label="Activity">
      <TraceLine title="Ran the migration" description="failed" status="error" defaultOpen>
        <StackTrace text={nodeTrace} />
      </TraceLine>
    </Trace>
  ),
}
