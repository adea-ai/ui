import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Every exported control primitive's root element carries a `data-slot`.
 *
 * A consumer's stylesheet and its contract checker address shared controls by
 * slot (`[data-slot='button']`). A slot the library never renders makes that rule
 * dead CSS and the checker's protection a no-op, and nothing fails — the button
 * simply is not the width the rule asked for. So the slot is part of each
 * control's public surface, and this table is that surface.
 *
 * The check reads the component's own source: the unit lane has no DOM, and the
 * slot is a literal on the root element, so its presence in the exported
 * function's body is the property worth holding.
 */
const root = resolve(import.meta.dirname, '../src/components')

const controls: { file: string; component: string; slot: string }[] = [
  { file: 'ui/button/button.tsx', component: 'Button', slot: 'button' },
  {
    file: 'composites/action-button/action-button.tsx',
    component: 'ActionButton',
    slot: 'action-button',
  },
  { file: 'ui/badge/badge.tsx', component: 'Badge', slot: 'badge' },
  { file: 'ui/status-chip/status-chip.tsx', component: 'StatusChip', slot: 'status-chip' },
  { file: 'ui/checkbox/checkbox.tsx', component: 'Checkbox', slot: 'checkbox' },
  { file: 'ui/switch/switch.tsx', component: 'Switch', slot: 'switch' },
  { file: 'ui/toggle/toggle.tsx', component: 'Toggle', slot: 'toggle' },
  { file: 'ui/toggle-group/toggle-group.tsx', component: 'ToggleGroup', slot: 'toggle-group' },
  {
    file: 'ui/toggle-group/toggle-group.tsx',
    component: 'ToggleGroupItem',
    slot: 'toggle-group-item',
  },
  { file: 'ui/tabs/tabs.tsx', component: 'Tabs', slot: 'tabs' },
  { file: 'ui/tabs/tabs.tsx', component: 'TabsList', slot: 'tabs-list' },
  { file: 'ui/tabs/tabs.tsx', component: 'TabsTrigger', slot: 'tabs-trigger' },
  { file: 'ui/tabs/tabs.tsx', component: 'TabsContent', slot: 'tabs-content' },
  { file: 'ui/radio-group/radio-group.tsx', component: 'RadioGroup', slot: 'radio-group' },
  {
    file: 'ui/radio-group/radio-group.tsx',
    component: 'RadioGroupItem',
    slot: 'radio-group-item',
  },
  { file: 'ui/select/select.tsx', component: 'SelectTrigger', slot: 'select-trigger' },
  { file: 'ui/entity-icon/entity-icon.tsx', component: 'EntityIcon', slot: 'entity-icon' },
  {
    file: 'composites/list-row/list-row-control.tsx',
    component: 'ListRowControl',
    slot: 'list-row',
  },
  { file: 'ui/slider/slider.tsx', component: 'Slider', slot: 'slider' },
  { file: 'ui/progress/progress.tsx', component: 'Progress', slot: 'progress' },
  // Already slotted before this table existed; listed so a refactor cannot drop them.
  { file: 'ui/input/input-control.tsx', component: 'InputControl', slot: 'input' },
  { file: 'ui/textarea/textarea.tsx', component: 'Textarea', slot: 'textarea' },
  { file: 'ui/native-select/native-select.tsx', component: 'NativeSelect', slot: 'native-select' },
  { file: 'ui/input-group/input-group.tsx', component: 'InputGroup', slot: 'input-group' },
  { file: 'ui/spinner/spinner.tsx', component: 'Spinner', slot: 'spinner' },
  { file: 'ui/kbd/kbd.tsx', component: 'Kbd', slot: 'kbd' },
  { file: 'ui/table/table.tsx', component: 'Table', slot: 'table' },
  { file: 'ui/text-link/text-link.tsx', component: 'TextLink', slot: 'textlink' },
  { file: 'layout/app-shell/skip-link.tsx', component: 'SkipLink', slot: 'skip-link' },
  { file: 'ui/card/card.tsx', component: 'Card', slot: 'card' },
  { file: 'ui/alert/alert.tsx', component: 'Alert', slot: 'alert' },
]

/** The source of one exported function, up to the next top-level export. */
function exportedBody(source: string, name: string): string | undefined {
  const start = source.search(new RegExp(`^export function ${name}\\b`, 'm'))
  if (start < 0) return undefined
  const next = source.slice(start + 1).search(/^export /m)
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next)
}

describe('control slots', () => {
  for (const control of controls) {
    test(`${control.component} renders data-slot="${control.slot}"`, () => {
      const source = readFileSync(resolve(root, control.file), 'utf8')
      const body = exportedBody(source, control.component)
      expect(body, `${control.component} is not exported from ${control.file}`).toBeDefined()
      // A JSX attribute, or (ActionButton) the default of a forwarded prop.
      const slot = new RegExp(`data-slot(?:="|': [^\\n]*')${control.slot}['"]`)
      expect(body!, `${control.component} has no data-slot="${control.slot}"`).toMatch(slot)
    })
  }

  test('every slot in the table is unique', () => {
    const slots = controls.map((control) => control.slot)
    expect(new Set(slots).size).toBe(slots.length)
  })
})
