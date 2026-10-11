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
import type { ComponentProps, JSX } from 'solid-js'
import { For, Show, createSignal, mergeProps, onCleanup, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import { Button, type ButtonProps } from '../../ui/button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip/tooltip'

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
  /** Run after the menu's close-focus cycle, with its trigger as a stable opener. */
  onSelectAfterClose?: (trigger: HTMLButtonElement | undefined) => void
}

/** Native trigger props passed to a host-owned trigger renderer. */
export type AccountMenuTriggerProps = ComponentProps<'button'> & {
  /** Accessible label for the account-menu trigger. */
  label: string
}

export type AccountMenuProps = {
  class?: string
  /** Anchor a rail menu beside its trigger, or keep the default upward placement. */
  placement?: ComponentProps<typeof DropdownMenu>['placement']
  /** Space between the trigger and menu, in pixels. */
  gutter?: ComponentProps<typeof DropdownMenu>['gutter']
  /** Hide the menu pointer when aligning it beside a compact rail. */
  hideArrow?: boolean
  /** The trigger size. Icon-only menus default to the standard icon size. */
  size?: ButtonProps['size']
  /** The entries above the separator. */
  items: readonly AccountMenuItem[]
  /** Which platform this is rendered on, for items that declare one. */
  platform?: 'desktop' | 'web'
  /** Whether a session exists. Decides the sign-in/sign-out row. */
  authenticated: boolean
  /** Local-only applications can omit the session actions altogether. */
  showSession?: boolean
  /** Disable the session row while a sign-in or sign-out is in flight. */
  busy?: boolean
  /** The name shown on the trigger's accessible label. */
  label?: string
  /**
   * Render the trigger with a host-owned control. Forward the supplied props to
   * the actual button; the host trigger owns any tooltip in this mode.
   */
  renderTrigger?: (props: AccountMenuTriggerProps) => JSX.Element
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
    'placement',
    'gutter',
    'hideArrow',
    'size',
    'items',
    'platform',
    'authenticated',
    'showSession',
    'busy',
    'label',
    'renderTrigger',
    'onSignIn',
    'onSignOut',
    'onIntent',
  ])

  let trigger: HTMLButtonElement | undefined
  let pendingAfterClose:
    | { callback: NonNullable<AccountMenuItem['onSelectAfterClose']> }
    | undefined
  let scheduledAfterClose:
    | { callback: NonNullable<AccountMenuItem['onSelectAfterClose']> }
    | undefined
  const [menuOpen, setMenuOpen] = createSignal(false)
  const [tooltipOpen, setTooltipOpen] = createSignal(false)

  onCleanup(() => {
    pendingAfterClose = undefined
    scheduledAfterClose = undefined
  })

  const visible = () =>
    local.items.filter((item) => !item.platform || item.platform === (local.platform ?? 'desktop'))

  const triggerLabel = () => local.label ?? 'Account and settings'

  const CustomTrigger = (props: ComponentProps<'button'>) => {
    const [triggerProps, triggerRest] = splitProps(props, ['ref', 'onFocus', 'onPointerEnter'])

    const customTriggerProps = mergeProps(triggerRest, {
      ref: (element: HTMLButtonElement) => {
        trigger = element
        if (typeof triggerProps.ref === 'function') triggerProps.ref(element)
      },
      onFocus: (event: FocusEvent & { currentTarget: HTMLButtonElement }) => {
        invokeEventHandler(triggerProps.onFocus, event)
        local.onIntent?.()
      },
      onPointerEnter: (event: PointerEvent & { currentTarget: HTMLButtonElement }) => {
        invokeEventHandler(triggerProps.onPointerEnter, event)
        local.onIntent?.()
      },
      get class() {
        return cn(triggerRest.class, local.class)
      },
      get label() {
        return triggerLabel()
      },
    })

    return local.renderTrigger?.(customTriggerProps)
  }

  return (
    <Tooltip open={tooltipOpen()} onOpenChange={(open) => setTooltipOpen(open && !menuOpen())}>
      <DropdownMenu
        modal={false}
        placement={local.placement ?? 'top-start'}
        gutter={local.gutter}
        onOpenChange={(open) => {
          setMenuOpen(open)
          if (open) setTooltipOpen(false)
        }}
      >
        {local.renderTrigger ? (
          <DropdownMenuTrigger
            as={CustomTrigger}
            type="button"
            aria-label={triggerLabel()}
            {...rest}
          >
            <UserRound aria-hidden="true" />
          </DropdownMenuTrigger>
        ) : (
          <>
            <TooltipTrigger
              as={AccountMenuButton}
              ref={(element: HTMLButtonElement) => (trigger = element)}
              variant="ghost"
              size={local.size ?? 'icon-md'}
              class={cn('text-muted-foreground', local.class)}
              aria-label={triggerLabel()}
              onFocus={() => local.onIntent?.()}
              onPointerEnter={() => local.onIntent?.()}
              {...rest}
            >
              <UserRound aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent placement="top">{triggerLabel()}</TooltipContent>
          </>
        )}
        <DropdownMenuContent
          hideArrow={local.hideArrow}
          class="min-w-56 max-h-(--kb-popper-available-height) overflow-x-hidden overflow-y-auto"
          onCloseAutoFocus={(event) => {
            const selection = pendingAfterClose
            pendingAfterClose = undefined
            if (!selection) return

            event.preventDefault()
            scheduledAfterClose = selection
            queueMicrotask(() => {
              if (scheduledAfterClose !== selection) return
              scheduledAfterClose = undefined
              selection.callback(trigger)
            })
          }}
        >
          <DropdownMenuGroup>
            <For each={visible()}>
              {(item) => (
                <DropdownMenuItem
                  disabled={item.disabled}
                  onSelect={() => {
                    pendingAfterClose = item.onSelectAfterClose
                      ? { callback: item.onSelectAfterClose }
                      : undefined
                    item.onSelect?.()
                  }}
                  shortcut={item.shortcut}
                >
                  {item.icon ?? renderFallbackIcon(item.id)}
                  <span>{item.label}</span>
                </DropdownMenuItem>
              )}
            </For>
          </DropdownMenuGroup>
          <Show when={local.showSession !== false}>
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
          </Show>
        </DropdownMenuContent>
      </DropdownMenu>
    </Tooltip>
  )
}

