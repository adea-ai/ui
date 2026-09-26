import { For } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

const sizes = [
  { name: '2xs', icon: 'icon-2xs' },
  { name: 'xs', icon: 'icon-xs' },
  { name: 'sm', icon: 'icon-sm' },
  { name: 'md', icon: 'icon-md' },
  { name: 'lg', icon: 'icon-lg' },
  { name: 'xl', icon: 'icon-xl' },
] as const
render(
  () => (
    <main>
      <For each={sizes}>
        {(size) => (
          <div class="flex gap-2">
            <Button size={size.name} data-control={size.name}>
              Named control
            </Button>
            <Button size={size.icon} data-icon={size.name} aria-label={`${size.name} icon`}>
              +
            </Button>
          </div>
        )}
      </For>
    </main>
  ),
  document.body
)
