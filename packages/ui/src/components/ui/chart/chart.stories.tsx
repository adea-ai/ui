import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import {
  BarChart,
  ChartFrame,
  ChartLegend,
  DonutChart,
  LineChart,
  PolarAreaChart,
  RadarChart,
  ScatterChart,
} from './chart'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const sessions = [{ label: 'Sessions', data: [12, 19, 14, 22, 28, 31] }]

const meta = {
  title: 'UI/Chart',
  component: LineChart,
  tags: ['autodocs'],
  args: { labels: months, series: sessions },
  parameters: {
    docs: {
      description: {
        component:
          'A thin wrapper over Chart.js, themed through the same custom properties as everything else. Chart.js was chosen for its registration model: nothing is bundled until a controller is registered, so importing `LineChart` does not carry the radar or polar-area controllers. Measured by `check:tree-shaking`: 86.2 kB for one chart type against 96.5 kB for all seven. `chart.js`, `solid-chartjs` and `embla` are optional peer dependencies — an application that uses neither the chart nor the carousel does not install them.',
      },
    },
  },
  decorators: [
    () => (
      <div class="w-[36rem]">
        <ChartFrame title="Sessions per month" description="Rolling six months.">
          <LineChart
            labels={months}
            series={[
              { label: 'Desktop', data: [12, 19, 14, 22, 28, 31] },
              { label: 'Web', data: [8, 9, 13, 11, 15, 17] },
            ]}
          />
        </ChartFrame>
      </div>
    ),
  ],
} satisfies Meta<typeof LineChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    labels: months,
    series: [{ label: 'Sessions', data: [12, 19, 14, 22, 28, 31] }],
  },
}

export const Area: Story = {
  render: () => (
    <div class="w-[36rem]">
      <ChartFrame title="Cumulative sessions">
        <LineChart
          area
          labels={months}
          series={[{ label: 'Sessions', data: [12, 31, 45, 67, 95, 126] }]}
        />
      </ChartFrame>
    </div>
  ),
}

export const Bars: Story = {
  render: () => (
    <div class="w-[36rem]">
      <ChartFrame title="Turns by harness">
        <BarChart
          stacked
          labels={['M12', 'M13', 'M14', 'M15']}
          series={[
            { label: 'Pi', data: [40, 52, 61, 70] },
            { label: 'Codex', data: [22, 31, 28, 34] },
          ]}
        />
      </ChartFrame>
    </div>
  ),
}

/** Horizontal bars, for category labels that are words rather than dates. */
export const HorizontalBars: Story = {
  render: () => (
    <div class="w-[36rem]">
      <ChartFrame title="Where the time went">
        <BarChart
          horizontal
          labels={['Terminals', 'Worktrees', 'Browser', 'Files']}
          series={[{ label: 'Hours', data: [42, 18, 12, 9] }]}
        />
      </ChartFrame>
    </div>
  ),
}

/** Past about six slices the labels collide; this is the limit, not a target. */
export const Composition: Story = {
  render: () => (
    <div class="flex w-[36rem] gap-4">
      <ChartFrame title="By harness" class="flex-1">
        <DonutChart labels={['Pi', 'Codex', 'Claude', 'Other']} data={[52, 24, 15, 9]} />
        <ChartLegend
          series={[{ label: 'Pi' }, { label: 'Codex' }, { label: 'Claude' }, { label: 'Other' }]}
        />
      </ChartFrame>
      <ChartFrame title="As a pie" class="flex-1">
        <DonutChart cutout={0} labels={['Pi', 'Codex', 'Claude', 'Other']} data={[52, 24, 15, 9]} />
      </ChartFrame>
    </div>
  ),
}

/** A radar, for a profile across fixed axes rather than a series over time. */
export const Profile: Story = {
  render: () => (
    <div class="w-[36rem]">
      <ChartFrame title="Capability profile">
        <RadarChart
          labels={['Speed', 'Accuracy', 'Cost', 'Context', 'Tools']}
          series={[
            { label: 'Pi', data: [7, 8, 6, 9, 7] },
            { label: 'Codex', data: [8, 9, 4, 7, 9] },
          ]}
        />
      </ChartFrame>
    </div>
  ),
}

export const Polar: Story = {
  render: () => (
    <div class="w-[36rem]">
      <ChartFrame title="Context sources">
        <PolarAreaChart
          labels={['Skills', 'Memory', 'History', 'Lessons', 'Tools']}
          data={[32, 24, 18, 14, 12]}
        />
      </ChartFrame>
    </div>
  ),
}

/** A scatter, for a correlation rather than a series. */
export const Correlation: Story = {
  render: () => (
    <div class="w-[36rem]">
      <ChartFrame title="Turn duration against context size">
        <ScatterChart
          series={[
            {
              label: 'Turns',
              data: [
                { x: 4, y: 12 },
                { x: 9, y: 19 },
                { x: 14, y: 22 },
                { x: 21, y: 31 },
                { x: 28, y: 38 },
                { x: 34, y: 41 },
              ],
            },
          ]}
        />
      </ChartFrame>
    </div>
  ),
}
