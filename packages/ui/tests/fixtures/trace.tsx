import { render } from 'solid-js/web'
import { CodeBlock } from '../../src/components/ui/code-block'
import { Trace, TraceDetail, TraceLine } from '../../src/components/ui/trace'
import '../../src/styles/globals.css'

type TraceWindow = Window & { traceEvents?: string[] }
const log = (event: string) => ((window as TraceWindow).traceEvents ??= []).push(event)

render(
  () => (
    <main class="flex w-md max-w-full flex-col gap-4 p-4">
      <button id="before" type="button">
        Before the trace
      </button>
      <Trace aria-label="Agent activity">
        <TraceLine
          id="line-toggle"
          title="Read config"
          description="src/config.ts"
          status="success"
          meta="12 ms"
          onOpenChange={(open) => log(`toggle:${open}`)}
        >
          <TraceDetail>Loaded three keys</TraceDetail>
        </TraceLine>
        <TraceLine id="line-static" title="Planned the change" status="success" />
        <TraceLine id="line-running" title="Running tests" status="running" />
        <TraceLine id="line-pending" title="Deploy" status="pending" />
        <TraceLine id="line-error" title="Type check" status="error" />
        <TraceLine id="line-cancelled" title="Lint" status="cancelled" />
        <TraceLine
          id="line-custom"
          title="Fetch"
          status="success"
          statusLabel="Done in 2 seconds"
        />
        <TraceLine id="line-nostatus" title="Heard back from the host" />
        <TraceLine id="line-link" title="Docs" href="https://example.com/docs" />
        <TraceLine id="line-select" title="Open the diff" onSelect={() => log('select')} />
        <TraceLine id="line-nested" title="Subagent: reviewer" status="success">
          <Trace size="sm" aria-label="Reviewer steps">
            <TraceLine id="line-step" title="Ran grep" description="3 matches">
              <TraceDetail>
                <CodeBlock
                  id="nested-output"
                  size="sm"
                  language="text"
                  complete
                  code={'src/a.ts:12: TODO\nsrc/b.ts:40: TODO\nsrc/c.ts:7: TODO'}
                />
              </TraceDetail>
            </TraceLine>
          </Trace>
        </TraceLine>
      </Trace>
      <button id="after" type="button">
        After the trace
      </button>
    </main>
  ),
  document.body
)
