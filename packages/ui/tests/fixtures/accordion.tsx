import { render } from 'solid-js/web'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../src/components/ui/accordion/accordion'
import '../../src/styles/globals.css'

render(
  () => (
    <main class="w-lg p-2">
      <Accordion collapsible defaultValue={['open']}>
        <AccordionItem value="open">
          <AccordionTrigger>Open on mount</AccordionTrigger>
          <AccordionContent>Visible without a click.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="closed">
          <AccordionTrigger>Closed on mount</AccordionTrigger>
          <AccordionContent>Revealed by the trigger.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </main>
  ),
  document.body
)
