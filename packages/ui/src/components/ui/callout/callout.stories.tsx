import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Callout, CalloutTitle } from './callout'
import { TextLink } from '../text-link/text-link'

/**
 * Callout.
 *
 * A quiet aside that belongs to the content around it: the summary at the top of an
 * answer, a note in documentation, a remembered fact. A card-coloured block with a
 * rule on its start edge, and nothing that interrupts the reader.
 *
 * It is not an `Alert`. An alert is a live announcement about the surface it sits
 * in; a callout is static page content, so it is a plain `div` with `role="note"`
 * and no live region. `variant` picks the rule's hue, `size` picks the padding and
 * rule weight together.
 */
const meta = {
  title: 'Primitives/Feedback/Callout',
  component: Callout,
  parameters: { layout: 'padded' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'success', 'warning', 'info'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Callout>

export default meta
type Story = StoryObj<typeof meta>

const variants = ['default', 'info', 'success', 'warning', 'destructive'] as const
const sizes = ['sm', 'md', 'lg'] as const

/** Every hue on the start-edge rule. `default` is the accent; the rest match `Alert`'s tones. */
export const Variants: Story = {
  render: () => (
    <div class="flex w-144 flex-col gap-3">
      {variants.map((variant) => (
        <Callout variant={variant}>
          <CalloutTitle>{variant}</CalloutTitle>
          The rule carries the hue; the text stays on the card foreground.
        </Callout>
      ))}
    </div>
  ),
}

/**
 * The three rungs. `lg` is a view's lead summary, `md` a supporting aside, `sm` a
 * short inline note. Padding and rule weight move together, so a caller never
 * tunes either by hand.
 */
export const Sizes: Story = {
  render: () => (
    <div class="flex w-144 flex-col gap-3">
      {sizes.map((size) => (
        <Callout size={size}>
          <CalloutTitle>Size {size}</CalloutTitle>
          Release 0.135.0 is ready; the soak lane passed on the last three runs.
        </Callout>
      ))}
    </div>
  ),
}

/** The full matrix, so a change to one hue or rung is judged against every other. */
export const Matrix: Story = {
  render: () => (
    <div class="flex w-144 flex-col gap-3">
      {sizes.flatMap((size) =>
        variants.map((variant) => (
          <Callout variant={variant} size={size}>
            {variant} / {size}
          </Callout>
        ))
      )}
    </div>
  ),
}

/** A title line above the body. A title alone takes no trailing margin. */
export const WithTitle: Story = {
  render: () => (
    <div class="flex w-144 flex-col gap-3">
      <Callout>
        <CalloutTitle>Remembered from earlier</CalloutTitle>
        This workspace deploys from the main branch, and releases are cut by Release Please.
      </Callout>
      <Callout variant="info">
        <CalloutTitle>Title only</CalloutTitle>
      </Callout>
    </div>
  ),
}

/** Long, unbroken and multi-paragraph content wraps inside the block and never overflows it. */
export const LongContent: Story = {
  render: () => (
    <Callout class="w-144" size="lg">
      <CalloutTitle>A summary that runs to several lines and a long identifier</CalloutTitle>
      <p>
        The migration moved fourteen worktrees to read-only storage, rewrote the lockfile for every
        workspace, and left the original checkouts untouched so a rollback is a directory rename
        rather than a restore. Nothing outside the repository was changed.
      </p>
      <p class="mt-3">
        Identifier:
        packages-ui-src-components-ui-callout-callout-stories-tsx-with-an-unbroken-name-that-has-no-break-opportunity
      </p>
    </Callout>
  ),
}

/** A link and inline code inside the body keep their own colour, focus ring and contrast on the card. */
export const WithLinkAndCode: Story = {
  render: () => (
    <div class="flex w-144 flex-col gap-3">
      <Callout>
        Run <code class="font-mono text-sm">bun run registry:build</code>, then read the{' '}
        <TextLink href="#contributing">contributing guide</TextLink> before opening a pull request.
      </Callout>
      <Callout variant="warning" size="sm">
        Use <code class="font-mono text-sm">verify:changed</code> or see{' '}
        <TextLink href="#checks">the checks</TextLink>.
      </Callout>
    </div>
  ),
}

/** In a narrow column the block fills the width and its text wraps; the rule stays full height. */
export const Narrow: Story = {
  render: () => (
    <div class="w-56">
      <Callout size="sm">
        <CalloutTitle>Narrow column</CalloutTitle>
        A callout in a 224px container wraps its text and keeps the rule the full height of the
        block.
      </Callout>
    </div>
  ),
}

/**
 * `role="note"` is the default and a caller may override it. There is no
 * `aria-live` and no `role="alert"`: nothing is announced when it renders.
 */
export const RoleOverride: Story = {
  render: () => (
    <div class="flex w-144 flex-col gap-3">
      <Callout>Default: a note landmark role, silent.</Callout>
      <Callout role="region" aria-label="Release summary" variant="info">
        A caller-supplied role and name: a labelled region in the document outline.
      </Callout>
    </div>
  ),
}
