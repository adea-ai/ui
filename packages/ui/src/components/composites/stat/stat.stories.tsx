import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { PropertyList, PropertyRow, PropertyTerm, PropertyValue, Stat, StatGroup } from './stat'

/**
 * Stat and PropertyList.
 *
 * `Stat` is a single measured number with its label and, optionally, its change. The
 * whole component is a decision about honesty: a value shown without its comparison is
 * not information, so `delta` carries the direction and — through `deltaTone` —
 * whether that direction is *good*. A rising number is not always a rising outcome,
 * and only the caller knows which way is which.
 *
 * `PropertyList` is a definition list for read-only metadata: a `<dl>`, not a table
 * and not a grid of divs, because the relationship being expressed is
 * term-and-definition and the platform has an element for exactly that.
 */
const meta = {
  title: 'Composites/Stat',
  component: Stat,
  parameters: { layout: 'padded' },
  args: { label: 'Coverage', value: '83.4' },
  tags: ['autodocs'],
} satisfies Meta<typeof Stat>

export default meta
type Story = StoryObj<typeof meta>

/** A row of headline numbers with their comparisons. */
export const Group: Story = {
  render: () => (
    <div class="w-192">
      <StatGroup>
        <Stat
          label="Coverage"
          value="83.4"
          unit="%"
          delta="+1.9 from last week"
          deltaTone="up"
          accent
        />
        <Stat label="Stories" value="128" delta="+14" deltaTone="up" />
        <Stat label="Bundle" value="412" unit="kB" delta="+38 kB" deltaTone="down" accent />
        <Stat label="Soak" value="24h 00m" delta="budget honoured" deltaTone="neutral" />
      </StatGroup>
    </div>
  ),
}

// A function: a JSX element is one DOM tree and can be placed only once.
const stats = () => (
  <>
    <Stat label="Documents" value="12,480" />
    <Stat label="Chunks" value="96,210" />
    <Stat label="Sources" value="7" />
    <Stat label="Embedding cache hits" value="41,002" />
    <Stat label="Query cache" value="318 entries" />
    <Stat label="Retrieval fallbacks" value="0" />
    <Stat label="Answers total" value="1,204" />
  </>
)

/**
 * `fit` sizes the columns from the group's own width, not the viewport's.
 *
 * The same seven stats in a 384px pane and a 768px pane. The default group steps by
 * viewport breakpoint, so a narrow pane in a wide window still asks for four columns
 * and the tiles crush; the `fit` group fits as many 150px-minimum tiles as the pane
 * holds (two here, then four) and lets them grow to fill the row, whatever the stat
 * count. Use it for a metrics block inside a docked or resizable pane.
 */
export const Fit: Story = {
  render: () => (
    <div class="flex flex-col gap-6">
      <div class="w-96 rounded-xl border border-border p-3">
        <StatGroup fit>{stats()}</StatGroup>
      </div>
      <div class="w-192 rounded-xl border border-border p-3">
        <StatGroup fit>{stats()}</StatGroup>
      </div>
    </div>
  ),
}

/**
 * The tone carries the judgement, not the sign.
 *
 * A rising bundle size is a regression, so it is `down` even though the number went
 * up. This is the reason the component takes a tone rather than colouring from the
 * delta string.
 */
export const DeltaTones: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4">
      <div class="flex flex-wrap gap-3">
        <Stat label="Improved" value="12" delta="+4" deltaTone="up" />
        <Stat label="Regressed" value="38" delta="+38" deltaTone="down" />
        <Stat label="Unchanged" value="0" delta="no change" deltaTone="neutral" />
      </div>
      <p class="text-sm text-muted-foreground">
        The arrow and the colour both come from `deltaTone`, so they can never contradict each
        other.
      </p>
    </div>
  ),
}

/** A bare stat, for a value with no comparison to make. */
export const WithoutDelta: Story = {
  render: () => (
    <div class="flex gap-3">
      <Stat label="Primitives" value="44" />
      <Stat label="Layout regions" value="7" />
      <Stat label="Composites" value="3" />
    </div>
  ),
}

/** The property list, for read-only metadata about one thing. */
export const Properties: Story = {
  render: () => (
    <div class="w-96">
      <PropertyList>
        <PropertyTerm>Base</PropertyTerm>
        <PropertyValue>main</PropertyValue>
        <PropertyTerm>Materialised</PropertyTerm>
        <PropertyValue>copy-on-write</PropertyValue>
        <PropertyTerm>Digest</PropertyTerm>
        <PropertyValue class="font-mono text-xs">sha256:9f2c41ab…</PropertyValue>
        <PropertyTerm>Created</PropertyTerm>
        <PropertyValue>2026-09-24 17:41</PropertyValue>
      </PropertyList>
    </div>
  ),
}

/** The row form, for a list built one pair at a time. */
export const PropertyRows: Story = {
  render: () => (
    <div class="flex w-96 flex-col gap-2 rounded-xl border border-border p-4">
      <PropertyRow term="Status">Passed</PropertyRow>
      <PropertyRow term="Duration">24h 00m</PropertyRow>
      <PropertyRow term="Stalled streams">0</PropertyRow>
      <PropertyRow term="Resyncs">0</PropertyRow>
    </div>
  ),
}
