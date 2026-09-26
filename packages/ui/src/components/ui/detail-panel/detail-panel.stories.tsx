import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button'
import { Badge } from '../badge'
import {
  DetailPanel,
  DetailPanelBody,
  DetailPanelField,
  DetailPanelHeader,
  DetailPanelSection,
} from './detail-panel'

const meta = {
  title: 'UI/Detail Panel',
  component: DetailPanel,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The companion surface to a list: something is selected over there, and its detail is here. An `<aside>` with a label rather than a div with a heading, because a detail panel is a second region — a screen reader user has to be able to name it and jump to it. The header is sticky so the close affordance cannot scroll away.',
      },
    },
  },
  decorators: [
    () => (
      <div class="h-80 w-80 border border-border">
        <DetailPanel label="Example artifact">
          <DetailPanelHeader
            eyebrow="Artifact"
            title="build-report.json"
            onDismiss={() => undefined}
          />
          <DetailPanelBody>
            <DetailPanelSection title="File">
              <DetailPanelField name="Media type" value="application/json" />
              <DetailPanelField name="Size" value="4,182 bytes" />
              <DetailPanelField name="Availability" value="On device" />
            </DetailPanelSection>
          </DetailPanelBody>
        </DetailPanel>
      </div>
    ),
  ],
} satisfies Meta<typeof DetailPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { label: 'Example artifact' } }

/** Trailing controls sit before the close button, which stays last. */
export const WithActions: Story = {
  args: { label: 'Example task' },
  render: () => (
    <div class="h-80 w-80 border border-border">
      <DetailPanel label="Task details">
        <DetailPanelHeader
          eyebrow="Task"
          title="Ship the appearance view"
          actions={
            <Button variant="outline" size="xs">
              Open
            </Button>
          }
          onDismiss={() => undefined}
        />
        <DetailPanelBody class="grid gap-4">
          <DetailPanelSection title="State">
            <DetailPanelField name="Lifecycle" value="In progress" />
            <DetailPanelField
              name="Priority"
              value={
                <Badge variant="warning" size="sm">
                  High
                </Badge>
              }
            />
          </DetailPanelSection>
          <DetailPanelSection title="Assignment">
            <DetailPanelField name="Agent" value="release-agent" />
            {/* A facet with no value reads as absent, not as a value of "—". */}
            <DetailPanelField name="Room" muted value="—" />
          </DetailPanelSection>
        </DetailPanelBody>
      </DetailPanel>
    </div>
  ),
}

/** No dismiss control — for a panel that is a permanent column rather than an overlay. */
export const Persistent: Story = {
  args: { label: 'Persistent panel' },
  render: () => (
    <div class="h-64 w-80 border border-border">
      <DetailPanel label="Persistent panel">
        <DetailPanelHeader eyebrow="Inspector" title="Always here" />
        <DetailPanelBody>
          <DetailPanelSection title="Notes">
            <DetailPanelField name="Dismiss" value="Never" />
          </DetailPanelSection>
        </DetailPanelBody>
      </DetailPanel>
    </div>
  ),
}

/** A long body, to show the header staying put while the content scrolls. */
export const ScrollingBody: Story = {
  args: { label: 'Long panel' },
  render: () => (
    <div class="h-64 w-80 border border-border">
      <DetailPanel label="Long panel">
        <DetailPanelHeader eyebrow="Log" title="Build output" onDismiss={() => undefined} />
        <DetailPanelBody>
          <DetailPanelSection title="Entries">
            {Array.from({ length: 24 }, (_, index) => (
              <DetailPanelField name={`Step ${index + 1}`} value="ok" />
            ))}
          </DetailPanelSection>
        </DetailPanelBody>
      </DetailPanel>
    </div>
  ),
}
