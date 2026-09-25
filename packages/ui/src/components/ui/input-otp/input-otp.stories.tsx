import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { InputOtp } from './input-otp'

/**
 * InputOtp.
 *
 * A one-time code, entered into separate boxes. The boxes are the *paint*: the value
 * lives in a single real input, so paste works, autofill works, and a password
 * manager sees one field rather than six.
 *
 * That split is the reason to use a component rather than six inputs. Six inputs
 * cannot be pasted into, cannot be autofilled, and announce as six unrelated fields —
 * every one of which a user hits on the first try.
 */
const meta = {
  title: 'Primitives/Forms/Input OTP',
  component: InputOtp,
  parameters: { layout: 'padded' },
  args: { length: 6 },
  tags: ['autodocs'],
} satisfies Meta<typeof InputOtp>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <InputOtp aria-label="Verification code" length={6} />,
}

/** Grouped, which is how a code is usually written down. */
export const Grouped: Story = {
  render: () => <InputOtp aria-label="Verification code" length={6} groups={[3, 3]} />,
}

/** Longer, for a recovery code. */
export const RecoveryCode: Story = {
  render: () => <InputOtp aria-label="Recovery code" length={8} groups={[4, 4]} />,
}

/** Disabled, while the code is being verified. */
export const Disabled: Story = {
  render: () => <InputOtp aria-label="Verification code" length={6} disabled />,
}
