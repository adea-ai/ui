import { Ban, Check, Clock, Lock, ShieldQuestion } from 'lucide-solid'
import {
  createEffect,
  createSignal,
  createUniqueId,
  Show,
  splitProps,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { cn } from '#lib/utils'
import { Button } from '../../ui/button'
import { CodeBlock } from '../../ui/code-block'
import { DiffBlock } from '../../ui/diff-block'
import { Spinner } from '../../ui/spinner'
import { boundText } from '../sources/source'
import {
  confirmationOutcome,
  decisionReason,
  isAwaitingAnswer,
  settleDecision,
  type ConfirmationState,
} from './confirmation-model'

/**
 * Confirmation.
 *
 * The agent has stopped a tool and will not continue until the person approves or
 * denies it. Like `Questionnaire`, this is one of the two elements in a transcript
 * the reader *must* act on, so it is allowed a card surface — and the border is
 * the focus ring's colour only while it is waiting. Once answered it drops to a
 * hairline and a one-line record, because a settled decision should read as
 * history, not as something still asking.
 *
 * ## It shows what is being approved, and nothing else
 *
 * `title` and `description` say what the tool wants to do; `details` is the
 * evidence, rendered as `CodeBlock size="sm"` (a command, a request) or
 * `DiffBlock` (a patch). Details are text: never interpreted, and a long one
 * scrolls inside its block. Approve and Deny exist only while the request is
 * open; afterwards they are replaced by the outcome, with *who* and *when* only if
 * the host supplied them.
 *
 * ## The host owns authority
 *
 * Whether this client may answer is not decided here. No handler, or a host
 * `disabledReason`, or the `unavailable` state, leaves the buttons visible and
 * disabled with the reason beside them in words — never hidden, because a reader
 * who cannot see the choice cannot tell whether the agent is waiting on them.
 *
 * ## Answering is a round trip
 *
 * `onApprove` / `onDeny` may return a promise. While one is pending both buttons
 * refuse input (a synchronous guard as well as the signal, so a double click in
 * one tick cannot submit twice) and the pressed one shows a spinner. A failure
 * shows `error` (or the rejection's own message) and re-enables the buttons. The
 * buttons use `aria-disabled` rather than `disabled`: a native disabled button
 * drops focus, and the reader's place would be lost mid-decision. When the state
 * settles, focus moves to the outcome line if it was in the card, so a keyboard
 * user is not stranded on a control that no longer exists.
 */
export type ConfirmationDetails =
  | Readonly<{ kind: 'code'; code: string; language?: string; title?: string }>
  | Readonly<{ kind: 'diff'; patch: string; title?: string }>

export type ConfirmationProps = Omit<ComponentProps<'section'>, 'title' | 'onError'> & {
  state?: ConfirmationState
  /** What the tool wants to do, as a short sentence. */
  title: string
  description?: string
  details?: ConfirmationDetails
  onApprove?: () => void | Promise<void>
  onDeny?: () => void | Promise<void>
  approveLabel?: string
  denyLabel?: string
  /** Why the choice cannot be made right now; shown in words beside the buttons. */
  disabledReason?: string
  /** A failed answer, in words. Overrides the rejection's own message. */
  error?: string
  /** Who answered, once settled. Omit if unknown; nothing is assumed. */
  resolvedBy?: string
  /** When it was answered, already formatted for the reader. Omit if unknown. */
  resolvedAt?: string
  /** Extra content between the details and the buttons. */
  children?: JSX.Element
}

type Choice = 'approve' | 'deny'

export function Confirmation(props: ConfirmationProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'state',
    'title',
    'description',
    'details',
    'onApprove',
    'onDeny',
    'approveLabel',
    'denyLabel',
    'disabledReason',
    'error',
    'resolvedBy',
    'resolvedAt',
    'children',
  ])
  const uid = createUniqueId()
  const titleId = `${uid}-title`
  const reasonId = `${uid}-reason`
  const state = (): ConfirmationState => local.state ?? 'requested'
  const awaiting = () => isAwaitingAnswer(state())
  const [pending, setPending] = createSignal<Choice | undefined>(undefined)
  const [failure, setFailure] = createSignal<string | undefined>(undefined)
  let inflight = false
  let root: HTMLElement | undefined
  let outcome: HTMLParagraphElement | undefined

  const reasonFor = (handler: (() => void | Promise<void>) | undefined, missing: string) => {
    if (pending() !== undefined) return 'Your answer is being sent.'
    return decisionReason({
      state: state(),
      disabledReason: local.disabledReason,
      hasHandler: handler !== undefined,
      unavailableFallback: 'This request cannot be answered right now.',
      missingFallback: missing,
    })
  }
  const approveReason = () => reasonFor(local.onApprove, 'Approving is not available here.')
  const denyReason = () => reasonFor(local.onDeny, 'Denying is not available here.')
  // One sentence per distinct reason, so two identical reasons are not read twice.
  const reasons = () => [...new Set([approveReason(), denyReason()].filter(Boolean))].join(' ')
  const error = () => (local.error ? boundText(local.error, 240) : failure())

  const choose = async (choice: Choice) => {
    const handler = choice === 'approve' ? local.onApprove : local.onDeny
    const blocked = choice === 'approve' ? approveReason() : denyReason()
    if (inflight || blocked || !awaiting()) return
    inflight = true
    setPending(choice)
    setFailure(undefined)
    const result = await settleDecision(handler)
    inflight = false
    setPending(undefined)
    if (!result.ok) setFailure(result.message)
  }

  // The buttons are replaced by the outcome line; keep a keyboard reader in the card.
  // The previous value is kept by hand: `on(..., { defer: true })` does not record the
  // input of its skipped first run, so its "previous" is undefined on the first change.
  let wasAwaiting = awaiting()
  createEffect(() => {
    const now = awaiting()
    if (wasAwaiting && !now) {
      const active = document.activeElement
      if (active === null || active === document.body || root?.contains(active)) {
        outcome?.focus()
      }
    }
    wasAwaiting = now
  })

  const buttonProps = (choice: Choice) => {
    const blocked = () => (choice === 'approve' ? approveReason() : denyReason())
    const disabled = () => pending() !== undefined || blocked() !== undefined
    return {
      'aria-disabled': disabled() || undefined,
      'aria-describedby': blocked() ? reasonId : undefined,
      onClick: () => void choose(choice),
    }
  }

  return (
    <section
      ref={(element) => (root = element)}
      data-slot="confirmation"
      data-state={state()}
      aria-labelledby={titleId}
      class={cn('flex w-full max-w-xl min-w-0 flex-col gap-3 rounded-xl border bg-card p-4', {
        'border-ring': awaiting(),
        'border-border': !awaiting(),
      })}
      {...rest}
    >
      <header class="flex items-start gap-2.5">
        <span aria-hidden="true" class="mt-0.5 text-muted-foreground [&_svg]:size-4">
          <Show when={state() === 'approved'}>
            <Check class="text-success" />
          </Show>
          <Show when={state() === 'denied'}>
            <Ban />
          </Show>
          <Show when={state() === 'expired'}>
            <Clock />
          </Show>
          <Show when={state() === 'unavailable'}>
            <Lock />
          </Show>
          <Show when={state() === 'requested'}>
            <ShieldQuestion />
          </Show>
        </span>
        <div class="min-w-0 flex-1">
          <h3 id={titleId} class="m-0 text-sm font-semibold [overflow-wrap:anywhere]">
            {boundText(local.title, 200)}
          </h3>
          <Show when={local.description}>
            <p class="m-0 mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {boundText(local.description ?? '', 400)}
            </p>
          </Show>
        </div>
        <Show when={awaiting()}>
          <span class="shrink-0 text-xs text-muted-foreground">
            {state() === 'requested' ? 'Needs your answer' : 'Cannot be answered now'}
          </span>
        </Show>
      </header>

      <Show when={local.details}>{(details) => <Details details={details()} />}</Show>

      {local.children}

      <Show
        when={awaiting()}
        fallback={
          <p
            ref={(element) => (outcome = element)}
            tabindex="-1"
            role="status"
            class="m-0 flex items-center gap-1.5 text-xs text-muted-foreground outline-none"
          >
            {confirmationOutcome(state(), local.resolvedBy, local.resolvedAt)}
          </p>
        }
      >
        <Show when={reasons()}>
          <p id={reasonId} role="status" class="m-0 text-xs text-muted-foreground">
            {reasons()}
          </p>
        </Show>
        <Show when={error()}>
          <p role="alert" class="m-0 text-xs text-destructive [overflow-wrap:anywhere]">
            {error()}
          </p>
        </Show>
        <footer class="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" {...buttonProps('deny')}>
            <Show when={pending() === 'deny'}>
              <Spinner size="sm" label={false} />
            </Show>
            {local.denyLabel ?? 'Deny'}
          </Button>
          <Button type="button" size="sm" {...buttonProps('approve')}>
            <Show when={pending() === 'approve'}>
              <Spinner size="sm" label={false} />
            </Show>
            {local.approveLabel ?? 'Approve'}
          </Button>
          {/* Present from the start: a live region inserted with its text is not reliably announced. */}
          <span role="status" class="visually-hidden">
            {pending() !== undefined ? 'Sending your answer' : ''}
          </span>
        </footer>
      </Show>
    </section>
  )
}

/** A name from the host or the model, cleaned and clipped before it reaches a header. */
function bounded(value: string | undefined, limit: number): string | undefined {
  return value ? boundText(value, limit) || undefined : undefined
}

function Details(props: { details: ConfirmationDetails }) {
  return (
    <Show
      when={props.details.kind === 'diff' && props.details}
      fallback={
        <CodeBlock
          size="sm"
          code={(props.details as Extract<ConfirmationDetails, { kind: 'code' }>).code}
          language={bounded(
            (props.details as Extract<ConfirmationDetails, { kind: 'code' }>).language,
            24
          )}
          title={bounded(props.details.title, 80)}
          complete
          wrap
          maxHeight="14rem"
        />
      }
    >
      {(diff) => (
        // The diff block has no height cap of its own, so the cap lives here; a
        // scroller must be focusable, hence the labelled region and tab stop.
        <div
          role="region"
          aria-label="Proposed changes"
          tabindex="0"
          class="max-h-64 overflow-auto rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-primary-subtle"
        >
          <DiffBlock
            patch={(diff() as Extract<ConfirmationDetails, { kind: 'diff' }>).patch}
            title={bounded(diff().title, 80)}
            complete
          />
        </div>
      )}
    </Show>
  )
}
