import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Questionnaire, type QuestionnaireAnswers } from './questionnaire'

const meta = {
  title: 'UI/Questionnaire',
  component: Questionnaire,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The agent has stopped and is asking. One question or several (asked one at a time), with options when the producer supplied them and a text answer always available when it did not. Authority to answer comes from the host as `status` and `disabledReason`; a settled question stays in the record, read-only.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[34rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Questionnaire>

export default meta
type Story = StoryObj<typeof meta>

/** Today's runtime contract: a prompt and nothing else, answered in text. */
export const TextOnly: Story = {
  args: {
    questions: [{ id: 'env', prompt: 'Which environment should receive the reviewed changes?' }],
  },
}

export const SingleChoice: Story = {
  args: {
    questions: [
      {
        id: 'env',
        prompt: 'Which environment should receive the changes?',
        options: [
          { id: 'staging', label: 'Staging', description: 'Safe to roll back' },
          { id: 'prod', label: 'Production', description: 'Customer-facing' },
        ],
        allowText: true,
      },
    ],
  },
}

/** Several questions are asked one at a time; moving on returns focus to the question. */
export const MultipleQuestions: Story = {
  args: { questions: [] },
  render: () => {
    const [answers, setAnswers] = createSignal<QuestionnaireAnswers>({})
    return (
      <Questionnaire
        answers={answers()}
        onAnswersChange={setAnswers}
        questions={[
          {
            id: 'scope',
            prompt: 'Which areas should be touched?',
            multiple: true,
            options: [
              { id: 'ui', label: 'UI library' },
              { id: 'app', label: 'App integration' },
              { id: 'docs', label: 'Docs' },
            ],
          },
          { id: 'note', prompt: 'Anything the agent should avoid?', optional: true },
        ]}
      />
    )
  },
}

/** Not allowed to answer: the reason sits beside the button, in words. */
export const Unavailable: Story = {
  args: {
    questions: [{ id: 'env', prompt: 'Which environment should receive the reviewed changes?' }],
    disabledReason: 'Reconnect to this session to answer.',
  },
}

export const Submitting: Story = {
  args: {
    status: 'submitting',
    questions: [{ id: 'env', prompt: 'Which environment?' }],
    defaultAnswers: { env: { optionIds: [], text: 'Staging' } },
  },
}

export const SubmitFailed: Story = {
  args: {
    error: 'The answer could not be delivered. Nothing was sent.',
    questions: [{ id: 'env', prompt: 'Which environment?' }],
    defaultAnswers: { env: { optionIds: [], text: 'Staging' } },
  },
}

export const Answered: Story = {
  args: {
    status: 'answered',
    questions: [
      { id: 'env', prompt: 'Which environment?', options: [{ id: 'staging', label: 'Staging' }] },
      { id: 'note', prompt: 'Anything to avoid?', optional: true },
    ],
    answers: { env: { optionIds: ['staging'], text: '' } },
  },
}

export const Expired: Story = {
  args: {
    status: 'expired',
    questions: [{ id: 'env', prompt: 'Which environment?' }],
  },
}
