import { render } from 'solid-js/web'
import { Confirmation } from '../../src/components/composites/confirmation'
import '../../src/styles/globals.css'

type FixtureWindow = Window & { blankReasonCalls: number; resolveApproval?: () => void }

const fixture = window as unknown as FixtureWindow
fixture.blankReasonCalls = 0
fixture.resolveApproval = () => undefined

render(
  () => (
    <>
      <Confirmation
        id="confirmation"
        title="Run the command?"
        onApprove={() =>
          new Promise<void>((resolve) => {
            fixture.resolveApproval = resolve
          })
        }
        onDeny={() => undefined}
      />
      <Confirmation
        id="blank-reason"
        title="Run with an empty host reason?"
        disabledReason=""
        onApprove={() => {
          fixture.blankReasonCalls += 1
        }}
        onDeny={() => undefined}
      />
    </>
  ),
  document.body
)
