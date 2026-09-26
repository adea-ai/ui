import { Toast as KobalteToast, type ToastComponentProps, toaster } from '@kobalte/core/toast'
import { X } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * Toast.
 *
 * A short, self-dismissing message about something that already happened.
 *
 * The rules that make toasts helpful rather than hostile are built into this
 * API rather than left to callers:
 *
 *   - A toast never carries the only route to an action. Anything important
 *     enough to need doing belongs in the interface, not in a message that
 *     disappears. `action` exists, but it is a convenience, not a flow.
 *   - Errors from user-initiated work get `priority="high"` so a screen reader
 *     interrupts to announce them; background progress uses the default low
 *     priority so it is not read over whatever the user is doing.
 *   - A toast with a way to undo is preferred to a confirmation dialog for a
 *     reversible action. Undo after the fact costs the user nothing; a modal
 *     before it costs everyone a click.
 *
 * `Toaster` is mounted once, near the root of the app.
 */

type ToastTone = 'default' | 'success' | 'warning' | 'destructive' | 'info'

/**
 * The tone dot's colour. A custom property rather than five colour utilities
 * because the value is applied inline (the tone is data, not markup) and a
 * Tailwind colour class cannot be built from a runtime value without becoming
 * invisible to the linter.
 */
const toastTones: Record<ToastTone, string> = {
  default: 'var(--foreground)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  destructive: 'var(--destructive)',
  info: 'var(--info)',
}

export type ToastOptions = {
  title: string
  description?: string
  tone?: ToastTone
  /** A control rendered inside the toast, usually an Undo. */
  action?: JSX.Element
  /** Keep the toast until it is dismissed. Use for a failure the user must see. */
  persistent?: boolean
  /** Milliseconds before auto-dismiss. Overrides the region's setting. */
  duration?: number
  /** Which Toaster region to render into. */
  region?: string
}

function ToastCard(props: ToastComponentProps & ToastOptions) {
  const tone = () => props.tone ?? 'default'

  return (
    <KobalteToast
      toastId={props.toastId}
      /**
       * A user-initiated outcome is announced; a background one waits its turn.
       * A failure the user caused is worth interrupting for; a sync finishing
       * quietly is not.
       */
      priority={tone() === 'destructive' ? 'high' : 'low'}
      duration={props.duration}
      persistent={props.persistent}
      class={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border bg-popover p-3 shadow-lg',
        'data-[opened]:animate-in data-[opened]:slide-in-from-right-full data-[opened]:fade-in-0',
        'data-[closed]:animate-out data-[closed]:slide-out-to-right-full data-[closed]:fade-out-0',
        'data-[swipe=move]:translate-x-(--kb-toast-swipe-move-x) data-[swipe=move]:transition-none',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform',
        'data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full'
      )}
      style={{ '--toast-tone': toastTones[tone()] }}
    >
      <span
        aria-hidden="true"
        class="mt-1.5 size-1.5 shrink-0 rounded-full"
        style={{ 'background-color': 'var(--toast-tone)' }}
      />
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <KobalteToast.Title class="text-sm font-medium">{props.title}</KobalteToast.Title>
        <Show when={props.description}>
          <KobalteToast.Description class="text-sm text-muted-foreground">
            {props.description}
          </KobalteToast.Description>
        </Show>
        <Show when={props.action}>
          <div class="mt-1.5 flex items-center gap-2">{props.action}</div>
        </Show>
      </div>
      <KobalteToast.CloseButton
        aria-label="Dismiss notification"
        class="text-muted-foreground shrink-0 rounded-sm p-0.5 transition-colors ease-out outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle"
      >
        <X class="size-3.5" />
      </KobalteToast.CloseButton>
    </KobalteToast>
  )
}

/**
 * The toast API. `show` is the general form; the tone helpers are shorthand for
 * the four cases that come up constantly.
 */
export const toast = {
  show(options: ToastOptions): number {
    return toaster.show((props) => <ToastCard {...props} {...options} />, {
      region: options.region,
    })
  },
  success(title: string, options?: Omit<ToastOptions, 'title' | 'tone'>): number {
    return toast.show({ ...options, title, tone: 'success' })
  },
  error(title: string, options?: Omit<ToastOptions, 'title' | 'tone'>): number {
    return toast.show({ ...options, title, tone: 'destructive', persistent: true })
  },
  warning(title: string, options?: Omit<ToastOptions, 'title' | 'tone'>): number {
    return toast.show({ ...options, title, tone: 'warning' })
  },
  info(title: string, options?: Omit<ToastOptions, 'title' | 'tone'>): number {
    return toast.show({ ...options, title, tone: 'info' })
  },
  /**
   * A toast that resolves with a promise: pending, then success or failure.
   * The right shape for an operation with a visible duration, because the user
   * gets one message instead of three.
   */
  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    messages: {
      pending: string
      success: string | ((data: T) => string)
      error: string | ((error: unknown) => string)
    }
  ): Promise<T> {
    const resolved = typeof promise === 'function' ? promise() : promise
    toaster.promise(resolved, (props) => {
      const tone: ToastTone =
        props.state === 'fulfilled'
          ? 'success'
          : props.state === 'rejected'
            ? 'destructive'
            : 'default'
      const title =
        props.state === 'pending'
          ? messages.pending
          : props.state === 'fulfilled'
            ? typeof messages.success === 'function'
              ? messages.success(props.data as T)
              : messages.success
            : typeof messages.error === 'function'
              ? messages.error(props.error)
              : messages.error
      return (
        <ToastCard
          toastId={props.toastId}
          title={title}
          tone={tone}
          persistent={props.state === 'rejected'}
        />
      )
    })
    return resolved
  },
  dismiss: toaster.dismiss,
  clear: toaster.clear,
}

export type ToasterProps = ComponentProps<typeof KobalteToast.Region> & {
  /** Where the stack sits. Defaults to the bottom-right, clear of the shell. */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  region?: string
}

const toasterPosition = {
  'top-left': 'top-0 left-0 items-start',
  'top-right': 'top-0 right-0 items-end',
  'bottom-left': 'bottom-0 left-0 items-start',
  'bottom-right': 'bottom-0 right-0 items-end',
}

/** Mount once, near the root. Renders the stack and owns its timing defaults. */
export function Toaster(props: ToasterProps) {
  const [local, rest] = splitProps(props, ['position', 'region', 'class'])

  return (
    <KobalteToast.Region
      regionId={local.region}
      duration={5000}
      limit={3}
      swipeDirection="right"
      pauseOnInteraction
      pauseOnPageIdle
      /**
       * The toast region is a top layer: opening a dialog must not hide an
       * in-flight notification, and clicking a toast must not dismiss the
       * dialog behind it.
       */
      class="pointer-events-none fixed z-(--z-toast) flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm"
      {...rest}
    >
      <KobalteToast.List
        class={cn(
          'flex flex-col gap-2',
          toasterPosition[local.position ?? 'bottom-right'],
          local.class
        )}
      />
    </KobalteToast.Region>
  )
}

export { toaster }
