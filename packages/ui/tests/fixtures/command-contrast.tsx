import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { themeById, themeCssVariables } from '../../src/lib/themes'
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../../src/components/ui/command/command'
import '../../src/styles/globals.css'

document.documentElement.classList.add('dark')
for (const [name, value] of Object.entries(themeCssVariables(themeById('nord')!))) {
  document.documentElement.style.setProperty(name, value)
}
function Fixture() {
  const [selected, setSelected] = createSignal('')
  return (
    <main>
      <Command label="Synthetic commands">
        <CommandInput />
        <CommandList>
          <CommandItem value="search" onSelect={() => setSelected('search')}>
            Search<CommandShortcut>Ctrl K</CommandShortcut>
          </CommandItem>
          <CommandItem value="settings" onSelect={() => setSelected('settings')}>
            Settings<CommandShortcut>Ctrl ,</CommandShortcut>
          </CommandItem>
          <CommandItem value="unavailable" disabled onSelect={() => setSelected('unavailable')}>
            Unavailable
          </CommandItem>
        </CommandList>
      </Command>
      <output aria-label="Selected command">{selected()}</output>
    </main>
  )
}
render(() => <Fixture />, document.body)
