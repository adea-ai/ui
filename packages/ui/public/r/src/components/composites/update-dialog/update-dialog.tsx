import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
  splitProps,
} from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import {
  Check,
  CircleStop,
  Download,
  ExternalLink,
  LoaderCircle,
  Monitor,
  RefreshCw,
  Sparkles,
} from 'lucide-solid'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { ActionButton } from '../action-button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog'
import { createDialogFocusRestoration } from '../../ui/dialog/dialog'
import { Progress } from '../../ui/progress'
import { Heading } from '../../ui/typography'
import { cn } from '../../../lib/utils'
import { formatBytes, formatReleaseDate, plainTextFromMarkdown } from '../../../lib/version-notes'

/**
 * UpdateDialog.
 *
 * A software-update surface: the installed version, whether a newer release
 * exists, a download that shows its progress, and the release notes for what is
 * about to arrive.
 *
 * The transport is an adapter, because an update is the one thing a component
 * library genuinely cannot implement: it is signed, downloaded and applied by the
 * application's own updater, and the mechanism differs per shell. What *is*
 * general is the phase machine and the way each phase is presented — and that is
 * where the hard-won detail lives:
 *
 * **A refused install answers with a normal payload, not a rejection.** adea's
 * shell returns a status whose phase is `failed` when a download or an extract
 * fails, rather than throwing. Without handling that, clicking install looked like
 * nothing happened at all — the button spun, the phase never changed, and the
 * error sat unread in a field nobody rendered. The `failed` phase after an install
 * is therefore surfaced as an error, explicitly.
 *
 * **Busy is derived from the snapshot as well as from the click.** An update can
 * be downloading while the dialog is open — started before it opened, or by the
 * shell's own poll — so a local `busy` flag alone would offer an enabled Install
 * button mid-download.
 *
 * **Opening the dialog loads status first, then checks.** Status paints the
 * installed version immediately; the check is a network round trip. Doing them in
 * the other order leaves the dialog blank for as long as the check takes, on a
 * dialog whose first question is always "what am I running?".
 *
 * **A failed check is not a current result.** A cached `current` status can only
 * be shown as up to date after the latest check succeeds; a failed check remains
 * retryable and suppresses that claim.
 *
 * **Errors are not always `Error`s.** An adapter can reject with a string or a
 * structured safe message. Unknown object fields are never serialized into the
 * UI; a generic fallback is shown instead.
 *
 * The adapter's `isDesktopRuntime` gate exists because an update is a desktop
 * concern: a browser build has no installer, and the honest thing to show is that
 * updates are available in the desktop application rather than a disabled button
 * with no reason.
 */

/** The phase an update is in. The union is the state machine. */
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'installed'
  | 'cancelling'
  | 'cancelled'
  | 'unavailable'
  | 'failed'

/** A snapshot of the updater. Every field the dialog renders, and nothing else. */
export type UpdateState = Readonly<{
  phase: UpdatePhase
  /** The version currently installed. */
  currentVersion: string
  /** The version that can be installed, when one can. */
  availableVersion?: string | null
  /** A changelog for the installed channel, as markdown. */
  changelog?: string
  /** Notes for the available release, as markdown. */
  releaseNotes?: string | null
  /** The available release's date, as an ISO string. */
  releaseDate?: string | null
  /** Bytes downloaded so far, during `downloading`. */
  downloadedBytes?: number
  /** Total bytes, when the server sent a length. */
  totalBytes?: number | null
  /** Set when `phase` is `failed`, and sometimes when it is not. */
  error?: string | null
  /** A URL for the release's page. */
  releaseUrl?: string | null
  /** True when the application must restart to finish. */
  restartRequired?: boolean
}>

/**
 * The updater, as the application exposes it. Three calls, each answering with a
 * full snapshot rather than a delta — an updater's state is small, and a snapshot
 * cannot drift from the shell's own view of it.
 */
