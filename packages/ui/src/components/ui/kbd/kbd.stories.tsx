import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button'
import { Kbd, KbdChord, KbdGroup } from './kbd'

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

/**
 * The dense-row rung next to the default, so the two geometries cannot be
 * confused. Compact drops one height step and lightens fill and weight — a
 * solid muted cap at 16px reads heavier than the row text it sits in. `min-w`
 * rather than `width`, so a wide cap like `Esc` stays wide.
 */
export const Compact: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-4">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <span class="text-sm">Default — prose and tooltip size</span>
      </div>
      <div class="flex items-center gap-4">
        <KbdGroup size="compact">
          <Kbd size="compact">⌘</Kbd>
          <Kbd size="compact">K</Kbd>
        </KbdGroup>
        <span class="text-sm">Compact — rail and sidebar rows</span>
      </div>
      <div class="flex items-center gap-4">
        <Kbd size="compact">Esc</Kbd>
        <span class="text-sm">A named key keeps its width at compact</span>
      </div>
    </div>
  ),
}

/**
 * The chord composition, and its decoration contract.
 *
 * One cap per drawn character — `⌘K` is two caps, `⇧⌘P` is three — which is how
 * system menus draw chords. The chord renders `aria-hidden`, so on the button
 * below the accessible name stays "Search projects" and the parseable
 * `aria-keyshortcuts` stays on the control; the caps contribute to neither.
 */
export const Chord: Story = {
  render: () => (
    <div class="flex max-w-md flex-col gap-3 text-sm">
      <p class="text-muted-foreground">
        Every character is a cap. <KbdChord keys="⌘K" /> opens the palette, and{' '}
        <KbdChord keys="⇧⌘P" /> switches project.
      </p>
      <Button variant="outline" size="sm" class="w-fit gap-2" aria-keyshortcuts="Meta+K">
        Search projects
        <KbdChord size="compact" keys="⌘K" />
      </Button>
    </div>
  ),
}

/**
 * Inside a tooltip, where the key cap re-colours itself.
 *
 * A tooltip's surface is the theme-invariant scrim, so a key cap drawn for the
 * canvas reads as a hole there. The component handles this rather than making every
 * caller remember it.
 */
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
