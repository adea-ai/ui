import { render } from 'solid-js/web'
import {
  Command,
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
import { builtinThemes, themeCssVariables } from '../../src/lib/themes'
import '../../src/styles/globals.css'

const nord =
  builtinThemes.find((theme) => theme.id === 'nord') ??
  (() => {
    throw new Error('The Nord catalogue theme is missing')
  })()

function Fixture() {
  return (
    <main
      data-theme-id={nord.id}
      ref={(element) => {
        for (const [name, value] of Object.entries(themeCssVariables(nord))) {
          element.style.setProperty(name, value)
        }
      }}
    >
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
            Utilities
          </SideRailButton>
        </SideRailContent>
      </SideRail>
      <StatusChip tone="success" label="Source healthy" compact />
    </main>
  )
}

render(() => <Fixture />, document.body)
