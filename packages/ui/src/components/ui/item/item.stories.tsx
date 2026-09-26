import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { FileText, MoreHorizontal, Search } from 'lucide-solid'
import { Avatar, AvatarFallback } from '../avatar/avatar'
import { Badge } from '../badge/badge'
import { Button } from '../button/button'
import { Item, ItemDescription, ItemEmpty, ItemGroup, ItemGroupEntry, ItemTitle } from './item'

/**
 * Item.
 *
 * The general row: a leading slot, a body, a trailing slot. Almost every list takes
 * this shape, and it exists as a component because a row is where inconsistency is
 * most visible — twenty of them make any drift in height or alignment obvious.
 *
 * The difference from `ListRow` is what it is for. `ListRow` is one row in a list of
 * like things, sized by the row ladder and meant to be scanned down a column. `Item`
 * is a self-contained block with its own surface and edge — a search result, a
 * settings card — meant to stand alone or sit in a grid.
 */
const meta = {
  title: 'Primitives/Data display/Item',
  component: Item,
  parameters: { layout: 'padded' },
  argTypes: {
    variant: { control: 'select', options: ['default', 'outline', 'muted'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Item>

export default meta
type Story = StoryObj<typeof meta>

/** The three variants, which answer "does this need an edge" and "inset or not". */
export const Variants: Story = {
  render: () => (
    <div class="flex w-96 flex-col gap-3">
      <Item variant="default" media={<FileText />}>
        <ItemTitle>Default</ItemTitle>
        <ItemDescription>Bare, for a row that already has a surface.</ItemDescription>
      </Item>
      <Item variant="outline" media={<FileText />}>
        <ItemTitle>Outline</ItemTitle>
        <ItemDescription>The search-result shape: its own edge on the canvas.</ItemDescription>
      </Item>
      <Item variant="muted" media={<FileText />}>
        <ItemTitle>Muted</ItemTitle>
        <ItemDescription>Inset: a quoted message, a disabled row.</ItemDescription>
      </Item>
    </div>
  ),
}

/** A result with a media slot, a body and a trailing action. */
export const WithTrailing: Story = {
  render: () => (
    <Item
      variant="outline"
      class="w-96"
      media={
        <Avatar size="sm">
          <AvatarFallback name="Ada Lovelace" />
        </Avatar>
      }
      trailing={
        <>
          <Badge variant="success">Active</Badge>
          <Button size="icon-2xs" variant="ghost" aria-label="More actions for Ada Lovelace">
            <MoreHorizontal />
          </Button>
        </>
      }
    >
      <ItemTitle>Ada Lovelace</ItemTitle>
      <ItemDescription>Maintains the design system.</ItemDescription>
    </Item>
  ),
}

/** A group is a real list, so a screen reader reports how many results there are. */
export const Grouped: Story = {
  render: () => (
    <div class="w-96">
      <ItemGroup label="Results" listLabel="Search results">
        <ItemGroupEntry variant="outline" media={<Search />}>
          <ItemTitle>side-rail.tsx</ItemTitle>
          <ItemDescription>packages/ui/src/components/layout</ItemDescription>
        </ItemGroupEntry>
        <ItemGroupEntry variant="outline" media={<Search />}>
          <ItemTitle>theme.css</ItemTitle>
          <ItemDescription>packages/ui/src/styles</ItemDescription>
        </ItemGroupEntry>
      </ItemGroup>
    </div>
  ),
}

/** An empty group says so, rather than showing nothing. */
export const Empty: Story = {
  render: () => (
    <div class="w-96 rounded-lg border border-border">
      <ItemEmpty>No results. Search covers file names and paths.</ItemEmpty>
    </div>
  ),
}
