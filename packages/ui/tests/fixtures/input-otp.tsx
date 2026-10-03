import { render } from 'solid-js/web'
import { InputOtp } from '../../src/components/ui/input-otp/input-otp'
import '../../src/styles/globals.css'

function Fixture() {
  return (
    <main class="grid gap-4">
      <InputOtp aria-label="Verification code" length={6} />
      <InputOtp aria-label="Enabled code" length={4} disabled={false} />
    </main>
  )
}

render(() => <Fixture />, document.body)
