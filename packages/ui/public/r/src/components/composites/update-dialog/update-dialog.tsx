import { createEffect, createMemo, createSignal, onMount, Show, splitProps } from 'solid-js'
import { Check, Download, ExternalLink, LoaderCircle, RefreshCw, Sparkles } from 'lucide-solid'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
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
import { Progress } from '../../ui/progress'
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
 * **Errors are not always `Error`s.** An adapter can reject with a string, and a
 * shell can answer with an error field. Both are read, and a fallback is shown
 * rather than an empty alert.
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
  /** False in a browser build, where there is no installer to drive. */
  isDesktopRuntime(): boolean
}>

export type UpdateDialogProps = {
  adapter: UpdateAdapter
  /** The application's name, used in the title and the copy. */
  appName?: string
  /** Shown before the first status arrives, so the dialog is never blank. */
  fallbackVersion?: string
  /** Copy for the adapter's non-desktop case. */
  desktopOnlyMessage?: string
  /** A controlled open state. Omit for the trigger to manage its own. */
  open?: boolean
  /**
   * Start open, uncontrolled — for a caller that opens the dialog because it found
   * something ("an update is available") rather than because the user asked. The
   * trigger is still rendered, so the dialog is reachable again after closing.
   */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Render only the panel, for a caller that provides its own dialog. */
  class?: string
}

function errorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof Error && caught.message) return caught.message
  if (typeof caught === 'string' && caught) return caught
  return fallback
}

/**
 * The phases during which the updater is working. `downloading` and `installing`
 * are included because the shell can be in either while the dialog is open, and
 * offering an enabled Install button during a download is how a double-install
 * happens.
 */
function isBusy(state: UpdateState | null): boolean {
  return (
    state?.phase === 'checking' || state?.phase === 'downloading' || state?.phase === 'installing'
  )
}

