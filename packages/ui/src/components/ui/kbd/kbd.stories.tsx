import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Kbd, KbdGroup, ShortcutKeys } from './kbd'
import { Button } from '../button'

/**
 * Kbd.
 *
 * A keyboard key, in the order the user presses them. The element is a real
 * `<kbd>`, so the semantics survive copy-paste, and the mono face is what makes a
 * shortcut visually distinct from the sentence around it.
 *
 * `KbdGroup` exists because a shortcut is a sequence: typing ⌘ then K needs a gap
 * between them that is a layout concern, not punctuation.
 */
const meta = {
  title: 'Primitives/Data display/Kbd',
  component: Kbd,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Kbd>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Kbd>K</Kbd>,
}

/** Modifier combinations, which is what most shortcuts are. */
export const Combinations: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-4">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <span class="text-sm">Command palette</span>
      </div>
      <div class="flex items-center gap-4">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>P</Kbd>
        </KbdGroup>
        <span class="text-sm">Switch project</span>
      </div>
      <div class="flex items-center gap-4">
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>`</Kbd>
        </KbdGroup>
        <span class="text-sm">Toggle terminal</span>
      </div>
      <div class="flex items-center gap-4">
        <Kbd>Esc</Kbd>
        <span class="text-sm">Close the active overlay</span>
      </div>
    </div>
  ),
}

/** Keys in prose keep their semantic keyboard meaning. */
export const InContext: Story = {
  render: () => (
    <div class="flex max-w-md flex-col gap-3 text-sm">
      <p class="text-muted-foreground">
        Shortcuts are documented where they are used. A key cap in a sentence sits at the baseline
        of the text around it:
      </p>
      <p>
        Open the palette with <Kbd>⌘</Kbd> <Kbd>K</Kbd>, or close the active overlay with{' '}
        <Kbd>Esc</Kbd>.
      </p>
    </div>
  ),
}

/** Decorative hints leave the control's accessible name intact. */
export const CompactControlHints: Story = {
  render: () => (
    <div class="flex flex-col items-start gap-3">
      <Button variant="outline" aria-keyshortcuts="Meta+K">
        Command palette <ShortcutKeys keys="⌘K" />
      </Button>
      <Button variant="outline" aria-keyshortcuts="Shift+Meta+P">
        Switch project <ShortcutKeys keys="⇧⌘P" />
      </Button>
      <KbdGroup size="sm">
        <Kbd size="sm">Ctrl</Kbd>
        <Kbd size="sm">Enter</Kbd>
      </KbdGroup>
    </div>
  ),
}
