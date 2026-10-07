import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../src/components/ui/command/command'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuTrigger,
} from '../../src/components/ui/context-menu/context-menu'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../src/components/ui/dropdown-menu/dropdown-menu'
import {
  Menubar,
  MenubarContent,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarTrigger,
} from '../../src/components/ui/menubar/menubar'
import { Tabs, TabsList, TabsTrigger } from '../../src/components/ui/tabs/tabs'
import { Toggle } from '../../src/components/ui/toggle/toggle'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

function Fixture() {
  const [checked, setChecked] = createSignal(true)
  const [density, setDensity] = createSignal('compact')
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
          <DropdownMenuRadioGroup value={density()} onChange={setDensity}>
            <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ContextMenu>
        <ContextMenuTrigger data-testid="context-target">Context target</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuRadioGroup value={density()} onChange={setDensity}>
            <ContextMenuRadioItem value="compact">Compact</ContextMenuRadioItem>
            <ContextMenuRadioItem value="comfortable">Comfortable</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
        </ContextMenuContent>
      </ContextMenu>

      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarRadioGroup value={density()} onChange={setDensity}>
              <MenubarRadioItem value="compact">Compact</MenubarRadioItem>
              <MenubarRadioItem value="comfortable">Comfortable</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </main>
  )
}

render(() => <Fixture />, document.body)