export type UpdateAdapter = Readonly<{
  /** The current state, without contacting the release channel. */
  getStatus(): Promise<UpdateState>
  /** Ask the release channel, and answer with what it found. */
  check(): Promise<UpdateState>
  /**
   * Download and apply `expectedVersion`.
   *
   * The argument is the version the caller believes is available, so the updater
   * can refuse a request that raced a newer release rather than installing the
   * wrong one.
   */
  install(expectedVersion: string): Promise<UpdateState>
  /** Optional native cancellation, available only while work is in flight. */
  cancel?(): Promise<UpdateState>
  /** Enable status polling during native work; omit for push-driven adapters. */
  pollIntervalMs?: number
  /** Route external links through the native shell when needed. */
  openExternal?(url: string): Promise<void>
  /** False in a browser build, where there is no installer to drive. */
  isDesktopRuntime(): boolean
}>

export type ChannelControlActions = Readonly<{
  /** Disabled while the app is checking, downloading, installing, or saving a channel. */
  disabled: Accessor<boolean>
  /** Persist a channel change, then check that channel without retaining a stale offer. */
  recheck(beforeCheck?: () => Promise<void>): Promise<void>
}>

export type UpdateDialogProps = {
  adapter: UpdateAdapter
  /** The application's name, used in the title and the copy. */
  appName?: string
  /** The actual desktop application icon, supplied by its host. */
  appIcon?: string
  /** Complete build-time history, also available before the native status arrives. */
  changelog?: string
  /** Shown before the first status arrives, so the dialog is never blank. */
  fallbackVersion?: string
  /** Copy for the adapter's non-desktop case. */
  desktopOnlyMessage?: string
  /**
   * Optional host-owned release-channel control, rendered in the version status
   * card. The host owns its accessible label and calls `recheck` after a selection;
   * the optional callback persists that selection before the dialog checks it.
   */
  channelControl?: (actions: ChannelControlActions) => JSX.Element
  /** A controlled open state. Omit for the trigger to manage its own. */
  open?: boolean
  /**
   * Start open, uncontrolled — for a caller that opens the dialog because it found
   * something ("an update is available") rather than because the user asked. The
   * trigger is still rendered, so the dialog is reachable again after closing.
   */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Supplies a stable external control to focus when a controlled dialog closes.
   * Useful when a menu or other layer closes before this dialog opens; when omitted,
   * the element focused immediately before the dialog opens is used when available.
   */
  restoreFocusRef?: Accessor<HTMLElement | undefined>
  /** Render only the panel, for a caller that provides its own dialog. */
  class?: string
}

function messageText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const message = value.trim()
  return message && message !== '[object Object]' ? message : undefined
}

function errorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof Error) return messageText(caught.message) ?? fallback
  const plainMessage = messageText(caught)
  if (plainMessage) return plainMessage
  if (!caught || typeof caught !== 'object') return fallback

  const record = caught as { error?: unknown; safe?: unknown }
  const safe = record.safe as { message?: unknown } | null | undefined
  const nestedError = record.error as { safe?: { message?: unknown } | null } | null | undefined
  return messageText(safe?.message) ?? messageText(nestedError?.safe?.message) ?? fallback
}

/**
 * The phases during which the updater is working. `downloading` and `installing`
 * are included because the shell can be in either while the dialog is open, and
 * offering an enabled Install button during a download is how a double-install
 * happens.
 */
function isBusy(state: UpdateState | null): boolean {
  return (
    state?.phase === 'checking' ||
    state?.phase === 'downloading' ||
    state?.phase === 'installing' ||
    state?.phase === 'cancelling'
  )
}

