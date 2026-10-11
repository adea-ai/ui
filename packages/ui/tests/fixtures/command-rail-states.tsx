import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../../src/components/ui/command/command'
import {
  SideRail,
  SideRailButton,
  SideRailContent,
} from '../../src/components/layout/side-rail/side-rail'
import { StatusChip } from '../../src/components/ui/status-chip/status-chip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../src/components/ui/dropdown-menu/dropdown-menu'
import { builtinThemes, themeCssVariables } from '../../src/lib/themes'
import { Settings } from 'lucide-solid'
import '../../src/styles/globals.css'

const nord =
  builtinThemes.find((theme) => theme.id === 'nord') ??
  (() => {
    throw new Error('The Nord catalogue theme is missing')
  })()

function Fixture() {
  const [dialogOpen, setDialogOpen] = createSignal(false)
  const [defaultDialogOpen, setDefaultDialogOpen] = createSignal(false)
  const [menuSelection, setMenuSelection] = createSignal('')
  const [commandDialogOpener, setCommandDialogOpener] = createSignal<HTMLButtonElement>()

  return (
    <main
      data-theme-id={nord.id}
      ref={(element) => {
        for (const [name, value] of Object.entries(themeCssVariables(nord))) {
          element.style.setProperty(name, value)
        }
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Open accessible menu">Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setMenuSelection('First action')}>
            First action
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMenuSelection('Second action')}>
            Second action
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div class="h-32 w-72 overflow-y-auto" data-testid="vertical-dropdown-scroll-area">
        <div class="h-48" />
        <DropdownMenu orientation="vertical">
          <DropdownMenuTrigger aria-label="Open vertical menu">
            Open vertical menu
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Vertical first action</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <output aria-label="Menu selection">{menuSelection()}</output>
      <button ref={setCommandDialogOpener} type="button" onClick={() => setDialogOpen(true)}>
        Open command dialog with custom focus
      </button>
      <CommandDialog
        open={dialogOpen()}
        onOpenChange={setDialogOpen}
        onCloseAutoFocus={(event: Event) => {
          event.preventDefault()
          commandDialogOpener()?.focus()
        }}
        label="Custom command dialog focus test"
      >
        <CommandInput aria-label="Dialog command search" />
        <CommandList>
          <CommandItem value="open-settings">Open settings</CommandItem>
        </CommandList>
      </CommandDialog>
      <button type="button" onClick={() => setDefaultDialogOpen(true)}>
        Open command dialog with default focus
      </button>
      <CommandDialog
        open={defaultDialogOpen()}
        onOpenChange={setDefaultDialogOpen}
        label="Default command dialog focus test"
      >
        <CommandInput aria-label="Default dialog command search" />
        <CommandList>
          <CommandItem value="open-settings">Open settings</CommandItem>
        </CommandList>
      </CommandDialog>
      <Command>
        <CommandInput aria-label="Filter commands" />
        <CommandList>
          <CommandItem value="open-settings">
            Open settings
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
          <CommandItem value="switch-project">Switch project</CommandItem>
          <CommandItem value="restricted-action" disabled>
            Restricted action
          </CommandItem>
        </CommandList>
      </Command>
      <SideRail>
        <SideRailContent>
          <SideRailButton label="Utilities" active>
            <Settings />
          </SideRailButton>
        </SideRailContent>
      </SideRail>
      <StatusChip tone="success" label="Source healthy" compact />
    </main>
  )
}

render(() => <Fixture />, document.body)
