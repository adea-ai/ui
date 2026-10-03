import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../src/components/ui/dropdown-menu/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../src/components/ui/select/select'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../src/components/ui/sheet/sheet'
import '../../src/styles/globals.css'

const priorities = ['Urgent', 'High', 'Normal', 'Low']

function Fixture() {
  const [priority, setPriority] = createSignal('Normal')
  const [kind, setKind] = createSignal('Feature')
  return (
    <main>
      <Sheet>
        <SheetTrigger as={Button}>Edit task</SheetTrigger>
        <SheetContent side="end" closeLabel="Close task">
          <SheetHeader>
            <SheetTitle>Edit task</SheetTitle>
            <SheetDescription>Changes apply when you save.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <Select
              options={priorities}
              value={priority()}
              onChange={(next) => next && setPriority(next)}
              itemComponent={(props) => (
                <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
              )}
            >
              <SelectTrigger aria-label="Priority">
                <SelectValue optionLabel={(option) => String(option)} />
              </SelectTrigger>
              <SelectContent />
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger as={Button} variant="outline">
                Type: {kind()}
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setKind('Bug')}>Bug</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setKind('Chore')}>Chore</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SheetBody>
          <SheetFooter>
            <Button size="sm">Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </main>
  )
}
render(() => <Fixture />, document.body)
