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

/**
 * `wrapperClass` lays out the box a flex or grid parent actually sees — the
 * select plus its chevron. Here one filter grows to fill the toolbar, one is
 * capped, and both selects fill their wrapper, so each chevron stays at its
 * control's edge instead of floating past a select that stopped short.
 * `class` would reach the `<select>` inside, which is the wrong box for this.
 */
export const InToolbar: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div class="flex w-96 items-center gap-2">
      <NativeSelect
        size="sm"
        aria-label="Filter relationships"
        wrapperClass="flex-1"
        defaultValue="all"
        options={[
          { value: 'all', label: 'All relationships' },
          { value: 'explicit', label: 'Explicit' },
        ]}
      />
      <NativeSelect
        size="sm"
        aria-label="Filter origin"
        wrapperClass="max-w-32"
        defaultValue="inferred"
        options={[
          { value: 'all', label: 'All origins' },
          { value: 'inferred', label: 'Inferred, from the text of a document' },
        ]}
      />
    </div>
  ),
}
