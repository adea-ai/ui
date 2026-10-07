import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal, For } from 'solid-js'
import { NativeSelect } from './native-select'

const meta = {
  title: 'Primitives/Forms/Native Select',
  component: NativeSelect,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof NativeSelect>

export default meta
type Story = StoryObj<typeof meta>

/** For a short, known list, keep the browser's select and option behavior. */
export const Default: Story = {
  render: () => {
    const [kind, setKind] = createSignal('derived')
    return (
      <div class="flex w-72 flex-col gap-2">
        <label for="native-select-kind" class="text-sm font-medium">
          Relationship kind
        </label>
        <NativeSelect
          id="native-select-kind"
          aria-describedby="native-select-hint"
          value={kind()}
          onChange={(event) => setKind(event.currentTarget.value)}
        >
          <option value="all">All relationships</option>
          <optgroup label="Graph source">
            <option value="explicit">Explicit</option>
            <option value="derived">Derived</option>
          </optgroup>
        </NativeSelect>
        <p id="native-select-hint" class="text-muted-foreground text-sm">
          Current value: {kind()}
        </p>
      </div>
    )
  },
}

/** Disabled state and native option availability remain browser-owned. */
export const Disabled: Story = {
  render: () => (
    <div class="flex w-72 flex-col gap-2">
      <label for="native-select-disabled" class="text-sm font-medium">
        Relationship kind
      </label>
      <NativeSelect id="native-select-disabled" disabled defaultValue="all">
        <option value="all">All relationships</option>
        <option value="explicit">Explicit</option>
      </NativeSelect>
    </div>
  ),
}

/**
 * `size` is the control rung, matching `Input` and `SelectTrigger`: `sm` beside
 * `icon-sm` toolbar actions, `md` (the default) in a form, `lg` for a touch form.
 */
export const Sizes: Story = {
  render: () => (
    <div class="flex flex-col items-start gap-2">
      <For each={['sm', 'md', 'lg'] as const}>
        {(size) => (
          <NativeSelect size={size} aria-label={`Relationship kind, ${size}`} defaultValue="all">
            <option value="all">All relationships</option>
            <option value="explicit">Explicit</option>
            <option value="derived">Derived</option>
          </NativeSelect>
        )}
      </For>
    </div>
  ),
}
