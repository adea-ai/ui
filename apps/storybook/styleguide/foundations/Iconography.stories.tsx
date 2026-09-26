import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import {
  Bell,
  BookOpen,
  Boxes,
  ChevronRight,
  CircleCheck,
  CloudUpload,
  Database,
  FileText,
  GitBranch,
  Home,
  Info,
  LayoutGrid,
  Loader,
  MessageSquare,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sparkles,
  Terminal,
  TriangleAlert,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-solid'
import { For } from 'solid-js'
import {
  Badge,
  Button,
  Input,
  InputGroup,
  StatusChip,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@adea-ai/ui'

/**
 * Iconography.
 *
 * One icon set — `lucide-solid` — and one size rule: an icon is sized by the
 * component's own `size` rung, through a `[&_svg]:size-*` selector on the variant.
 * A caller never writes a width or a height on an icon, and never passes a `size`
 * prop to one.
 *
 * That is worth stating as a rule rather than a habit, because the failure is
 * subtle: an icon with its own `size` prop looks right in the one place it was
 * checked and misaligns everywhere else. The rung is what makes an icon button in a
 * toolbar the same height as the text buttons beside it — not two authors agreeing.
 *
 * ## The one thing a caller does set
 *
 * An icon-only control needs an accessible name. `aria-label` is the usual way; a
 * visually hidden span is for when the label is also drawn somewhere else. This is
 * the finding the accessibility lane raises most often, and it is a real defect
 * rather than a technicality — an unnamed icon is unreachable by a screen reader and
 * by voice control, and it is the only thing on the screen that says what it does.
 *
 * A decorative icon takes `aria-hidden` and no name at all. Both are correct; what
 * is not correct is neither, which is what a bare `<Icon />` inside a button is.
 */
const meta = {
  title: 'Foundations/Iconography',
  component: () => null,
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The set, drawn at the size a component uses rather than at a size chosen here. */
const sample = [
  { name: 'Home', icon: Home },
  { name: 'Search', icon: Search },
  { name: 'Bell', icon: Bell },
  { name: 'User', icon: User },
  { name: 'Settings', icon: Settings },
  { name: 'Plus', icon: Plus },
  { name: 'Close', icon: X },
  { name: 'Chevron', icon: ChevronRight },
  { name: 'Message', icon: MessageSquare },
  { name: 'File', icon: FileText },
  { name: 'Terminal', icon: Terminal },
  { name: 'Git branch', icon: GitBranch },
  { name: 'Database', icon: Database },
  { name: 'Boxes', icon: Boxes },
  { name: 'Layout', icon: LayoutGrid },
  { name: 'Panel', icon: PanelLeft },
  { name: 'Wrench', icon: Wrench },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Upload', icon: CloudUpload },
  { name: 'Book', icon: BookOpen },
  { name: 'Zap', icon: Zap },
  { name: 'Loader', icon: Loader },
  { name: 'Success', icon: CircleCheck },
  { name: 'Warning', icon: TriangleAlert },
  { name: 'Info', icon: Info },
] as const

/**
 * The sample set. These are the icons the product actually reaches for, not the
 * whole of lucide — importing a set is cheap and naming a canonical subset is what
 * keeps two screens from using two different glyphs for "search".
 */
export const Set: Story = {
  render: () => (
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <For each={sample}>
        {(entry) => (
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <entry.icon aria-hidden="true" class="size-4 shrink-0 text-foreground" />
            <span class="truncate">{entry.name}</span>
          </div>
        )}
      </For>
    </div>
  ),
}

/**
 * One rung, six components. The icon is the same size in all of them because the
 * *component* decides, and every component reads the same ladder.
 */
export const SizedByTheComponent: Story = {
  render: () => (
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <For each={['2xs', 'xs', 'sm', 'md', 'lg'] as const}>
          {(size) => (
            <Button size={size}>
              <Plus aria-hidden="true" />
              Add
            </Button>
          )}
        </For>
      </div>
      <div class="flex items-center gap-3">
        <For each={['icon-2xs', 'icon-xs', 'icon-sm', 'icon-md', 'icon-lg'] as const}>
          {(size) => (
            <Button variant="outline" size={size} aria-label="Add an item">
              <Plus aria-hidden="true" />
            </Button>
          )}
        </For>
      </div>
      <p class="max-w-prose text-sm text-muted-foreground">
        An icon button and a text button at the same rung are the same height. Neither one sets a
        width or a height on the icon.
      </p>
    </div>
  ),
}

/**
 * The rule that matters. Three controls, three ways to be named, and one that is
 * wrong — the bare icon.
 */
export const Naming: Story = {
  render: () => (
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <Button variant="outline" size="icon-sm" aria-label="Search the workspace">
          <Search aria-hidden="true" />
        </Button>
        <span class="text-xs text-muted-foreground">
          <code>aria-label</code> — the usual case. The name is not drawn anywhere else.
        </span>
      </div>
      <div class="flex items-center gap-3">
        <Button variant="outline" size="sm">
          <Plus aria-hidden="true" />
          New task
        </Button>
        <span class="text-xs text-muted-foreground">
          The icon is <code>aria-hidden</code>; the visible text is the name. Two names would read
          as "Add New task".
        </span>
      </div>
      <div class="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger as="span" class="inline-flex">
            <Button variant="ghost" size="icon-sm" aria-label="Workspace settings">
              <Settings aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Workspace settings</TooltipContent>
        </Tooltip>
        <span class="text-xs text-muted-foreground">
          A tooltip is not a name. It is drawn on hover and focus only, so the control still needs
          its own label — the tooltip repeats it for a sighted reader.
        </span>
      </div>
    </div>
  ),
}

/**
 * An icon inside a field is decoration: it takes `aria-hidden` and the field's own
 * label carries the meaning.
 */
export const InAField: Story = {
  render: () => (
    <div class="grid w-72 gap-2">
      <InputGroup>
        <Search aria-hidden="true" class="size-4 text-muted-foreground" />
        <Input aria-label="Search" placeholder="Search" />
      </InputGroup>
      <p class="text-xs text-muted-foreground">
        The glyph is decorative. The input's <code>aria-label</code> is the name, and the
        placeholder is not one — it disappears the moment anything is typed.
      </p>
    </div>
  ),
}

/**
 * An icon may carry a status, and then it is not decoration. `StatusChip` puts the
 * meaning in text and keeps the dot `aria-hidden`, so a tone is never the only
 * signal — which is also what makes it readable in greyscale.
 */
export const IconsThatCarryMeaning: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-4">
        <StatusChip tone="success" label="Synced" />
        <StatusChip tone="warning" label="Needs configuration" />
        <StatusChip tone="unknown" label="Activity unknown" />
      </div>
      <div class="flex items-center gap-4">
        <Badge variant="success">
          <CircleCheck aria-hidden="true" />
          Passed
        </Badge>
        <Badge variant="warning">
          <TriangleAlert aria-hidden="true" />
          Degraded
        </Badge>
      </div>
      <p class="max-w-prose text-sm text-muted-foreground">
        Both carry the state in words. An icon-only status is unreadable to anyone who does not
        already know the glyph, and a colour-only one is unreadable in greyscale and to a reader who
        cannot separate the hues.
      </p>
    </div>
  ),
}
