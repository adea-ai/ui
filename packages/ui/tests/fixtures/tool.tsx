import { render } from 'solid-js/web'
import { Tool } from '../../src/components/composites/tool'
import { Trace } from '../../src/components/ui/trace'
import '../../src/styles/globals.css'

/** Every Tool status in one trace, each with the detail a host could really hold. */
render(
  () => (
    <main class="flex w-md max-w-full flex-col gap-4 p-4">
      <Trace aria-label="Tool calls">
        <Tool id="tool-success" name="read_file" description="README.md" status="success" />
        <Tool id="tool-running" name="run_tests" status="running" />
        <Tool id="tool-error" name="deploy" status="error" errorText="exit 1" />
        <Tool
          id="tool-denied"
          name="delete_branch"
          status="denied"
          input={{ branch: 'feat/old' }}
        />
        <Tool
          id="tool-cancelled"
          name="bun test"
          description="packages/db"
          status="cancelled"
          defaultOpen
          input={{ command: 'bun test packages/db' }}
          output={'(pass) applies every migration twice\n(pass) keeps the journal append-only'}
        />
        <Tool id="tool-nostatus" name="inspect" />
      </Trace>
    </main>
  ),
  document.body
)
