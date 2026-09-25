import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { LoaderCircle, Plus, Trash2 } from 'lucide-solid'
import { Button } from './button'

/**
 * Button.
 *
 * Every pressable thing in the system draws from this component. A toolbar
 * control, a dialog action and a form submit are the same object at the same
 * size and the same density, which is what keeps a row of them from drifting
 * apart.
 *
 * The variants answer *what is this for* — never *what colour is it*. A caller
 * that wants a red button writes `variant="destructive"` and the red stays here.
 * That is also what lets the design-system linter tell a caller which variant to
 * use instead of only which class was wrong.
 */
const meta = {
  title: 'Primitives/Actions/Button',
  component: Button,
  parameters: { layout: 'padded' },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'outline',
        'ghost',
        'subtle',
        'success',
        'link',
      ],
      description: 'What the action is for. Appearance follows from that.',
    },
    size: {
      control: 'select',
      options: [
        '2xs',
        'xs',
        'sm',
        'md',
        'lg',
        'xl',
        'icon-2xs',
        'icon-xs',
        'icon-sm',
        'icon-md',
        'icon-lg',
        'icon-xl',
      ],
      description: 'A rung on the shared control ladder. `md` is the default.',
    },
    disabled: { control: 'boolean' },
  },
  args: { children: 'Button' },
  tags: ['autodocs'],
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/** One primary action per view. The emerald is reserved for it. */
export const Default: Story = {}

/**
 * Every variant, at the default size.
 *
 * `default` is the one primary action in a view; `secondary` is a quieter peer;
 * `outline` belongs on a surface that already has a fill; `ghost` is the default
 * for toolbar and row actions, where chrome would be noise; `subtle` is a tinted
 * primary for a secondary step inside a primary flow.
 */
export const Variants: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="subtle">Subtle</Button>
      <Button variant="success">Success</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

/**
 * The six heights, which are the same six heights every control uses.
 *
 * `sm` is the toolbar default and `md` the form default — 28px and 32px, the two
 * rungs that carry almost every control in the product.
 */
export const Sizes: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-3">
      <Button size="2xs">2xs</Button>
      <Button size="xs">xs</Button>
      <Button size="sm">sm</Button>
      <Button size="md">md</Button>
      <Button size="lg">lg</Button>
      <Button size="xl">xl</Button>
    </div>
  ),
}

/**
 * Icon-only sizes.
 *
 * A square control is a size rung, not a width class — which is why an icon
 * button in a toolbar lines up with the text buttons beside it. Each one needs
 * an accessible name: `aria-label`, or a visually hidden `<span>`. An icon with
 * neither is unreachable by a screen reader and by voice control, and it is the
 * accessibility finding this library's tests catch most often.
 */
export const IconOnly: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-3">
      <Button size="icon-2xs" aria-label="Add">
        <Plus />
      </Button>
      <Button size="icon-xs" aria-label="Add">
        <Plus />
      </Button>
      <Button size="icon-sm" aria-label="Add" variant="outline">
        <Plus />
      </Button>
      <Button size="icon-md" aria-label="Add" variant="outline">
        <Plus />
      </Button>
      <Button size="icon-lg" aria-label="Delete" variant="ghost">
        <Trash2 />
      </Button>
      <Button size="icon-xl" aria-label="Delete" variant="destructive">
        <Trash2 />
      </Button>
    </div>
  ),
}

/** An icon beside a label: the size rung sets the gap and the glyph together. */
export const WithIcon: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-3">
      <Button>
        <Plus />
        New project
      </Button>
      <Button variant="outline">
        <Plus />
        Add member
      </Button>
      <Button variant="destructive">
        <Trash2 />
        Delete
      </Button>
    </div>
  ),
}

/**
 * A button in flight.
 *
 * The label is replaced rather than a spinner added beside it, so the button
 * does not change width mid-click — a control that resizes under the pointer is
 * how a user misses a second press. `disabled` while in flight, because a second
 * submit is never what was meant.
 */
export const Loading: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-3">
      <Button disabled>
        <LoaderCircle class="animate-spin" />
        Saving…
      </Button>
      <Button variant="outline" disabled>
        <LoaderCircle class="animate-spin" />
        Connecting…
      </Button>
    </div>
  ),
}

/** Disabled and invalid states, and what they look like at their dimmest. */
export const States: Story = {
  render: () => (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Button disabled>Disabled default</Button>
        <Button variant="outline" disabled>
          Disabled outline
        </Button>
        <Button variant="destructive" disabled>
          Disabled destructive
        </Button>
      </div>
      <p class="max-w-prose text-sm text-muted-foreground">
        Disabled is 50% opacity with pointer events off, so the cursor does not promise an
        interaction that will not happen. Reach for `disabled` only when the reason is knowable at a
        glance — a control that is disabled with no visible explanation reads as broken.
      </p>
    </div>
  ),
}

/**
 * Button as a link.
 *
 * The component is polymorphic: pass `as="a"` and it becomes an anchor while
 * keeping the same visual contract. This replaces the React-era `asChild`
 * primitive, which has no Solid equivalent that preserves props.
 */
export const AsLink: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-3">
      <Button as="a" href="#storybook-preview-iframe">
        Open the docs
      </Button>
      <Button as="a" href="#storybook-preview-iframe" variant="link">
        A link-styled action
      </Button>
    </div>
  ),
}

/**
 * A keyboard focus ring, shown rather than described.
 *
 * Tab from the button above to see it. The ring is `outline` rather than a
 * border or shadow, so it is painted outside the box and cannot shift layout —
 * and it is keyed on `:focus-visible`, so a pointer click never paints it.
 */
export const Focus: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        Press Tab to move focus onto the buttons. The ring is the only keyboard affordance in the
        system and it is never suppressed — the one thing a component may not do is remove it.
      </p>
      <div class="flex gap-3">
        <Button>First</Button>
        <Button variant="outline">Second</Button>
      </div>
    </div>
  ),
}
