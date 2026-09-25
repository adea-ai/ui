import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion'

/**
 * Accordion.
 *
 * A list of collapsible sections. `collapsible` (the default) lets the user close
 * the open section; without it one section is always open, which is what a settings
 * page usually wants and a FAQ usually does not.
 *
 * Kobalte wires `aria-expanded` on the trigger and `aria-labelledby` on the panel,
 * so the relationship survives even when the panel is empty — which is the failure
 * mode of an accordion built from a `div` and a `useState`.
 */
const meta = {
  title: 'Primitives/Navigation/Accordion',
  component: Accordion,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Accordion>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Accordion class="w-[32rem]" collapsible defaultValue={['environment']}>
      <AccordionItem value="environment">
        <AccordionTrigger>Environment</AccordionTrigger>
        <AccordionContent>Paths, overrides and the shell used for new terminals.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="updates">
        <AccordionTrigger>Updates</AccordionTrigger>
        <AccordionContent>The release channel and whether to install while idle.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="telemetry">
        <AccordionTrigger>Telemetry</AccordionTrigger>
        <AccordionContent>
          Anonymous counters for startup time and lane budget verdicts.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

/** A single section open at a time, which is the FAQ shape. */
export const SingleOpen: Story = {
  render: () => (
    <Accordion class="w-[32rem]" collapsible={false} defaultValue={['one']}>
      <AccordionItem value="one">
        <AccordionTrigger>Why is the interface 14px?</AccordionTrigger>
        <AccordionContent>
          Density. This is a desktop tool used for hours at a time, and 16px costs roughly a sixth
          of the rows on screen.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="two">
        <AccordionTrigger>Why not Radix or Base UI?</AccordionTrigger>
        <AccordionContent>
          This is a Solid codebase; both are React-only. Kobalte and corvu are the maintained Solid
          equivalents.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}
