import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Badge } from '../badge/badge'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableNumericCell,
  TableRow,
} from './table'

/**
 * Table.
 *
 * Semantic markup, not a grid of divs. A `<table>` with a caption and scoped
 * headers is navigable in ways a flex layout cannot be reproduced into: "row 3 of
 * 12, Duration column" is only possible if the platform knows there are rows and
 * columns.
 *
 * Two decisions worth keeping:
 *
 *   - The header is sticky by default. A scrollable table whose header leaves the
 *     viewport makes every row below it anonymous.
 *   - Numbers are right-aligned and tabular. That is what lets a column of figures
 *     be compared by eye — `TableNumericCell` exists so a caller does not have to
 *     remember the second half of the rule.
 */
const meta = {
  title: 'Primitives/Data display/Table',
  component: Table,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Table>

export default meta
type Story = StoryObj<typeof meta>

const runs = [
  { id: 'r-1042', lane: 'soak', status: 'Passed', duration: '24h 00m', coverage: '83.4%' },
  { id: 'r-1041', lane: 'endurance', status: 'Passed', duration: '6h 12m', coverage: '83.1%' },
  { id: 'r-1040', lane: 'preview-perf', status: 'Skipped', duration: '—', coverage: '—' },
  { id: 'r-1039', lane: 'soak', status: 'Failed', duration: '0h 47m', coverage: '82.9%' },
]

const statusVariant = {
  Passed: 'success',
  Skipped: 'warning',
  Failed: 'destructive',
} as const

/** The canonical shape: caption, header, body, numeric columns right-aligned. */
export const Default: Story = {
  render: () => (
    <Table class="w-168">
      <TableCaption>Budget verdicts from the last four runs.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Run</TableHead>
          <TableHead>Lane</TableHead>
          <TableHead>Status</TableHead>
          <TableHead class="text-end">Duration</TableHead>
          <TableHead class="text-end">Coverage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow>
            <TableCell class="font-mono text-xs">{run.id}</TableCell>
            <TableCell>{run.lane}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[run.status as keyof typeof statusVariant]}>
                {run.status}
              </Badge>
            </TableCell>
            <TableNumericCell>{run.duration}</TableNumericCell>
            <TableNumericCell>{run.coverage}</TableNumericCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

/**
 * A footer, for a total that belongs to the table rather than to a row.
 *
 * The footer is visually distinct and semantically inside the table, so a screen
 * reader reads it as the table's conclusion rather than as another row.
 */
export const WithFooter: Story = {
  render: () => (
    <Table class="w-168">
      <TableHeader>
        <TableRow>
          <TableHead>Lane</TableHead>
          <TableHead class="text-end">Runs</TableHead>
          <TableHead class="text-end">Pass rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[
          { lane: 'soak', runs: 12, rate: '91.7%' },
          { lane: 'endurance', runs: 12, rate: '100%' },
          { lane: 'preview-perf', runs: 8, rate: '87.5%' },
        ].map((row) => (
          <TableRow>
            <TableCell>{row.lane}</TableCell>
            <TableNumericCell>{row.runs}</TableNumericCell>
            <TableNumericCell>{row.rate}</TableNumericCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>All lanes</TableCell>
          <TableNumericCell>32</TableNumericCell>
          <TableNumericCell>93.8%</TableNumericCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
}

/**
 * A selected row.
 *
 * `data-state="selected"` paints the row with the subtle primary tint, which is
 * the same fill a selected list row uses — so a selection reads the same whichever
 * component is showing it.
 */
export const SelectedRow: Story = {
  render: () => (
    <Table class="w-[32rem]">
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead class="text-end">Sessions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow data-state="selected">
          <TableCell>adea</TableCell>
          <TableNumericCell>41</TableNumericCell>
        </TableRow>
        <TableRow>
          <TableCell>cortana</TableCell>
          <TableNumericCell>12</TableNumericCell>
        </TableRow>
        <TableRow>
          <TableCell>control-plane</TableCell>
          <TableNumericCell>7</TableNumericCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}

/**
 * A wide table, which scrolls rather than pushing the layout.
 *
 * The container is `overflow-x: auto`, so a table with more columns than the pane
 * can show scrolls internally instead of widening the shell. This is the case
 * where a div grid most often wins by accident: it silently makes the window
 * scroll.
 */
export const WideAndScrollable: Story = {
  render: () => (
    <div class="w-112">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Lane</TableHead>
            <TableHead>Host</TableHead>
            <TableHead>Started</TableHead>
            <TableHead class="text-end">Duration</TableHead>
            <TableHead class="text-end">Frames</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow>
              <TableCell class="font-mono text-xs">{run.id}</TableCell>
              <TableCell>{run.lane}</TableCell>
              <TableCell>this machine</TableCell>
              <TableCell>2026-09-24 02:00</TableCell>
              <TableNumericCell>{run.duration}</TableNumericCell>
              <TableNumericCell>6,412</TableNumericCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
}

/** The empty state belongs inside the table, not instead of it. */
export const Empty: Story = {
  render: () => (
    <Table class="w-[32rem]">
      <TableHeader>
        <TableRow>
          <TableHead>Lane</TableHead>
          <TableHead class="text-end">Runs</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={2} class="h-24 text-center text-muted-foreground">
            No runs in the last 24 hours.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}
