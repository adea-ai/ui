import { Check, CircleHelp, Clock, LoaderCircle } from 'lucide-solid'
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  Show,
  splitProps,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { cn } from '#lib/utils'
import { Button } from '../button'
import { Checkbox } from '../checkbox'
import { RadioGroup, RadioGroupItem } from '../radio-group'
import { Textarea } from '../textarea'

/**
 * Questionnaire.
 *
 * The agent has stopped and is asking the person something before it continues.
 * This is the one place in a transcript where the reader *must* act, so it is
 * the one element allowed to look like a card — and it only ever asks what the
 * runtime actually asked.
 *
 * ## What it models
 *
 * One question or several. Each has a prompt and, optionally, a closed set of
 * options (single choice, or `multiple`) and/or a free-text answer. A question
 * with only a prompt is a text box; the runtime contract that exists today is
 * exactly that. Options are shown only when the producer supplied them, which is
 * why they are data here and not something this component can invent.
 *
 * Several questions are asked one at a time, with "Question 2 of 3" and Back /
 * Next, because a wall of unrelated fields is how a person answers none of them
 * well. Moving between them returns focus to the question, so a screen-reader
 * user hears what they are now answering.
 *
 * ## It does not decide whether you may answer
 *
 * `status` and `disabledReason` come from the host, which owns authority (is
 * this session connected, is the generation current, does this client have the
 * input). A disabled questionnaire says *why* in words next to the button.
 * `answered` and `expired` render the exchange read-only, so a settled question
 * stays in the record as what was asked and what was answered.
 *
 * Submit is `Cmd/Ctrl+Enter` from any text field; plain Enter stays a newline.
 */
export type QuestionnaireOption = Readonly<{
  id: string
  label: string
  description?: string
}>

export type QuestionnaireQuestion = Readonly<{
  id: string
  prompt: string
  description?: string
  options?: readonly QuestionnaireOption[]
  /** Allow more than one option. */
  multiple?: boolean
  /** Offer a free-text answer (always present when there are no options). */
  allowText?: boolean
  textLabel?: string
  textPlaceholder?: string
  /** The question may be skipped. */
  optional?: boolean
}>

export type QuestionnaireAnswer = Readonly<{ optionIds: readonly string[]; text: string }>
export type QuestionnaireAnswers = Readonly<Record<string, QuestionnaireAnswer>>
export type QuestionnaireStatus = 'open' | 'submitting' | 'answered' | 'expired'

const EMPTY: QuestionnaireAnswer = { optionIds: [], text: '' }

/** Whether a question has what it needs. */
export function isQuestionAnswered(
  question: QuestionnaireQuestion,
  answer: QuestionnaireAnswer | undefined
): boolean {
  if (question.optional) return true
  return (answer?.optionIds.length ?? 0) > 0 || (answer?.text.trim().length ?? 0) > 0
}

export type QuestionnaireProps = Omit<ComponentProps<'section'>, 'onSubmit' | 'title'> & {
  questions: readonly QuestionnaireQuestion[]
  title?: string
  description?: string
  status?: QuestionnaireStatus
  answers?: QuestionnaireAnswers
  defaultAnswers?: QuestionnaireAnswers
  onAnswersChange?: (answers: QuestionnaireAnswers) => void
  onSubmit?: (answers: QuestionnaireAnswers) => void | Promise<void>
  /** Why answering is not possible right now; shown beside the button. */
  disabledReason?: string
  /** A failed submit, in words. */
  error?: string
  submitLabel?: string
}