export function UpdateDialog(props: UpdateDialogProps) {
  const [local] = splitProps(props, [
    'adapter',
    'appName',
    'appIcon',
    'changelog',
    'fallbackVersion',
    'desktopOnlyMessage',
    'channelControl',
    'open',
    'defaultOpen',
    'onOpenChange',
    'restoreFocusRef',
    'class',
  ])

  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(local.defaultOpen ?? false)
  const open = () => local.open ?? uncontrolledOpen()
  const setOpen = (next: boolean) => {
    if (local.open === undefined) setUncontrolledOpen(next)
    local.onOpenChange?.(next)
  }

  const focusRestoration = createDialogFocusRestoration({
    open,
    restoreFocusRef: local.restoreFocusRef,
  })

  const appName = () => local.appName ?? 'the application'
  const desktop = () => local.adapter.isDesktopRuntime()
  const [state, setState] = createSignal<UpdateState | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  const [checkFailed, setCheckFailed] = createSignal(false)
  const [cancelPending, setCancelPending] = createSignal(false)
  let lifecycleEpoch = 0
  let activeOpenEpoch: number | undefined
  let channelCheckUnconfirmed = false
  let disposed = false

  onCleanup(() => {
    disposed = true
    activeOpenEpoch = undefined
    lifecycleEpoch += 1
  })

  const loadStatus = async (isCurrent: () => boolean = () => !disposed) => {
    if (!desktop() || !isCurrent()) return
    try {
      const status = await local.adapter.getStatus()
      const previous = state()
      const hasActionableSnapshot = (candidate: UpdateState | null) =>
        candidate?.phase === 'available' || isBusy(candidate)
      const ignoresUnconfirmedChannelSnapshot =
        channelCheckUnconfirmed && hasActionableSnapshot(status)
      const preservesSnapshot =
        previous?.phase === 'available'
          ? status.phase === 'available' || isBusy(status)
          : isBusy(previous) && isBusy(status)
      if (
        isCurrent() &&
        !ignoresUnconfirmedChannelSnapshot &&
        !(checkFailed() && hasActionableSnapshot(previous) && !preservesSnapshot)
      ) {
        setState(status)
      }
    } catch (caught) {
      if (isCurrent()) setError(errorMessage(caught, 'Version status is unavailable'))
    }
  }

  onMount(() => {
    if (desktop() && !open()) {
      const epoch = lifecycleEpoch
      void loadStatus(() => !disposed && lifecycleEpoch === epoch)
    }
  })

  const failCheck = (caught: unknown, fallback: string) => {
    const message = errorMessage(caught, fallback)
    setCheckFailed(true)
    setError(message)
  }

  const applyCheckResult = (next: UpdateState, preserveOnFailure = true) => {
    if (next.phase === 'failed') {
      const current = state()
      if (!current || !preserveOnFailure) setState(next)
      failCheck(next.error, 'Could not check for updates')
      return
    }
    setState(next)
    setCheckFailed(false)
    setError('')
  }

  const check = async (
    beforeCheck?: () => Promise<void>,
    clearStaleOffer = beforeCheck !== undefined
  ) => {
    if (!desktop()) {
      setError(local.desktopOnlyMessage ?? `Update checks are available from the desktop app.`)
      return
    }
    const epoch = activeOpenEpoch
    const isCurrent = () =>
      !disposed &&
      epoch !== undefined &&
      activeOpenEpoch === epoch &&
      lifecycleEpoch === epoch &&
      open()
    if (!isCurrent()) return
    if (clearStaleOffer && working()) return
    if (clearStaleOffer) channelCheckUnconfirmed = true
    const discardStaleOffer = clearStaleOffer || channelCheckUnconfirmed
    setBusy(true)
    setError('')
    setCheckFailed(false)
    if (discardStaleOffer) {
      const current = state()
      if (current) setState({ phase: 'checking', currentVersion: current.currentVersion })
    }
    let channelSaved = beforeCheck === undefined
    try {
      await beforeCheck?.()
      channelSaved = true
      if (!isCurrent()) return
      const checked = await local.adapter.check()
      if (isCurrent()) {
        applyCheckResult(checked, !discardStaleOffer)
        if (discardStaleOffer && checked.phase !== 'failed') channelCheckUnconfirmed = false
      }
    } catch (caught) {
      if (isCurrent()) {
        if (discardStaleOffer) {
          const fallback = channelSaved
            ? 'Could not check for updates'
            : 'Could not save the update channel'
          const message = errorMessage(caught, fallback)
          setState({
            phase: 'failed',
            currentVersion: state()?.currentVersion ?? '',
            error: message,
          })
          failCheck(message, fallback)
        } else {
          failCheck(caught, 'Could not check for updates')
          await loadStatus(isCurrent)
        }
      }
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }

  /**
   * Status first, then the check — and an `active` flag, because the dialog can
   * close while the check is in flight and a late `setState` would write into a
   * disposed scope.
   */
  createEffect(() => {
    if (!open() || !desktop()) {
      setCancelPending(false)
      if (activeOpenEpoch !== undefined) {
        activeOpenEpoch = undefined
        lifecycleEpoch += 1
      }
      return
    }
    const epoch = ++lifecycleEpoch
    activeOpenEpoch = epoch
    let active = true
    const isCurrent = () =>
      active && !disposed && activeOpenEpoch === epoch && lifecycleEpoch === epoch && open()
    onCleanup(() => {
      active = false
      if (activeOpenEpoch === epoch) {
        activeOpenEpoch = undefined
        lifecycleEpoch += 1
      }
    })
    setError('')
    setCheckFailed(false)
    setCancelPending(false)
    setBusy(true)
    void (async () => {
      try {
        const current = await local.adapter.getStatus()
        if (!isCurrent()) return
        const discardStaleOffer = channelCheckUnconfirmed
        setState(
          discardStaleOffer
            ? { phase: 'checking', currentVersion: current.currentVersion }
            : current
        )
        const checked = await local.adapter.check()
        if (isCurrent()) {
          applyCheckResult(checked, !discardStaleOffer)
          if (discardStaleOffer && checked.phase !== 'failed') channelCheckUnconfirmed = false
        }
      } catch (caught) {
        if (isCurrent()) {
          if (channelCheckUnconfirmed) {
            const message = errorMessage(caught, 'Could not check for updates')
            setState({
              phase: 'failed',
              currentVersion: state()?.currentVersion ?? '',
              error: message,
            })
            failCheck(message, 'Could not check for updates')
          } else {
            failCheck(caught, 'Could not check for updates')
          }
        }
      } finally {
        if (isCurrent()) setBusy(false)
      }
    })()
  })

  const install = async () => {
    const version = state()?.availableVersion
    const epoch = activeOpenEpoch
    const isCurrent = () =>
      !disposed &&
      epoch !== undefined &&
      activeOpenEpoch === epoch &&
      lifecycleEpoch === epoch &&
      open()
    if (!version || !isCurrent()) return
    setBusy(true)
    setError('')
    setState((current) =>
      current ? { ...current, phase: 'downloading', downloadedBytes: 0, totalBytes: null } : current
    )
    try {
      const next = await local.adapter.install(version)
      if (!isCurrent()) return
      setState(
        cancelPending() && ['downloading', 'installing'].includes(next.phase)
          ? { ...next, phase: 'cancelling' }
          : next
      )
      // A refused install answers with a normal payload whose phase is `failed`.
      // Without this the click looked like nothing happened.
      if (next.phase === 'failed') {
        setError(errorMessage(next.error, 'Update installation failed'))
      } else {
        setCheckFailed(false)
      }
    } catch (caught) {
      if (!isCurrent()) return
      setError(errorMessage(caught, 'Update installation failed'))
      await loadStatus(isCurrent)
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }

  // Poll only an open, active native operation. Epoch ownership prevents a late
  // status response from replacing a reopened dialog's newer snapshot.
  createEffect(() => {
    const phase = state()?.phase
    if (
      !open() ||
      !desktop() ||
      !local.adapter.pollIntervalMs ||
      !['downloading', 'installing', 'cancelling'].includes(phase ?? '')
    )
      return
    const epoch = activeOpenEpoch
    let active = true
    let requestInFlight = false
    const timer = window.setInterval(
      () => {
        if (requestInFlight) return
        requestInFlight = true
        void (async () => {
          try {
            const next = await local.adapter.getStatus()
            if (!active || disposed || !open() || activeOpenEpoch !== epoch) return
            setState(
              cancelPending() && ['downloading', 'installing'].includes(next.phase)
                ? { ...next, phase: 'cancelling' }
                : next
            )
            if (next.phase === 'failed')
              setError(errorMessage(next.error, 'Update installation failed'))
          } catch (caught) {
            if (active && !disposed && activeOpenEpoch === epoch)
              setError(errorMessage(caught, 'Update progress is unavailable'))
          } finally {
            requestInFlight = false
          }
        })()
      },
      Math.max(250, local.adapter.pollIntervalMs)
    )
    onCleanup(() => {
      active = false
      window.clearInterval(timer)
    })
  })

  const cancel = async () => {
    if (!local.adapter.cancel || cancelPending() || state()?.phase === 'cancelling') return
    const epoch = activeOpenEpoch
    setError('')
    setCancelPending(true)
    setState((current) => (current ? { ...current, phase: 'cancelling' } : current))
    try {
      const next = await local.adapter.cancel()
      if (!disposed && open() && activeOpenEpoch === epoch) setState(next)
    } catch (caught) {
      if (!disposed && open() && activeOpenEpoch === epoch) {
        setError(errorMessage(caught, 'Could not cancel the update'))
        await loadStatus(() => !disposed && open() && activeOpenEpoch === epoch)
      }
    } finally {
      if (!disposed && open() && activeOpenEpoch === epoch) setCancelPending(false)
    }
  }

  const openRelease = async (url: string) => {
    try {
      if (local.adapter.openExternal) await local.adapter.openExternal(url)
      else window.open(url, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      if (!disposed) setError(errorMessage(caught, 'Could not open the release page'))
    }
  }

  const changelog = createMemo(() =>
    plainTextFromMarkdown(state()?.changelog || local.changelog || '')
  )
  const notes = () => {
    const value = state()?.releaseNotes
    return value ? plainTextFromMarkdown(value) : ''
  }
  const working = () => busy() || cancelPending() || isBusy(state())
  const channelControlDisabled = () => !desktop() || working()
  const recheckChannel = (beforeCheck?: () => Promise<void>) => check(beforeCheck, true)
  const isCurrent = () => state()?.phase === 'current' && !error() && !checkFailed() && !working()

  const triggerLabel = () => {
    const current = state()
    const fallback = `v${local.fallbackVersion ?? '0.1.0'}`
    if (checkFailed()) return `Version ${current?.currentVersion || fallback} · Retry`
    if (!current) return `${appName()} ${fallback}`
    switch (current.phase) {
      case 'checking':
        return 'Checking for updates…'
      case 'available':
        return current.availableVersion
          ? `Update v${current.availableVersion} available`
          : 'Update available'
      case 'downloading':
      case 'installing':
        return 'Installing update…'
      case 'failed':
        return `Version ${current.currentVersion || fallback} · Retry`
      default:
        return `${appName()} v${current.currentVersion || fallback}`
    }
  }

  const progressValue = () => {
    const current = state()
    if (!current?.totalBytes || !current.downloadedBytes) return null
    return Math.min(100, Math.round((current.downloadedBytes / current.totalBytes) * 100))
  }

  return (
    <Dialog open={open()} onOpenChange={setOpen}>
      <Show when={local.open === undefined}>
        <DialogTrigger
          as={Button}
          variant="ghost"
          size="sm"
          aria-label="Open version and updates"
          aria-haspopup="dialog"
        >
          <Show when={state()?.phase === 'available'} fallback={<RefreshCw aria-hidden="true" />}>
            <Sparkles aria-hidden="true" />
          </Show>
          {triggerLabel()}
        </DialogTrigger>
      </Show>

      <DialogContent
        positioner="inset"
        class={cn('flex max-h-full min-h-0 max-w-3xl flex-col overflow-hidden', local.class)}
        onKeyDown={(event: KeyboardEvent) => {
          // An explanatory tooltip must not consume the popup's close shortcut,
          // including while its exit animation still owns Kobalte's top layer.
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault()
            setOpen(false)
          }
        }}
        onOpenAutoFocus={(event) => {
          focusRestoration.onOpenAutoFocus(event)
          // Start at the readable panel rather than opening an action's tooltip.
          if (!event.defaultPrevented && event.currentTarget instanceof HTMLElement) {
            event.preventDefault()
            event.currentTarget.focus({ preventScroll: true })
          }
        }}
        onCloseAutoFocus={focusRestoration.onCloseAutoFocus}
      >
        <DialogHeader class="shrink-0">
          <div class="flex items-center gap-3">
            <Show
              when={local.appIcon}
              fallback={<Monitor class="size-10 text-primary" aria-hidden="true" />}
            >
              {(icon) => <img src={icon()} alt="" class="size-10" aria-hidden="true" />}
            </Show>
            <div>
              <DialogTitle>Version &amp; updates</DialogTitle>
              <DialogDescription>
                Keep {appName()} current and review what changed in each release.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          data-slot="update-dialog-scroll-region"
          class="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6"
        >
          <section
            class="rounded-xl border border-border bg-background/45 p-4"
            aria-label="Version status"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="flex flex-col gap-1">
                <p class="text-2xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Installed version
                </p>
                <Heading as="p" size="page" tone="foreground">
                  v{state()?.currentVersion || local.fallbackVersion || '0.1.0'}
                </Heading>
                <p class="text-sm text-muted-foreground">
                  <Show
                    when={isCurrent()}
                    fallback={
                      <Show
                        when={state()?.phase === 'available' && state()?.availableVersion}
                        fallback={
                          state()?.phase === 'unavailable'
                            ? 'No signed package is published for this platform.'
                            : state()?.phase === 'cancelled'
                              ? 'Update cancelled. You can retry when ready.'
                              : desktop()
                                ? 'Check the release channel for the latest signed build.'
                                : (local.desktopOnlyMessage ??
                                  `Open this dialog inside the desktop app to check for updates.`)
                        }
                      >
                        {`A newer release, v${state()?.availableVersion}, is ready.`}
                      </Show>
                    }
                  >
                    You are running the latest release.
                  </Show>
                </p>
              </div>
              <div class="flex flex-col items-end gap-2">
                <ActionButton
                  type="button"
                  variant="outline"
                  size="sm"
                  tooltip="Check the release channel for the latest signed app version."
                  disabled={!desktop() || working()}
                  onClick={() => void check()}
                >
                  <Show when={working()} fallback={<RefreshCw aria-hidden="true" />}>
                    <LoaderCircle class="animate-spin" aria-hidden="true" />
                  </Show>
                  {checkFailed() ? 'Retry update check' : 'Check latest version'}
                </ActionButton>
                {/* The up-to-date confirmation reads as the button's outcome,
                    so it sits directly beneath it rather than floating as a
                    full-width row between sections. */}
                <Show when={isCurrent()}>
                  <p class="text-foreground flex items-center gap-2 text-sm" role="status">
                    <Check class="size-4 text-success" aria-hidden="true" />
                    {appName()} is up to date.
                  </p>
                </Show>
              </div>
            </div>
            <Show when={local.channelControl}>
              {(channelControl) => (
                <div class="mt-4 border-t border-border pt-4">
                  {channelControl()({
                    disabled: channelControlDisabled,
                    recheck: recheckChannel,
                  })}
                </div>
              )}
            </Show>
          </section>

          <Show
            when={
              state()?.availableVersion &&
              state()?.phase !== 'installed' &&
              state()?.phase !== 'unavailable'
            }
          >
            <section
              class="rounded-xl border border-primary/35 bg-primary-subtle p-4"
              aria-label="Available update"
            >
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="flex flex-col gap-1">
                  <p class="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles class="size-4 text-primary" aria-hidden="true" />
                    Version {state()?.availableVersion}{' '}
                    {['downloading', 'installing', 'cancelling'].includes(state()?.phase ?? '')
                      ? 'is being prepared'
                      : 'is ready'}
                  </p>
                  <p class="text-sm text-muted-foreground">
                    The signed installer is verified before {appName()} restarts.
                  </p>
                  <Show when={formatReleaseDate(state()?.releaseDate ?? null)}>
                    {(released) => (
                      <p class="text-xs text-muted-foreground">Released {released()}</p>
                    )}
                  </Show>
                </div>
                <ActionButton
                  type="button"
                  size="sm"
                  tooltip={`Download the signed update and restart ${appName()}.`}
                  disabled={working()}
                  onClick={() => void install()}
                >
                  <Show when={working()} fallback={<Download aria-hidden="true" />}>
                    <LoaderCircle class="animate-spin" aria-hidden="true" />
                  </Show>
                  Install and restart
                </ActionButton>
              </div>
            </section>
          </Show>

          {/*
            Progress with both numbers: a bar alone does not distinguish a stalled
            download from a slow one, and "12.4 MB of 48.1 MB" does.
          */}
          <Show
            when={
              state()?.phase === 'downloading' ||
              state()?.phase === 'installing' ||
              state()?.phase === 'cancelling'
            }
          >
            <section class="grid gap-2" aria-label="Update progress">
              <Progress
                value={progressValue() ?? undefined}
                aria-label={
                  state()?.phase === 'installing' ? 'Installing update' : 'Downloading update'
                }
              />
              <p class="text-xs text-muted-foreground" role="status">
                <Show
                  when={state()?.phase === 'installing'}
                  fallback={
                    <Show when={progressValue() !== null} fallback="Downloading…">
                      {`${formatBytes(state()?.downloadedBytes ?? 0)} of ${formatBytes(
                        state()?.totalBytes ?? 0
                      )} · ${progressValue()}%`}
                    </Show>
                  }
                >
                  Applying the update…
                </Show>
              </p>
              <Show when={local.adapter.cancel}>
                <ActionButton
                  type="button"
                  variant="outline"
                  size="sm"
                  tooltip="Stop the current update download or installation."
                  disabled={cancelPending() || state()?.phase === 'cancelling'}
                  onClick={() => void cancel()}
                >
                  <CircleStop aria-hidden="true" />
                  {cancelPending() || state()?.phase === 'cancelling'
                    ? 'Cancelling…'
                    : 'Cancel update'}
                </ActionButton>
              </Show>
            </section>
          </Show>

          <Show when={state()?.phase === 'installed'}>
            <p class="text-foreground flex items-center gap-2 text-sm" role="status">
              <Check class="size-4 text-success" aria-hidden="true" />
              <Show when={state()?.restartRequired} fallback="The update is applied.">
                Restart {appName()} to finish the update.
              </Show>
            </p>
          </Show>

          <Show when={error()}>
            <p
              class="text-foreground rounded-lg border border-destructive/35 bg-destructive-subtle px-3 py-2 text-sm"
              role="alert"
            >
              {error()}
            </p>
          </Show>

          <Show when={notes()}>
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <h2 id="update-release-notes" class="text-sm font-semibold text-foreground">
                  What changed in this release
                </h2>
                <Badge variant="subtle" size="sm">
                  v{state()?.availableVersion}
                </Badge>
              </div>
              {/* A long text block with no focusable descendant: it needs its own tab
                  stop, named by the heading above it, or a keyboard user cannot
                  scroll it (`scrollable-region-focusable`). */}
              <div
                class="max-h-52 overflow-y-auto rounded-xl border border-border bg-background/45 p-4 font-code text-code leading-5 whitespace-pre-wrap text-muted-foreground"
                role="region"
                aria-labelledby="update-release-notes"
                tabindex="0"
              >
                {notes()}
              </div>
            </div>
          </Show>

          <Show when={changelog()}>
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <h2 id="update-changelog" class="text-sm font-semibold text-foreground">
                  Installed changelog
                </h2>
                {/* The version pill identifies which build's history this is —
                    the same treatment the available-update heading carries. */}
                <Badge variant="subtle" size="sm">
                  v{state()?.currentVersion || local.fallbackVersion || '0.1.0'}
                </Badge>
              </div>
              <p class="text-xs text-muted-foreground">
                All versions and updates included with this installation.
              </p>
              {/* A long text block with no focusable descendant: it needs its own tab
                  stop, named by the heading above it, or a keyboard user cannot
                  scroll it (`scrollable-region-focusable`). */}
              <div
                class="max-h-72 overflow-y-auto rounded-xl border border-border bg-background/45 p-4 font-code text-code leading-5 whitespace-pre-wrap text-muted-foreground"
                role="region"
                aria-labelledby="update-changelog"
                tabindex="0"
              >
                {changelog()}
              </div>
            </div>
          </Show>
        </div>

        <DialogFooter>
          <Show when={state()?.releaseUrl}>
            {(url) => (
              <ActionButton
                type="button"
                variant="ghost"
                size="sm"
                tooltip="Open the release history in your browser."
                // `noopener,noreferrer` because the release page is a different
                // origin and must not get a handle on this window.
                onClick={() => void openRelease(url())}
              >
                <ExternalLink aria-hidden="true" />
                View releases
              </ActionButton>
            )}
          </Show>
          <DialogClose as={Button} variant="outline" size="sm">
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
