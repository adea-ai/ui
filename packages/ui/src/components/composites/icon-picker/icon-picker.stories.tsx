import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { IconPicker } from './icon-picker'
import type { ShellIconKey } from './shell-icons'

/**
 * IconPicker.
 *
 * Chooses the icon a workspace or project wears, from a curated set, and, when
 * the host passes `onImageChange`, offers uploading a picture instead. The two
 * are one setting: an uploaded image wins over the icon key until it is removed,
 * and removing it returns to the key the user had chosen, so nothing is lost by
 * trying a picture.
 *
 * It is a radio group, not a grid of buttons: one tab stop for the whole set and
 * arrow keys inside it, so a 50-icon palette does not cost 50 tab presses.
 */
const meta = {
  title: 'Composites/Icon picker',
  component: IconPicker,
  parameters: { layout: 'padded' },
  args: { label: 'Icon', value: 'folder', onValueChange: () => {} },
  tags: ['autodocs'],
} satisfies Meta<typeof IconPicker>

export default meta
type Story = StoryObj<typeof meta>

/** A project's icon: icons only, no upload, defaulting to the folder. */
export const Icons: Story = {
  render: () => {
    const [value, setValue] = createSignal<ShellIconKey>('folder')
    return (
      <div class="max-w-md">
        <IconPicker label="Project icon" value={value()} onValueChange={setValue} />
      </div>
    )
  },
}

/**
 * A workspace's mark: the same set plus an image upload. The upload row keeps its
 * error in a live region so a rejected file is announced where the user is looking.
 */
export const WithImage: Story = {
  render: () => {
    const [value, setValue] = createSignal<ShellIconKey>('box')
    const [image, setImage] = createSignal<string>()
    return (
      <div class="max-w-md">
        <IconPicker
          label="Workspace icon"
          value={value()}
          onValueChange={setValue}
          defaultKey="box"
          image={image()}
          onImageChange={setImage}
        />
      </div>
    )
  },
}

/** Locked while the host cannot save, e.g. a workspace the user may not edit. */
export const Disabled: Story = {
  render: () => (
    <div class="max-w-md">
      <IconPicker label="Workspace icon" value="rocket" onValueChange={() => {}} disabled />
    </div>
  ),
}
