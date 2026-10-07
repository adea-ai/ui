import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../src/components/ui/command/command'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../src/components/ui/dropdown-menu/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '../../src/components/ui/tabs/tabs'
import { Toggle } from '../../src/components/ui/toggle/toggle'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

function Fixture() {
  const [checked, setChecked] = createSignal(true)
  return (
    <main>
      <Command data-testid="palette">
        <CommandInput placeholder="Filter" />
        <CommandList>
          <CommandItem value="plain">Plain item</CommandItem>
          <CommandItem value="selected">Accent item</CommandItem>
        </CommandList>
      </Command>

      <Toggle data-testid="pressed-toggle" pressed aria-label="Bold">
        B
      </Toggle>
      <Toggle data-testid="idle-toggle" aria-label="Italic">
        I
      </Toggle>

      <Tabs value="second">
        <TabsList appearance="segmented">
          <TabsTrigger value="first" appearance="segmented">
            First
          </TabsTrigger>
          <TabsTrigger value="second" appearance="segmented">
            Second
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <DropdownMenu>
        <DropdownMenuTrigger as={Button}>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={checked()} onChange={setChecked}>
            Visible layers
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </main>
  )
}

render(() => <Fixture />, document.body)