export function UpdateDialog(props: UpdateDialogProps) {
  const [local] = splitProps(props, [
    'adapter',
    'appName',
    'fallbackVersion',
    'desktopOnlyMessage',
    'open',
    'defaultOpen',
    'onOpenChange',
    'class',
  ])

  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(local.defaultOpen ?? false)
  const open = () => local.open ?? uncontrolledOpen()
  const setOpen = (next: boolean) => {
    if (local.open === undefined) setUncontrolledOpen(next)
    local.onOpenChange?.(next)
  }

  const appName = () => local.appName ?? 'the application'
  const desktop = () => local.adapter.isDesktopRuntime()
  const [state, setState] = createSignal<UpdateState | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')

  const loadStatus = async () => {
    if (!desktop()) return
    try {
      setState(await local.adapter.getStatus())
    } catch (caught) {
      setError(errorMessage(caught, 'Version status is unavailable'))
    }
  }

  onMount(() => {
    if (desktop()) void loadStatus()
  })

  const check = async () => {
    if (!desktop()) {
      setError(local.desktopOnlyMessage ?? `Update checks are available from the desktop app.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      setState(await local.adapter.check())
    } catch (caught) {
      setError(errorMessage(caught, 'Could not check for updates'))
      await loadStatus()
    } finally {
      setBusy(false)
    }
  }

  /**
   * Status first, then the check — and an `active` flag, because the dialog can
   * close while the check is in flight and a late `setState` would write into a
   * disposed scope.
   */
  createEffect(() => {
    if (!open() || !desktop()) return
    let active = true
    setError('')
    setBusy(true)
    void (async () => {
      try {
        const current = await local.adapter.getStatus()
        if (!active) return
        setState(current)
        const checked = await local.adapter.check()
        if (active) setState(checked)
      } catch (caught) {
        if (active) setError(errorMessage(caught, 'Could not check for updates'))
      } finally {
        if (active) setBusy(false)
      }
    })()
    return () => {
      active = false
    }
  })

  const install = async () => {
    const version = state()?.availableVersion
    if (!version) return
    setBusy(true)
    setError('')
    try {
      const next = await local.adapter.install(version)
      setState(next)
      // A refused install answers with a normal payload whose phase is `failed`.
      // Without this the click looked like nothing happened.
      if (next.phase === 'failed') {
        setError(errorMessage(next.error, 'Update installation failed'))
      }
    } catch (caught) {
      setError(errorMessage(caught, 'Update installation failed'))
      await loadStatus()
    } finally {
      setBusy(false)
    }
  }

  const changelog = createMemo(() => plainTextFromMarkdown(state()?.changelog ?? ''))
  const notes = () => {
    const value = state()?.releaseNotes
    return value ? plainTextFromMarkdown(value) : ''
  }
  const working = () => busy() || isBusy(state())

  const triggerLabel = () => {
    const current = state()
    const fallback = `v${local.fallbackVersion ?? '0.1.0'}`
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

      <DialogContent class={cn('max-w-3xl', local.class)}>
        <DialogHeader>
          <div class="flex items-center gap-3">
            <span class="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles class="size-5" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle>Version &amp; updates</DialogTitle>
              <DialogDescription>
                Keep {appName()} current and review what changed in each release.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="flex min-h-0 flex-col gap-5 overflow-y-auto p-6">
          <section
            class="rounded-xl border border-border bg-background/45 p-4"
            aria-label="Version status"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="flex flex-col gap-1">
                <p class="text-2xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Installed version
                </p>
                <p class="text-xl font-semibold tracking-tight">
                  v{state()?.currentVersion || local.fallbackVersion || '0.1.0'}
                </p>
                <p class="text-sm text-muted-foreground">
                  <Show
                    when={state()?.phase === 'current'}
                    fallback={
                      <Show
                        when={state()?.phase === 'available' && state()?.availableVersion}
                        fallback={
                          desktop()
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!desktop() || working()}
                onClick={() => void check()}
              >
                <Show when={working()} fallback={<RefreshCw aria-hidden="true" />}>
                  <LoaderCircle class="animate-spin" aria-hidden="true" />
                </Show>
                Check latest version
              </Button>
            </div>
          </section>

          <Show when={state()?.phase === 'available' && state()?.availableVersion}>
            <section
              class="rounded-xl border border-primary/35 bg-primary-subtle p-4"
              aria-label="Available update"
            >
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="flex flex-col gap-1">
                  <p class="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles class="size-4 text-primary" aria-hidden="true" />
                    Version {state()?.availableVersion} is ready
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
                <Button type="button" size="sm" disabled={working()} onClick={() => void install()}>
                  <Show when={working()} fallback={<Download aria-hidden="true" />}>
                    <LoaderCircle class="animate-spin" aria-hidden="true" />
                  </Show>
                  Install and restart
                </Button>
              </div>
            </section>
          </Show>

          {/*
            Progress with both numbers: a bar alone does not distinguish a stalled
            download from a slow one, and "12.4 MB of 48.1 MB" does.
          */}
          <Show when={state()?.phase === 'downloading' || state()?.phase === 'installing'}>
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
            </section>
          </Show>

          <Show when={state()?.phase === 'current'}>
            <p class="flex items-center gap-2 text-sm text-success" role="status">
              <Check class="size-4" aria-hidden="true" />
              {appName()} is up to date.
            </p>
          </Show>

          <Show when={state()?.phase === 'installed'}>
            <p class="flex items-center gap-2 text-sm text-success" role="status">
              <Check class="size-4" aria-hidden="true" />
              <Show when={state()?.restartRequired} fallback="The update is applied.">
                Restart {appName()} to finish the update.
              </Show>
            </p>
          </Show>

          <Show when={error()}>
            <p
              class="rounded-lg border border-destructive/35 bg-destructive-subtle px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error()}
            </p>
          </Show>

          <Show when={notes()}>
            <section class="flex flex-col gap-2" aria-labelledby="update-release-notes">
              <div class="flex items-center gap-2">
                <h2 id="update-release-notes" class="text-sm font-semibold">
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
                class="max-h-52 overflow-y-auto rounded-xl border border-border bg-background/45 p-4 font-mono text-xs leading-5 whitespace-pre-wrap text-muted-foreground"
                role="region"
                aria-labelledby="update-release-notes"
                tabindex="0"
              >
                {notes()}
              </div>
            </section>
          </Show>

          <Show when={changelog()}>
            <section class="flex flex-col gap-2" aria-labelledby="update-changelog">
              <h2 id="update-changelog" class="text-sm font-semibold">
                Installed changelog
              </h2>
              <p class="text-xs text-muted-foreground">
                A plain-text history of the installed release channel.
              </p>
              {/* A long text block with no focusable descendant: it needs its own tab
                  stop, named by the heading above it, or a keyboard user cannot
                  scroll it (`scrollable-region-focusable`). */}
              <div
                class="max-h-72 overflow-y-auto rounded-xl border border-border bg-background/45 p-4 font-mono text-xs leading-5 whitespace-pre-wrap text-muted-foreground"
                role="region"
                aria-labelledby="update-changelog"
                tabindex="0"
              >
                {changelog()}
              </div>
            </section>
          </Show>
        </div>

        <DialogFooter>
          <Show when={state()?.releaseUrl}>
            {(url) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                // `noopener,noreferrer` because the release page is a different
                // origin and must not get a handle on this window.
                onClick={() => window.open(url(), '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink aria-hidden="true" />
                View releases
              </Button>
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
