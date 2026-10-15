import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Questionnaire,
  type QuestionnaireAnswers,
  type QuestionnaireQuestion,
  type QuestionnaireStatus,
} from '../../src/components/ui/questionnaire'
import '../../src/styles/globals.css'

/**
 * One multi-question flow driven by keyboard, a locked one, a settled one and a
 * single-question one. `window.fixture` records submissions and lets the spec
 * settle a submit, standing in for the host that owns authority.
 */
type Fixture = {
  submissions: QuestionnaireAnswers[]
  changes: number
  slowCalls: number
  settle: (status: QuestionnaireStatus) => void
}
const fixture: Fixture = { submissions: [], changes: 0, slowCalls: 0, settle: () => undefined }
;(window as Window & { fixture?: Fixture }).fixture = fixture

const flow: readonly QuestionnaireQuestion[] = [
  {
    id: 'scope',
    prompt: 'Which scope should the change cover?',
    description: 'Pick one.',
    options: [
      { id: 'app', label: 'The app', description: 'Only the application code' },
      { id: 'lib', label: 'The library' },
      { id: 'both', label: 'Both' },
    ],
  },
  {
    id: 'checks',
    prompt: 'Which checks should run?',
    multiple: true,
    options: [
      { id: 'unit', label: 'Unit tests' },
      { id: 'types', label: 'Type check' },
      { id: 'lint', label: 'Lint' },
    ],
  },
  { id: 'notes', prompt: 'Anything else we should know?', textPlaceholder: 'Optional detail' },
]

function Flow() {
  const [status, setStatus] = createSignal<QuestionnaireStatus>('open')
  fixture.settle = setStatus
  return (
    <Questionnaire
      id="flow"
      title="Before I continue"
      description="Three quick questions."
      questions={flow}
      status={status()}
      onAnswersChange={() => (fixture.changes += 1)}
      onSubmit={(answers) => {
        fixture.submissions.push(answers)
        setStatus('submitting')
      }}
    />
  )
}

render(
  () => (
    <main class="flex w-xl max-w-full flex-col gap-6 p-4">
      <button id="before" type="button">
        Before
      </button>
      <Flow />
      <Questionnaire
        id="locked"
        title="Locked question"
        questions={flow.slice(0, 2)}
        defaultAnswers={{ scope: { optionIds: ['app'], text: '' } }}
        disabledReason="Reconnect to the session to answer."
      />
      <Questionnaire
        id="locked-single"
        title="Locked single question"
        questions={[{ id: 'why', prompt: 'Why this approach?' }]}
        defaultAnswers={{ why: { optionIds: [], text: 'A draft answer' } }}
        disabledReason="Another window already answered."
      />
      <Questionnaire
        id="answered"
        title="Settled question"
        status="answered"
        questions={flow}
        answers={{
          scope: { optionIds: ['lib'], text: '' },
          checks: { optionIds: ['unit', 'lint'], text: '' },
          notes: { optionIds: [], text: 'Keep it small.\nSecond line.' },
        }}
      />
      <Questionnaire
        id="expired"
        title="Expired question"
        status="expired"
        questions={flow.slice(0, 1)}
      />
      <Questionnaire
        id="single"
        title="One question"
        questions={[{ id: 'why', prompt: 'Why this approach?', allowText: true }]}
        onSubmit={(answers) => {
          fixture.submissions.push(answers)
        }}
      />
      <Questionnaire
        id="slow"
        title="Slow host"
        questions={[{ id: 'why', prompt: 'Why now?' }]}
        defaultAnswers={{ why: { optionIds: [], text: 'Because' } }}
        onSubmit={async () => {
          fixture.slowCalls += 1
          await new Promise((resolve) => setTimeout(resolve, 400))
        }}
      />
      <button id="after" type="button">
        After
      </button>
    </main>
  ),
  document.body
)
