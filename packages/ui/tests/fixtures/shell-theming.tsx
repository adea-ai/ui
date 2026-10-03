import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Sparkles } from 'lucide-solid'
import { SideRail, SideRailContent, SideRailItem } from '../../src/components/layout/side-rail'
import { SidebarNavSection } from '../../src/components/layout/sidebar-nav/sidebar-nav'
import { ThemePicker } from '../../src/components/theme/theme-picker'
import { ThemeProvider, useTheme } from '../../src/components/theme/theme-provider'
import { Badge } from '../../src/components/ui/badge/badge'
import { Button } from '../../src/components/ui/button/button'
import { themesForAppearance } from '../../src/lib/themes'
import '../../src/styles/globals.css'

/**
 * Shell and theming regressions, one fixture.
 *
 *   - ThemeProvider mounts and switches where reading `localStorage` throws.
 *   - ThemeProvider reads every stored axis back, density included, and keeps it
 *     through a change to another axis.
 *   - ThemePicker options are as tall as their content, carry no side padding, and
 *     keep a wrapped row's previews on one line.
 *   - SideRailItem's badge trails the label expanded and sits on the icon's corner
 *     collapsed.
 *   - Button-rendered rail rows and collapsible section headers start-align labels.
 */
function AppearanceProbe() {
  const theme = useTheme()
  return (
    <div>
      <output data-testid="appearance">{theme.selection().appearance}</output>
      <Button
        size="sm"
        variant="outline"
        onClick={() => theme.setSelection({ appearance: 'dark' })}
      >
        Use dark
      </Button>
    </div>
  )
}

function rail(collapsed: boolean) {
  return (
    <SideRail collapsed={collapsed} aria-label={collapsed ? 'Collapsed rail' : 'Expanded rail'}>
      <SideRailContent>
        <SideRailItem
          as="button"
          type="button"
          label="App library"
          data-testid={collapsed ? 'collapsed-row' : 'expanded-row'}
          badge={
            <Badge size="sm" variant="secondary">
              12
            </Badge>
          }
        >
          <Sparkles data-testid={collapsed ? 'collapsed-icon' : 'expanded-icon'} />
        </SideRailItem>
      </SideRailContent>
    </SideRail>
  )
}

function Fixture() {
  const themes = themesForAppearance('light')
  const [selected, setSelected] = createSignal(themes[0]!.id)

  return (
    <ThemeProvider storageKey="shell-theming-fixture">
      <main class="flex flex-col gap-6 p-4">
        <AppearanceProbe />
        <div class="w-240" data-testid="picker-host">
          <ThemePicker
            themes={themes}
            selectedId={selected()}
            onThemeSelect={(theme) => setSelected(theme.id)}
          />
        </div>
        <div class="flex h-80 gap-4">
          {rail(false)}
          {rail(true)}
        </div>
        <div class="w-64" data-testid="section-host">
          <SidebarNavSection label="Projects" collapsible>
            <span>Child</span>
          </SidebarNavSection>
        </div>
      </main>
    </ThemeProvider>
  )
}

render(() => <Fixture />, document.body)
