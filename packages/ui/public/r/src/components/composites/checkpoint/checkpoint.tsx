import { Flag } from 'lucide-solid'
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  on,
  Show,
  splitProps,
  type ComponentProps,
} from 'solid-js'
import { cn } from '../../../lib/utils'
import { Button } from '../../ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../ui/alert-dialog'
import { Marker } from '../../ui/marker'
import { Spinner } from '../../ui/spinner'
import { settleDecision } from '../confirmation/confirmation-model'
import { boundText } from '../sources/source'
import {
  checkpointLabel,
  checkpointStatus,
  restoreControl,
  restoreDialogCopy,
  type CheckpointState,
} from './checkpoint-model'

/**
 * Checkpoint.
 *
 * A point in the conversation the host can name: a divider in the transcript with
 * a label and a time. It always renders — as a `Marker`, the quietest thing in the
 * column — and it is honest about what it is:
 *
 * - **Without `onRestore` it is only a marker.** Not a disabled button, not a
 *   greyed-out "Restore": nothing. Whether a checkpoint can be returned to is a
 *   fact about the host's storage and permissions, and a control that implies it
 *   can would be a claim nobody made.
 * - **With `onRestore` it offers Restore, and Restore asks first.** An
 *   `AlertDialog` (Escape and the scrim do nothing; every exit is a named choice)
 *   states what will change in the host's own words (`consequence`) before the
 *   handler is called. A restore throws work away; the confirmation is the point.
 *
 * ## States
 *
 * `idle` → `restoring` → `restored`, or `failed` with `error`. Pass `state` to
 * drive it from the host; omit it and the component follows the promise
 * `onRestore` returns. The status sentence is a live region that exists from the
 * start, so a change is announced. While restoring, the control stays focusable
 * (`aria-disabled`, not `disabled`) so focus is not dropped when the dialog hands
 * it back; once restored the control goes and focus moves to the status line.
 *
 * A restore that cannot happen now takes `disabledReason`, shown in words under
 * the divider; the host decides, the component explains.
 */
export type CheckpointProps = Omit<ComponentProps<'div'>, 'children' | 'onError'> & {
  /** The checkpoint's name. Defaults to "Checkpoint". */
  label?: string
  /** When it was taken, already formatted for the reader. */
  time?: string
  state?: CheckpointState
  /** Supplying this is what makes the checkpoint restorable. */
  onRestore?: () => void | Promise<void>
  /** What restoring will change, in the host's words. Shown in the confirmation. */
  consequence?: string
  restoreLabel?: string
  /** Why Restore cannot be used right now. */
  disabledReason?: string
  /** Why a restore failed. */
  error?: string
}

export function Checkpoint(props: CheckpointProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'label',
    'time',
    'state',
    'onRestore',
    'consequence',
    'restoreLabel',
    'disabledReason',
    'error',
  ])
  const uid = createUniqueId()
  const reasonId = `${uid}-status`
  const [followed, setFollowed] = createSignal<CheckpointState>('idle')
  const [failure, setFailure] = createSignal<string | undefined>(undefined)
  const [confirming, setConfirming] = createSignal(false)
  let inflight = false
  let root: HTMLDivElement | undefined
  let status: HTMLParagraphElement | undefined

  const state = (): CheckpointState => local.state ?? followed()
  const error = () => local.error ?? failure()
  const control = () => restoreControl(local.onRestore !== undefined, state(), local.disabledReason)
  const copy = () => restoreDialogCopy(local.label, local.consequence)
  const statusText = () => checkpointStatus(state(), error(), local.disabledReason)

  const restore = async () => {
    if (inflight || control().disabled) return
    inflight = true
    setFailure(undefined)
    setFollowed('restoring')
    const result = await settleDecision(local.onRestore)
    inflight = false
    if (result.ok) {
      setFollowed('restored')
    } else {
      setFailure(result.message)
      setFollowed('failed')
    }
  }

  // The control is replaced by the status line on success; do not strand focus.
  createEffect(
    on(
      () => state() === 'restored',
      (restored) => {
        if (!restored) return
        const active = document.activeElement
        if (active === null || active === document.body || root?.contains(active)) {
          status?.focus()
        }
      },
      { defer: true }
    )
  )

  // Built once. `Marker` reads `action` twice (to test it, then to draw it), and a
  // JSX prop re-creates its component on every read: a second AlertDialog root
  // would portal a second, invisible-to-the-tree dialog when this one opens.
  const restoreAction = createMemo(() => (
    <Show when={control().visible}>
      <AlertDialog
        open={confirming()}
        onOpenChange={(open) => setConfirming(open && !control().disabled)}
      >
        <AlertDialogTrigger
          as={Button}
          variant="ghost"
          size="2xs"
          aria-disabled={control().disabled || undefined}
          aria-describedby={statusText() ? reasonId : undefined}
        >
          <Show when={state() === 'restoring'}>
            <Spinner size="xs" label={false} />
          </Show>
          {state() === 'restoring'
            ? 'Restoring…'
            : (local.restoreLabel ?? (state() === 'failed' ? 'Try again' : 'Restore'))}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy().title}</AlertDialogTitle>
            <AlertDialogDescription class="[overflow-wrap:anywhere]">
              {copy().description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel as={Button} variant="ghost">
              Do not restore
            </AlertDialogCancel>
            <AlertDialogAction as={Button} onClick={() => void restore()}>
              {local.restoreLabel ?? 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Show>
  ))

  return (
    <div
      ref={(element) => (root = element)}
      data-slot="checkpoint"
      data-state={state()}
      class={local.class}
      {...rest}
    >
      <Marker
        variant="rule"
        icon={<Flag />}
        tone={state() === 'failed' ? 'danger' : 'neutral'}
        label={checkpointLabel(local.label)}
        description={local.time ? boundText(local.time, 60) : undefined}
        action={restoreAction()}
      />
      {/* Always present, so a state change is a change to a live region rather than
          the arrival of one. Empty while idle, which takes no space. */}
      <p
        id={reasonId}
        ref={(element) => (status = element)}
        role="status"
        tabindex="-1"
        class={cn('m-0 text-center text-xs outline-none [overflow-wrap:anywhere]', {
          'text-destructive': state() === 'failed',
          'text-muted-foreground': state() !== 'failed',
        })}
      >
        {statusText()}
      </p>
    </div>
  )
}
