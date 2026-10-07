import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { ChevronDown, ChevronUp, CircleDot, FileText, MoreHorizontal } from 'lucide-solid'
import { ActionButton } from '../action-button/action-button'
import { Avatar, AvatarFallback } from '../../ui/avatar/avatar'
import { Badge } from '../../ui/badge/badge'
import { Button } from '../../ui/button/button'
import { ListGroup, ListRow } from './list-row'

/**
 * ListRow.
 *
 * One row in a list of like things. It is the highest-frequency component in an
 * application of this shape, and the one where a half-pixel of drift is most visible
 * — twenty rows of a sidebar make any inconsistency in height or padding obvious.
 *
 * The structure is fixed at four slots — `leading`, children, `description`,
 * `trailing` — so rows that show an avatar, an icon, a status dot, a timestamp and an
 * overflow menu all sit at the same height without the caller doing arithmetic.
 */
const meta = {
  title: 'Composites/List row',
  component: ListRow,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof ListRow>

export default meta
type Story = StoryObj<typeof meta>

/** The four slots, populated. */
export const Default: Story = {
  render: () => (
    <div class="w-96 rounded-xl border border-border p-2">
      <ListRow
        leading={<CircleDot />}
        trailing={
          <Badge size="sm" variant="secondary">
            41
          </Badge>
        }
      >
        adea
      </ListRow>
      <ListRow
        leading={<CircleDot />}
        trailing={
          <Badge size="sm" variant="secondary">
            12
          </Badge>
        }
      >
        cortana
      </ListRow>
      <ListRow
        leading={<CircleDot />}
        trailing={
          <Badge size="sm" variant="secondary">
            7
          </Badge>
        }
      >
        control-plane
      </ListRow>
    </div>
  ),
}

/** Selected and dense, which are the two states a list row takes. */
export const States: Story = {
  render: () => (
    <div class="w-96 rounded-xl border border-border p-2">
      <ListRow selected leading={<CircleDot />}>
        Selected row
      </ListRow>
      <ListRow leading={<CircleDot />}>Default row</ListRow>
      <ListRow dense leading={<CircleDot />}>
        Dense row (28px)
      </ListRow>
    </div>
  ),
}

/** A row grows from the two-line token when a description wraps. */
export const WithDescription: Story = {
  render: () => (
    <div class="w-72 rounded-xl border border-border p-2">
      <ListRow
        selected
        leading={<FileText />}
        description="Evidence from source documents"
        trailing={<time dateTime="2026-09-30">Sep 30</time>}
      >
        Workspace evidence
      </ListRow>
      <ListRow
        leading={
          <Avatar size="sm">
            <AvatarFallback name="Ada Lovelace" />
          </Avatar>
        }
        description="Maintains the design system and keeps long workspace descriptions readable at narrow widths"
        trailing={
          <Button size="icon-2xs" variant="ghost" aria-label="More actions for Ada Lovelace">
            <MoreHorizontal />
          </Button>
        }
      >
        Ada Lovelace
      </ListRow>
      <ListRow
        leading={
          <Avatar size="sm">
            <AvatarFallback name="Alan Turing" />
          </Avatar>
        }
        description="Runs the soak lane"
      >
        Alan Turing
      </ListRow>
    </div>
  ),
}

/** A long label and several actions stay readable in a narrow described row. */
export const ActionHeavyDescription: Story = {
  render: () => (
    <div class="w-80 rounded-xl border border-border p-2">
      <ListRow
        leading={<CircleDot />}
        description="A long description explains what this workspace application does and why its management actions remain available at narrow widths."
        trailing={
          <>
            <Badge size="sm" variant="secondary">
              In sidebar
            </Badge>
            <Button size="sm" variant="ghost">
              Open A Very Long Workspace Application Name
            </Button>
            <ActionButton
              size="icon-sm"
              variant="ghost"
              tooltip="Move workspace application up"
              aria-label="Move workspace application up"
            >
              <ChevronUp />
            </ActionButton>
            <ActionButton
              size="icon-sm"
              variant="ghost"
              tooltip="Move workspace application down"
              aria-label="Move workspace application down"
            >
              <ChevronDown />
            </ActionButton>
            <Button size="sm" variant="ghost" aria-label="Disable workspace application">
              Disable
            </Button>
          </>
        }
      >
        A Very Long Workspace Application Name
      </ListRow>
    </div>
  ),
}

/**
 * A short, truncating label whose one action must stay beside it: with
 * `stackTrailing={false}` the narrow container keeps the action inline instead
 * of dropping it onto its own line.
 */
export const InlineTrailing: Story = {
  render: () => (
    <div class="w-64 rounded-xl border border-border p-2">
      <ListRow
        leading={<CircleDot />}
        description="iOS 18.2 · booted"
        stackTrailing={false}
        trailing={
          <Button size="sm" variant="outline">
            Start
          </Button>
        }
      >
        iPhone 16 Pro
      </ListRow>
    </div>
  ),
}

/** Interactive rows use native buttons or links and expose a keyboard tooltip. */
export const Interactive: Story = {
  render: () => (
    <div class="w-96 rounded-xl border border-border p-2">
      <ListRow as="button" tooltip="Open the selected workspace" leading={<CircleDot />}>
        Open workspace
      </ListRow>
      <ListRow as="a" href="#details" tooltip="Read the workspace details" leading={<FileText />}>
        Workspace details
      </ListRow>
    </div>
  ),
}

/**
 * A row with a trailing action, which appears on hover.
 *
 * The action is `opacity-0` until hover rather than `hidden`, so it stays in the
 * accessibility tree and in the tab order — a control that only exists while the
 * pointer is over it cannot be reached by keyboard.
 */
export const WithHoverAction: Story = {
  render: () => (
    <div class="group/list w-96 rounded-xl border border-border p-2">
      <ListRow
        leading={<FileText />}
        trailing={
          <Button
            size="icon-2xs"
            variant="ghost"
            aria-label="More actions for side-rail.tsx"
            class="opacity-0 transition-opacity group-hover/list:opacity-100 focus-visible:opacity-100"
          >
            <MoreHorizontal />
          </Button>
        }
      >
        side-rail.tsx
      </ListRow>
    </div>
  ),
}

/** A grouped list, with a heading and a hover reveal on the heading's action. */
export const InAGroup: Story = {
  render: () => (
    <div class="w-96 rounded-xl border border-border p-2">
      <ListGroup
        label="Recent"
        action={
          <Button size="icon-2xs" variant="ghost" aria-label="Clear recent">
            <MoreHorizontal />
          </Button>
        }
      >
        <ListRow leading={<CircleDot />}>adea</ListRow>
        <ListRow leading={<CircleDot />}>cortana</ListRow>
      </ListGroup>
      <ListGroup label="Archived">
        <ListRow leading={<FileText />} dense>
          adea-mkt-wt
        </ListRow>
      </ListGroup>
    </div>
  ),
}
