import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { BookOpen, Wrench } from 'lucide-solid'
import { Badge } from '../badge'
import { EntityIcon, monogram } from './entity-icon'

const meta = {
  title: 'UI/Entity Icon',
  component: EntityIcon,
  tags: ['autodocs'],
  args: { name: 'Kitchen' },
  parameters: {
    docs: {
      description: {
        component:
          'A tile that stands for a thing — a room, a project, an agent, a plugin, a workspace. Separate from `Avatar` because a thing is not a person: `rounded` reads as an object, `circle` as a face. A tile with no logo gets a monogram rather than an empty box.',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    tone: {
      control: 'select',
      options: ['neutral', 'primary', 'bare', 'success', 'warning', 'danger', 'info'],
    },
    shape: { control: 'select', options: ['rounded', 'circle', 'square'] },
  },
} satisfies Meta<typeof EntityIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { name: 'Kitchen' } }

/**
 * The monogram rule, which is the reason a grid of these stays legible: two words
 * give two initials, one word gives two characters.
 */
export const Monograms: Story = {
  render: () => (
    <div class="grid gap-4">
      <div class="flex items-center gap-3">
        <EntityIcon name="Kitchen" />
        <EntityIcon name="Engineering" />
        <EntityIcon name="Agent HQ" />
        <EntityIcon name="Plugin Registry" />
        <EntityIcon name="a" />
      </div>
      <dl class="grid gap-1 text-xs text-muted-foreground">
        <div class="flex gap-2">
          <dt class="font-mono">Kitchen</dt>
          <dd>→ {monogram('Kitchen')}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="font-mono">Agent HQ</dt>
          <dd>→ {monogram('Agent HQ')}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="font-mono">a</dt>
          <dd>→ {monogram('a')}</dd>
        </div>
      </dl>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div class="flex items-center gap-3">
      <EntityIcon name="Small" size="xs" />
      <EntityIcon name="Small" size="sm" />
      <EntityIcon name="Medium" size="md" />
      <EntityIcon name="Large" size="lg" />
      <EntityIcon name="Extra large" size="xl" />
    </div>
  ),
}

/** A glyph when the entity has one, the monogram when it does not. */
export const WithGlyphs: Story = {
  render: () => (
    <div class="flex items-center gap-3">
      <EntityIcon name="Reading room" icon={<BookOpen />} />
      <EntityIcon name="Engineering" icon={<Wrench />} tone="primary" />
      <EntityIcon name="Travel" />
    </div>
  ),
}

/** A badge in the corner: an unread count, a status dot, an installed tick. */
export const WithBadge: Story = {
  render: () => (
    <div class="flex items-center gap-4">
      <EntityIcon
        name="Engineering"
        icon={<Wrench />}
        badge={
          <Badge size="sm" variant="destructive">
            3
          </Badge>
        }
      />
      <EntityIcon
        name="Kitchen"
        badge={<span class="block size-2.5 rounded-full bg-success ring-2 ring-background" />}
      />
    </div>
  ),
}

/** `ring` is the active or selected treatment — for a rail that is a switcher. */
export const Selected: Story = {
  render: () => (
    <div class="flex items-center gap-4">
      <EntityIcon name="Active workspace" ring tone="primary" />
      <EntityIcon name="Inactive workspace" />
    </div>
  ),
}

/**
 * The whole point of `shape`: a rail holding both things and people has to tell
 * them apart at a glance.
 */
export const NotAnAvatar: Story = {
  render: () => (
    <div class="flex items-center gap-3">
      <EntityIcon name="A workspace" shape="rounded" />
      <EntityIcon name="A person" shape="circle" tone="bare" />
    </div>
  ),
}
