import { Chart } from 'chart.js'
import { render } from 'solid-js/web'
import {
  BarChart,
  ChartFrame,
  DonutChart,
  LineChart,
  PolarAreaChart,
  RadarChart,
} from '../../src/components/ui/chart/chart'
import '../../src/styles/globals.css'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

function Fixture() {
  return (
    <main class="grid w-160 gap-4">
      <ChartFrame title="Sessions" description="Rolling six months.">
        <LineChart
          class="h-64"
          labels={months}
          options={{ animation: false }}
          series={[
            { label: 'Desktop', data: [12, 19, 14, 22, 28, 31] },
            { label: 'Web', data: [8, 9, 13, 11, 15, 17] },
          ]}
        />
      </ChartFrame>
      <BarChart
        stacked
        labels={['M12', 'M13', 'M14']}
        options={{ animation: false }}
        series={[
          { label: 'Pi', data: [40, 52, 61] },
          { label: 'Codex', data: [22, 31, 28] },
        ]}
      />
      <DonutChart labels={['Pi', 'Codex', 'Other']} data={[52, 24, 9]} />
      <DonutChart cutout={0} labels={['Pi', 'Codex', 'Other']} data={[52, 24, 9]} />
      <PolarAreaChart labels={['Skills', 'Memory', 'Tools']} data={[32, 24, 12]} />
      <RadarChart
        labels={['Speed', 'Accuracy', 'Cost']}
        series={[{ label: 'Pi', data: [7, 8, 6] }]}
      />
    </main>
  )
}

// The spec reads chart instances back through Chart.js's own registry, and
// unmounts the tree to prove the theme observer is released with it.
const dispose = render(() => <Fixture />, document.body)
Object.assign(window, { chartFixture: { Chart, dispose } })
