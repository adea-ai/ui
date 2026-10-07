import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Badge } from '../../ui/badge/badge'
import { AccountMenu, type AccountMenuItem } from './account-menu'

/**
 * AccountMenu.
 *
 * The trailing control in a rail or a top bar: the account, the way into settings, and
 * the way out. Every desktop application has one and they are all the same menu.
 *
 * The items are the caller's. An application adds and removes entries — a mobile
 * hand-off that only makes sense on desktop, a feedback link that only exists once
 * there is somewhere to send it — so a component that decided the list could not serve
 * two products. A `disabled` item is deliberately visible rather than hidden: a greyed
 * "Help Center" says the destination is coming, while an absent one says it does not
 * exist.
 */
const meta = {
  title: 'Composites/Account menu',
  component: AccountMenu,
  parameters: { layout: 'padded' },
  args: { items: [], authenticated: true },
  tags: ['autodocs'],
} satisfies Meta<typeof AccountMenu>

export default meta
type Story = StoryObj<typeof meta>

const standardItems: AccountMenuItem[] = [
  { id: 'mobile', label: 'Get Adea mobile', disabled: true },
  { id: 'about', label: 'About' },
  { id: 'help', label: 'Help Center', disabled: true },
  { id: 'feedback', label: 'Send Feedback', disabled: true },
  { id: 'updates', label: 'Updates', platform: 'desktop' },
  { id: 'settings', label: 'Settings', shortcut: '⌘,', keyshortcuts: 'Meta+,' },
]

/** The standard menu, signed in. */
export const Default: Story = {
  render: () => <AccountMenu items={standardItems} authenticated platform="desktop" />,
}

/** Signed out, which is the same menu with one row changed. */
export const SignedOut: Story = {
  render: () => <AccountMenu items={standardItems} authenticated={false} platform="desktop" />,
}

/** An item that declares a platform is absent on the other one. */
export const PlatformFiltered: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-3 text-sm">
      <AccountMenu items={standardItems} authenticated platform="web" />
      <p class="text-muted-foreground">
        <code>Updates</code> declares <code>platform: 'desktop'</code>, so it is absent on the web —
        where there is nothing to update.
      </p>
    </div>
  ),
}

/** Busy, while a sign-in or sign-out is in flight. */
export const Busy: Story = {
  render: () => {
    const [busy, setBusy] = createSignal(false)
    return (
      <div class="flex items-center gap-4">
        <AccountMenu
          items={standardItems}
          authenticated
          busy={busy()}
          onSignOut={() => {
            setBusy(true)
            setTimeout(() => setBusy(false), 2000)
          }}
        />
        <p class="text-sm text-muted-foreground">
          {busy() ? 'Signing out…' : 'Press the menu, then Sign out.'}
        </p>
      </div>
    )
  },
}

/** A caller's own icon and badge, which the item list allows. */
export const CustomItems: Story = {
  render: () => (
    <AccountMenu
      authenticated
      items={[
        {
          id: 'inbox',
          label: 'Notifications',
          icon: (
            <Badge size="sm" variant="destructive">
              3
            </Badge>
          ),
        },
        { id: 'settings', label: 'Settings', shortcut: '⌘,', keyshortcuts: 'Meta+,' },
        { id: 'about', label: 'About' },
      ]}
    />
  ),
}

/** An action that opens a second layer after this menu finishes closing. */
export const AfterCloseAction: Story = {
  render: () => {
    const [message, setMessage] = createSignal('')
    return (
      <div class="flex items-center gap-3">
        <AccountMenu
          items={[
            {
              id: 'updates',
              label: 'Updates',
              onSelect: () => setMessage('Selection received; waiting for the menu to close.'),
              onSelectAfterClose: (trigger) =>
                setMessage(
                  `Menu closed. Stable opener: ${trigger instanceof HTMLButtonElement ? 'button' : 'unavailable'}.`
                ),
            },
          ]}
          authenticated
        />
        <p class="text-sm text-muted-foreground" aria-live="polite">
          {message()}
        </p>
      </div>
    )
  },
}

/**
 * While an update waits, the trigger and the `updates` row each carry an accent
 * dot and their accessible names gain "update available" — the dot is drawn,
 * the words are announced. Both triggers render here: the bare icon button and
 * the rail row.
 */
export const UpdateAvailable: Story = {
  render: () => (
    <div class="flex flex-col items-start gap-6">
      <AccountMenu items={standardItems} authenticated platform="desktop" updateAvailable />
      <AccountMenu
        items={standardItems}
        authenticated
        platform="desktop"
        updateAvailable
        railTrigger
        placement="right-start"
      />
    </div>
  ),
}