/** The common support menu, with one app-specific entry before the shared items. */
export function createAppMenuItems(options: {
  primaryItem?: AccountMenuItem
  settingsShortcut?: string
  onAbout?: AccountMenuItem['onSelectAfterClose']
  onHelp?: AccountMenuItem['onSelectAfterClose']
  onFeedback?: AccountMenuItem['onSelectAfterClose']
  onUpdates?: AccountMenuItem['onSelectAfterClose']
  onSettings?: AccountMenuItem['onSelectAfterClose']
}): AccountMenuItem[] {
  return [
    ...(options.primaryItem ? [options.primaryItem] : []),
    {
      id: 'about',
      label: 'About',
      disabled: !options.onAbout,
      onSelectAfterClose: options.onAbout,
    },
    {
      id: 'help',
      label: 'Help Center',
      disabled: !options.onHelp,
      onSelectAfterClose: options.onHelp,
    },
    {
      id: 'feedback',
      label: 'Send Feedback',
      disabled: !options.onFeedback,
      onSelectAfterClose: options.onFeedback,
    },
    {
      id: 'updates',
      label: 'Updates',
      platform: 'desktop',
      disabled: !options.onUpdates,
      onSelectAfterClose: options.onUpdates,
    },
    {
      id: 'settings',
      label: 'Settings',
      shortcut: options.settingsShortcut,
      disabled: !options.onSettings,
      onSelectAfterClose: options.onSettings,
    },
  ]
}

function AccountMenuButton(props: ComponentProps<typeof Button>) {
  return <DropdownMenuTrigger as={Button} {...props} />
}

/**
 * A known item id gets its conventional glyph, so a caller that only wants the
 * standard menu does not have to import six icons to get it.
 */
function renderFallbackIcon(id: string): JSX.Element {
  const Icon = FALLBACK_ICONS[id]
  return Icon ? <Icon aria-hidden="true" /> : null
}

function invokeEventHandler(handler: unknown, event: Event) {
  if (Array.isArray(handler)) {
    const [callback, data] = handler as [(data: unknown, event: Event) => void, unknown]
    callback(data, event)
  } else if (typeof handler === 'function') {
    const callback = handler as (event: Event) => void
    callback(event)
  }
}
