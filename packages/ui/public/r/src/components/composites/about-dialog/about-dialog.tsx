import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  Show,
  type Accessor,
} from 'solid-js'
import { ExternalLink } from 'lucide-solid'
import { ActionButton } from '../action-button'
import { Alert, AlertDescription } from '../../ui/alert'
import { Dialog, DialogContent, DialogTitle } from '../../ui/dialog'
import { createDialogFocusRestoration } from '../../ui/dialog/dialog'

export type AboutDialogProps = {
  appName: string
  appIcon: string
  version?: string
  platform: string
  copyright: string
  sourceUrl: string
  open: boolean
  onOpenChange: (open: boolean) => void
  copyVersionInfo?: (text: string) => Promise<void>
  openExternal?: (url: string) => Promise<void>
  restoreFocusRef?: Accessor<HTMLElement | undefined>
}

/** Compact app identity and support details, with clipboard and native-browser adapters. */
export function AboutDialog(props: AboutDialogProps) {
  const versionLabel = () => (props.version ? `Version ${props.version}` : 'Version unavailable')
  const versionInfo = createMemo(() =>
    [props.appName, versionLabel(), `Platform: ${props.platform}`].join('\n')
  )
  const [copied, setCopied] = createSignal(false)
  const [error, setError] = createSignal('')
  const [copying, setCopying] = createSignal(false)
  let disposed = false
  let epoch = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => {
    disposed = true
    epoch += 1
    clearTimeout(timer)
  })
  createEffect(
    on(
      () => props.open,
      () => {
        epoch += 1
        clearTimeout(timer)
        setCopied(false)
        setError('')
        setCopying(false)
      }
    )
  )
  const focus = createDialogFocusRestoration({
    open: () => props.open,
    restoreFocusRef: props.restoreFocusRef,
  })
  const copy = async () => {
    const owner = epoch
    const active = () => !disposed && props.open && owner === epoch
    setError('')
    setCopied(false)
    setCopying(true)
    try {
      if (props.copyVersionInfo) await props.copyVersionInfo(versionInfo())
      else await navigator.clipboard.writeText(versionInfo())
      if (!active()) return
      setCopied(true)
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (active()) setCopied(false)
      }, 2000)
    } catch {
      if (active()) setError('Could not copy version info. Please try again.')
    } finally {
      if (active()) setCopying(false)
    }
  }
  const openSource = async () => {
    const owner = epoch
    setError('')
    try {
      await props.openExternal?.(props.sourceUrl)
    } catch {
      if (!disposed && props.open && owner === epoch)
        setError('Could not open the source repository. Please try again.')
    }
  }
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        class="w-full max-w-96"
        onKeyDown={(event: KeyboardEvent) => {
          // Tooltip help on the identity actions cannot trap Escape in this popup.
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault()
            props.onOpenChange(false)
          }
        }}
        aria-label={`About ${props.appName}`}
        aria-labelledby=""
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          focus.onOpenAutoFocus(event)
          // Let the identity be read before focus opens explanatory action help.
          if (!event.defaultPrevented && event.currentTarget instanceof HTMLElement) {
            event.preventDefault()
            event.currentTarget.focus({ preventScroll: true })
          }
        }}
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        <div class="flex flex-col items-center gap-2 text-center">
          <img src={props.appIcon} alt="" class="size-14" aria-hidden="true" />
          <DialogTitle>{props.appName}</DialogTitle>
          {/* Body text on the dialog's themed surface: primary ink measures
              below AA against the lighter dialog backgrounds across schemes,
              so the version and the source link carry foreground ink and keep
              primary as the link's underline accent (the text-link treatment). */}
          <p class="text-sm text-foreground">{versionLabel()}</p>
          <p class="text-xs text-muted-foreground">{props.copyright}</p>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <ActionButton
              type="button"
              variant="outline"
              size="sm"
              busy={copying()}
              tooltip="Copy the app version and runtime details for a support report."
              onClick={() => void copy()}
            >
              {copied() ? 'Copied' : 'Copy version info'}
            </ActionButton>
            <ActionButton
              as="a"
              variant="link"
              size="sm"
              class="text-foreground decoration-primary"
              href={props.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              tooltip={`Open the ${props.appName} source repository in your browser.`}
              onClick={(event) => {
                if (props.openExternal) {
                  event.preventDefault()
                  void openSource()
                }
              }}
            >
              <ExternalLink aria-hidden="true" />
              View source
            </ActionButton>
          </div>
          <Show when={error()}>
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error()}</AlertDescription>
            </Alert>
          </Show>
        </div>
      </DialogContent>
    </Dialog>
  )
}