export function Questionnaire(props: QuestionnaireProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'questions',
    'title',
    'description',
    'status',
    'answers',
    'defaultAnswers',
    'onAnswersChange',
    'onSubmit',
    'disabledReason',
    'error',
    'submitLabel',
  ])
  const uid = createUniqueId()
  const [internal, setInternal] = createSignal<QuestionnaireAnswers>(local.defaultAnswers ?? {})
  const [step, setStep] = createSignal(0)
  const answers = () => local.answers ?? internal()
  const status = () => local.status ?? 'open'
  const settled = () => status() === 'answered' || status() === 'expired'
  const locked = () => status() !== 'open' || local.disabledReason !== undefined
  const count = () => local.questions.length
  const current = () => local.questions[Math.min(step(), count() - 1)]
  const last = () => step() >= count() - 1
  const reasonId = `${uid}-reason`
  let questionHeading: HTMLHeadingElement | undefined

  const answerOf = (question: QuestionnaireQuestion) => answers()[question.id] ?? EMPTY
  const change = (question: QuestionnaireQuestion, next: QuestionnaireAnswer) => {
    const value = { ...answers(), [question.id]: next }
    if (local.answers === undefined) setInternal(value)
    local.onAnswersChange?.(value)
  }

  const canAdvance = () => {
    const question = current()
    return question !== undefined && isQuestionAnswered(question, answers()[question.id])
  }
  const canSubmit = () =>
    local.questions.every((question) => isQuestionAnswered(question, answers()[question.id]))

  const submit = async () => {
    if (locked() || !canSubmit()) return
    await local.onSubmit?.(answers())
  }

  // Land on the new question when the step changes, not on the Next button that
  // has just been replaced by one for a different question.
  let firstStep = true
  createEffect(() => {
    void step()
    if (firstStep) {
      firstStep = false
      return
    }
    questionHeading?.focus()
  })

  const onKeyDown: JSX.EventHandler<HTMLElement, KeyboardEvent> = (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && last()) {
      event.preventDefault()
      void submit()
    }
  }

  const summary = createMemo(() =>
    local.questions.map((question) => {
      const answer = answers()[question.id] ?? EMPTY
      const chosen = (question.options ?? [])
        .filter((option) => answer.optionIds.includes(option.id))
        .map((option) => option.label)
      return {
        question,
        parts: [...chosen, ...(answer.text.trim() ? [answer.text.trim()] : [])],
      }
    })
  )

  return (
    <section
      data-slot="questionnaire"
      data-status={status()}
      aria-label={local.title ?? 'Question from the agent'}
      class={cn('flex w-full max-w-xl min-w-0 flex-col gap-3 rounded-xl border bg-card p-4', {
        'border-border': settled(),
        'border-ring': !settled(),
      })}
      onKeyDown={onKeyDown}
      {...rest}
    >
      <header class="flex items-start gap-2.5">
        <span aria-hidden="true" class="mt-0.5 text-muted-foreground [&_svg]:size-4">
          <Show when={status() === 'expired'} fallback={<CircleHelp />}>
            <Clock />
          </Show>
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="m-0 text-sm font-semibold">{local.title ?? 'The agent has a question'}</h3>
          <Show when={local.description}>
            <p class="m-0 mt-0.5 text-xs text-muted-foreground">{local.description}</p>
          </Show>
        </div>
        <Show when={status() === 'answered'}>
          <span class="flex items-center gap-1 text-xs text-muted-foreground">
            <Check aria-hidden="true" class="size-3.5" />
            Answered
          </span>
        </Show>
        <Show when={status() === 'expired'}>
          <span class="text-xs text-muted-foreground">No longer waiting</span>
        </Show>
      </header>

      <Show
        when={!settled()}
        fallback={
          <dl class="m-0 flex flex-col gap-2">
            <For each={summary()}>
              {(entry) => (
                <div class="flex flex-col gap-0.5">
                  <dt class="text-xs text-muted-foreground">{entry.question.prompt}</dt>
                  <dd class="m-0 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">
                    {entry.parts.length > 0 ? entry.parts.join(', ') : 'Skipped'}
                  </dd>
                </div>
              )}
            </For>
          </dl>
        }
      >
        <Show when={current()} keyed>
          {(question) => (
            <fieldset class="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0" disabled={locked()}>
              <legend class="mb-1 p-0">
                <Show when={count() > 1}>
                  <span class="block text-xs text-muted-foreground tabular-nums">
                    Question {step() + 1} of {count()}
                  </span>
                </Show>
                <h4
                  ref={(element) => (questionHeading = element)}
                  tabindex="-1"
                  class="m-0 text-sm font-medium outline-none [overflow-wrap:anywhere]"
                >
                  {question.prompt}
                </h4>
                <Show when={question.description}>
                  <span class="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {question.description}
                  </span>
                </Show>
              </legend>

              <Show when={(question.options?.length ?? 0) > 0}>
                <Show
                  when={question.multiple}
                  fallback={
                    <RadioGroup
                      aria-label={question.prompt}
                      value={answerOf(question).optionIds[0] ?? ''}
                      onChange={(value) =>
                        change(question, { ...answerOf(question), optionIds: value ? [value] : [] })
                      }
                      disabled={locked()}
                    >
                      <For each={question.options}>
                        {(option) => (
                          <RadioGroupItem
                            value={option.id}
                            label={option.label}
                            description={option.description}
                            variant="card"
                          />
                        )}
                      </For>
                    </RadioGroup>
                  }
                >
                  <div role="group" aria-label={question.prompt} class="grid gap-2">
                    <For each={question.options}>
                      {(option) => (
                        <Checkbox
                          label={option.label}
                          description={option.description}
                          checked={answerOf(question).optionIds.includes(option.id)}
                          disabled={locked()}
                          onChange={(checked: boolean) => {
                            const ids = answerOf(question).optionIds
                            change(question, {
                              ...answerOf(question),
                              optionIds: checked
                                ? [...ids.filter((id) => id !== option.id), option.id]
                                : ids.filter((id) => id !== option.id),
                            })
                          }}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </Show>

              <Show when={(question.options?.length ?? 0) === 0 || question.allowText}>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground" for={`${uid}-${question.id}-text`}>
                    {question.textLabel ??
                      ((question.options?.length ?? 0) > 0 ? 'Something else' : 'Your answer')}
                  </label>
                  <Textarea
                    id={`${uid}-${question.id}-text`}
                    rows={2}
                    placeholder={question.textPlaceholder}
                    value={answerOf(question).text}
                    disabled={locked()}
                    aria-describedby={locked() && local.disabledReason ? reasonId : undefined}
                    onInput={(event) =>
                      change(question, { ...answerOf(question), text: event.currentTarget.value })
                    }
                  />
                </div>
              </Show>
            </fieldset>
          )}
        </Show>

        <Show when={local.disabledReason}>
          <p id={reasonId} role="status" class="m-0 text-xs text-muted-foreground">
            {local.disabledReason}
          </p>
        </Show>
        <Show when={local.error}>
          <p role="alert" class="m-0 text-xs text-destructive">
            {local.error}
          </p>
        </Show>

        <footer class="flex items-center justify-between gap-2">
          <Show when={count() > 1} fallback={<span />}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={step() === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              Back
            </Button>
          </Show>
          <Show
            when={last()}
            fallback={
              <Button
                type="button"
                size="sm"
                disabled={locked() || !canAdvance()}
                onClick={() => setStep((value) => Math.min(count() - 1, value + 1))}
              >
                Next
              </Button>
            }
          >
            <Button
              type="button"
              size="sm"
              disabled={locked() || !canSubmit()}
              aria-describedby={local.disabledReason ? reasonId : undefined}
              onClick={() => void submit()}
            >
              <Show when={status() === 'submitting'}>
                <LoaderCircle aria-hidden="true" class="motion-safe:animate-spin" />
              </Show>
              {local.submitLabel ?? 'Send answer'}
            </Button>
          </Show>
        </footer>
      </Show>
    </section>
  )
}
