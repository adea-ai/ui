import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { ModelSelector } from './model-selector'
import type { ModelOption } from './models'

const meta = {
  title: 'Composites/Model Selector',
  component: ModelSelector,
  tags: ['autodocs'],
  args: { models: [] },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "Which model, and how hard it thinks, in one group. Models are grouped by provider; past seven they get a search box. An unavailable model stays listed, disabled, with the host's reason. Without onChange the model is plain read-only text. The effort control exists only when the selected model advertises efforts.",
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="flex min-h-80 w-[30rem] max-w-full items-end">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ModelSelector>

export default meta
type Story = StoryObj<typeof meta>

const efforts = [
  { id: 'low', label: 'Low', description: 'Fastest, least reasoning' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High', description: 'Slowest, most reasoning' },
]

const models: ModelOption[] = [
  {
    id: 'sonnet',
    label: 'Sonnet',
    provider: 'Anthropic',
    description: 'Balanced for everyday work',
    efforts,
  },
  { id: 'haiku', label: 'Haiku', provider: 'Anthropic', description: 'Fast and light' },
  {
    id: 'opus',
    label: 'Opus',
    provider: 'Anthropic',
    description: 'Most capable',
    disabledReason: 'Not included in your plan.',
    efforts,
  },
  { id: 'gpt', label: 'GPT', provider: 'OpenAI', efforts: ['low', 'high'] },
]

function Controlled(props: {
  models: ModelOption[]
  value?: string
  effort?: string
  disabledReason?: string
}) {
  const [value, setValue] = createSignal(props.value)
  const [effort, setEffort] = createSignal(props.effort)
  return (
    <ModelSelector
      models={props.models}
      value={value()}
      effort={effort()}
      onChange={setValue}
      onEffortChange={setEffort}
      disabledReason={props.disabledReason}
    />
  )
}

/** Both controls, grouped by provider. Opus is listed, disabled, with its reason. */
export const Default: Story = {
  render: () => <Controlled models={models} value="sonnet" effort="medium" />,
}

/** Haiku advertises no efforts, so there is no effort control to mislead anyone. */
export const NoEffortsForModel: Story = {
  render: () => <Controlled models={models} value="haiku" />,
}

/** The stored effort is not one this model offers: shown as unset, not as a level it never had. */
export const StaleEffort: Story = {
  render: () => <Controlled models={models} value="gpt" effort="medium" />,
}

/** No handlers: read-only text stating what is running, not buttons that do nothing. */
export const ReadOnly: Story = {
  args: { models, value: 'sonnet', effort: 'high' },
}

/** Effort changes but the model is fixed (the session is already running one). */
export const EffortOnly: Story = {
  render: () => {
    const [effort, setEffort] = createSignal<string | undefined>('medium')
    return (
      <ModelSelector models={models} value="sonnet" effort={effort()} onEffortChange={setEffort} />
    )
  },
}

const many: ModelOption[] = Array.from({ length: 24 }, (_, index) => ({
  id: `model-${index}`,
  label: `Model ${index + 1}`,
  provider: ['Anthropic', 'OpenAI', 'Google', 'Mistral'][index % 4]!,
  description: index % 3 === 0 ? 'A description that helps find it by typing' : undefined,
  disabledReason: index % 7 === 6 ? 'Not available in your region.' : undefined,
  efforts: index % 2 === 0 ? ['low', 'medium', 'high'] : undefined,
}))

/** Past seven models the picker is a popover with a search box (try typing a provider). */
export const Searchable: Story = {
  render: () => <Controlled models={many} value="model-2" effort="low" />,
}

/** A value the list does not contain is shown as given, never replaced by another model. */
export const UnknownValue: Story = {
  render: () => <Controlled models={models} value="retired-model-v1" />,
}

export const NothingChosen: Story = {
  render: () => <Controlled models={models} />,
}

/** The host blocks changes (a run is in flight): both stay reachable and the reason is in words. */
export const BlockedByHost: Story = {
  render: () => (
    <Controlled
      models={models}
      value="sonnet"
      effort="high"
      disabledReason="The model cannot change while a reply is being written."
    />
  ),
}

export const NoModels: Story = {
  render: () => <Controlled models={[]} />,
}

/** Hostile and oversized strings are bounded and rendered as text. */
export const HostileLabels: Story = {
  render: () => (
    <Controlled
      value="x"
      effort="low"
      models={[
        {
          id: 'x',
          label: `<img src=x onerror=alert(1)> ${'Long model name '.repeat(20)}`,
          provider: '<script>alert(1)</script>',
          description: 'd'.repeat(2000),
          efforts: [{ id: 'low', label: 'L'.repeat(300) }],
        },
        {
          id: 'y',
          label: 'Other',
          provider: '<script>alert(1)</script>',
          disabledReason: 'r'.repeat(1000),
        },
      ]}
    />
  ),
}
