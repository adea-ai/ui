import {
  CircleHelp,
  Info,
  LogIn,
  LogOut,
  Megaphone,
  RefreshCw,
  Settings2,
  Smartphone,
  UserRound,
} from 'lucide-solid'
import type { JSX } from 'solid-js'
import { For, Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import { Button } from '../../ui/button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu/dropdown-menu'

/**
 * AccountMenu.
 *
 * The trailing control in a rail or a top bar: the account, the way into settings,
 * and the way out. Every desktop application has one and they are all the same menu,
 * which is why it belongs here rather than being redrawn per app.
 *
 * ## The items are the caller's
 *
 * The menu takes a list rather than hard-coding one. An application adds and removes
 * entries — a mobile hand-off that only makes sense on desktop, a feedback link that
 * only exists once there is somewhere to send it — and a component that decided the
 * list could not be used by two products.
 *
 * `disabled` on an item is deliberately visible rather than hidden: a greyed "Help
 * Center" says the destination is coming, while an absent one says it does not exist.
 */
export type AccountMenuItem = {
  id: string
  label: string
  icon?: JSX.Element
  /** A chord drawn at the trailing edge, e.g. `⌘,`. */
  shortcut?: string
  disabled?: boolean
  /** Render only on this platform. Omit to always render. */
  platform?: 'desktop' | 'web'
  onSelect?: () => void
}

export type AccountMenuProps = {
  class?: string
  /** The entries above the separator. */
  items: readonly AccountMenuItem[]
  /** Which platform this is rendered on, for items that declare one. */
  platform?: 'desktop' | 'web'
  /** Whether a session exists. Decides the sign-in/sign-out row. */
  authenticated: boolean
  /** Disable the session row while a sign-in or sign-out is in flight. */
  busy?: boolean
  /** The name shown on the trigger's accessible label. */
  label?: string
  onSignIn?: () => void
  onSignOut?: () => void
  /** Fires on hover or focus of the trigger — a chance to prefetch. */
  onIntent?: () => void
}

const FALLBACK_ICONS: Record<string, typeof Settings2> = {
  mobile: Smartphone,
  settings: Settings2,
  about: Info,
  help: CircleHelp,
  feedback: Megaphone,
  updates: RefreshCw,
}

export function AccountMenu(props: AccountMenuProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'items',
    'platform',
    'authenticated',
    'busy',
    'label',
    'onSignIn',
    'onSignOut',
    'onIntent',
  ])

  const visible = () =>
    local.items.filter((item) => !item.platform || item.platform === (local.platform ?? 'desktop'))

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        as={Button}
        variant="ghost"
        size="icon-md"
        class={cn('text-muted-foreground', local.class)}
        aria-label={local.label ?? 'Account and settings'}
        onFocus={() => local.onIntent?.()}
        onPointerEnter={() => local.onIntent?.()}
        {...rest}
      >
        <UserRound aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" class="min-w-56">
        <DropdownMenuGroup>
          <For each={visible()}>
            {(item) => (
              <DropdownMenuItem
                disabled={item.disabled}
                onSelect={() => item.onSelect?.()}
                shortcut={item.shortcut}
              >
                {item.icon ?? renderFallbackIcon(item.id)}
                <span>{item.label}</span>
              </DropdownMenuItem>
            )}
          </For>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={local.busy}
            onSelect={() => (local.authenticated ? local.onSignOut?.() : local.onSignIn?.())}
          >
            <Show when={local.authenticated} fallback={<LogIn aria-hidden="true" />}>
              <LogOut aria-hidden="true" />
            </Show>
            <span>{local.authenticated ? 'Sign out' : 'Sign in'}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * A known item id gets its conventional glyph, so a caller that only wants the
 * standard menu does not have to import six icons to get it.
 */
function renderFallbackIcon(id: string): JSX.Element {
  const Icon = FALLBACK_ICONS[id]
  return Icon ? <Icon aria-hidden="true" /> : null
}
