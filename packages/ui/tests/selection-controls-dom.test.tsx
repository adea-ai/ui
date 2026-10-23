import { createSignal } from 'solid-js'
import { describe, expect, test } from 'bun:test'

import {
  Checkbox,
  CheckboxDescription,
  CheckboxLabel,
} from '../src/components/ui/checkbox/checkbox'
import { RadioGroup, RadioGroupItem } from '../src/components/ui/radio-group/radio-group'
import { Toggle } from '../src/components/ui/toggle/toggle'
import { ToggleGroup, ToggleGroupItem } from '../src/components/ui/toggle-group/toggle-group'
import { FormFieldContext, createFormFieldContext } from '../src/lib/form-field'
import { useDom } from './helpers/dom'

const dom = useDom()

const slot = (root: HTMLElement, name: string) => root.querySelector(`[data-slot="${name}"]`)!
const slotAt = (root: HTMLElement, name: string, index: number) => {
  const element = root.querySelectorAll(`[data-slot="${name}"]`)[index]
  if (!element) throw new Error(`no ${name} at ${index}`)
  return element as HTMLElement
}

describe('Toggle', () => {
  test('reports its pressed state to the page and to onChange when clicked', () => {
    const changes: boolean[] = []
    const toggle = slot(
      dom.mount(() => (
        <Toggle aria-label="Bold" onChange={(pressed) => changes.push(pressed)}>
          B
        </Toggle>
      )),
      'toggle'
    ) as HTMLButtonElement
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    toggle.click()
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.hasAttribute('data-pressed')).toBe(true)
    toggle.click()
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(changes).toEqual([true, false])
  })

  test('applies variant and size classes', () => {
    const toggle = slot(
      dom.mount(() => (
        <Toggle variant="outline" size="icon-sm" aria-label="Italic">
          I
        </Toggle>
      )),
      'toggle'
    )
    expect(toggle.classList.contains('border')).toBe(true)
    expect(toggle.classList.contains('size-control-sm')).toBe(true)
  })

  test('a disabled toggle ignores clicks', () => {
    const changes: boolean[] = []
    const toggle = slot(
      dom.mount(() => (
        <Toggle disabled aria-label="Underline" onChange={(pressed) => changes.push(pressed)}>
          U
        </Toggle>
      )),
      'toggle'
    ) as HTMLButtonElement
    toggle.click()
    expect(changes).toEqual([])
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('ToggleGroup', () => {
  test('single selection moves to the clicked item and reports the value', () => {
    const [value, setValue] = createSignal<string | null>('left')
    const root = dom.mount(() => (
      <ToggleGroup value={value()} onChange={setValue} aria-label="Align">
        <ToggleGroupItem value="left">L</ToggleGroupItem>
        <ToggleGroupItem value="right" variant="outline" size="sm">
          R
        </ToggleGroupItem>
      </ToggleGroup>
    ))
    const left = slotAt(root, 'toggle-group-item', 0)
    const right = slotAt(root, 'toggle-group-item', 1)
    expect(left.getAttribute('aria-pressed')).toBe('true')
    expect(right.getAttribute('aria-pressed')).toBe('false')
    right.click()
    expect(value()).toBe('right')
    expect(left.getAttribute('aria-pressed')).toBe('false')
    expect(right.getAttribute('aria-pressed')).toBe('true')
    expect(right.classList.contains('border')).toBe(true)
  })

  test('multiple selection keeps several items pressed', () => {
    const [value, setValue] = createSignal<string[]>([])
    const root = dom.mount(() => (
      <ToggleGroup multiple value={value()} onChange={setValue} aria-label="Format">
        <ToggleGroupItem value="bold">B</ToggleGroupItem>
        <ToggleGroupItem value="italic">I</ToggleGroupItem>
      </ToggleGroup>
    ))
    const bold = slotAt(root, 'toggle-group-item', 0)
    const italic = slotAt(root, 'toggle-group-item', 1)
    bold.click()
    italic.click()
    expect(value().toSorted()).toEqual(['bold', 'italic'])
  })

  test('attached groups square the inner edges instead of spacing the items', () => {
    const attached = slot(
      dom.mount(() => (
        <ToggleGroup attached aria-label="Attached">
          <ToggleGroupItem value="a">A</ToggleGroupItem>
        </ToggleGroup>
      )),
      'toggle-group'
    )
    const spaced = slot(
      dom.mount(() => (
        <ToggleGroup aria-label="Spaced">
          <ToggleGroupItem value="a">A</ToggleGroupItem>
        </ToggleGroup>
      )),
      'toggle-group'
    )
    expect(attached.className).toContain('rounded-e-none')
    expect(attached.classList.contains('gap-1')).toBe(false)
    expect(spaced.classList.contains('gap-1')).toBe(true)
  })

  test('Escape on an item stops there instead of bubbling to an enclosing key handler, and the caller handler still runs', () => {
    const seen: string[] = []
    const root = dom.mount(() => (
      <div onKeyDown={(event) => seen.push(`outer:${event.key}`)}>
        <ToggleGroup aria-label="Escape">
          <ToggleGroupItem
            value="a"
            onKeyDown={(event: KeyboardEvent) => seen.push(`item:${event.key}`)}
          >
            A
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    ))
    const item = slot(root, 'toggle-group-item')
    const press = (key: string) =>
      item.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }) as never)
    press('Escape')
    expect(seen).toEqual(['item:Escape'])
    press('a')
    expect(seen).toEqual(['item:Escape', 'item:a', 'outer:a'])
  })

  test('the caller handler also receives a bound [handler, data] tuple', () => {
    const calls: Array<[string, string]> = []
    const root = dom.mount(() => (
      <ToggleGroup aria-label="Tuple">
        <ToggleGroupItem
          value="a"
          onKeyDown={
            [
              (data: string, event: KeyboardEvent) => calls.push([data, event.key]),
              'bound',
            ] as never
          }
        >
          A
        </ToggleGroupItem>
      </ToggleGroup>
    ))
    slot(root, 'toggle-group-item').dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'x', bubbles: true }) as never
    )
    expect(calls).toEqual([['bound', 'x']])
  })
})

const glyph = (root: HTMLElement) => root.querySelector('svg')?.getAttribute('class') ?? ''

describe('Checkbox', () => {
  test('toggles through its input and reports the checked state', () => {
    const changes: boolean[] = []
    const root = dom.mount(() => (
      <Checkbox label="Remember me" onChange={(checked: boolean) => changes.push(checked)} />
    ))
    const input = root.querySelector('input[type="checkbox"]') as HTMLInputElement
    const checkbox = slot(root, 'checkbox')
    expect(checkbox.hasAttribute('data-checked')).toBe(false)
    input.click()
    expect(changes).toEqual([true])
    expect(checkbox.hasAttribute('data-checked')).toBe(true)
    input.click()
    expect(changes).toEqual([true, false])
  })

  test('renders its label and description from props, connected to the input', () => {
    const root = dom.mount(() => <Checkbox label="Notify me" description="Only about replies" />)
    expect(root.textContent).toContain('Notify me')
    expect(root.textContent).toContain('Only about replies')
    const input = root.querySelector('input')!
    const labelledBy = input.getAttribute('aria-labelledby') ?? ''
    expect(labelledBy.length).toBeGreaterThan(0)
    expect(root.querySelector(`#${labelledBy.split(' ')[0]}`)?.textContent).toBe('Notify me')
    expect(input.getAttribute('aria-describedby')).toBeTruthy()
  })

  test('draws no text block without a label or description', () => {
    const root = dom.mount(() => <Checkbox aria-label="Bare" />)
    expect(root.querySelector('.grid')).toBeNull()
  })

  test('children replace the label block, and the label and description parts style themselves', () => {
    const root = dom.mount(() => (
      <Checkbox label="ignored">
        <CheckboxLabel class="uppercase">Custom</CheckboxLabel>
        <CheckboxDescription class="italic">Hint</CheckboxDescription>
      </Checkbox>
    ))
    expect(root.textContent).not.toContain('ignored')
    expect(root.querySelector('.uppercase')?.classList.contains('font-medium')).toBe(true)
    expect(root.querySelector('.italic')?.classList.contains('text-sm')).toBe(true)
  })

  test('indeterminate swaps the check glyph for a minus', () => {
    const checked = dom.mount(() => <Checkbox defaultChecked aria-label="One" />)
    const mixed = dom.mount(() => <Checkbox defaultChecked indeterminate aria-label="Two" />)
    expect(glyph(checked)).toContain('lucide-check')
    expect(glyph(mixed)).toContain('lucide-minus')
  })

  test('passes accessibility attributes to the input when it is not in a field', () => {
    const root = dom.mount(() => (
      <Checkbox
        inputId="terms"
        aria-label="Accept"
        aria-describedby="terms-hint"
        aria-invalid="true"
        aria-busy="true"
        title="Terms"
      />
    ))
    const input = root.querySelector('input')!
    expect(input.id).toBe('terms')
    expect(input.getAttribute('aria-label')).toBe('Accept')
    expect(input.getAttribute('aria-describedby')).toBe('terms-hint')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-busy')).toBe('true')
    expect(input.getAttribute('title')).toBe('Terms')
  })

  test('takes the input id and error wiring from an enclosing form field', () => {
    const field = createFormFieldContext({
      defaultControlId: 'field-control',
      labelId: 'field-label',
      errorId: 'field-error',
      hint: () => undefined,
      error: () => 'Required',
      group: () => false,
    })
    const root = dom.mount(() => (
      <FormFieldContext.Provider value={field}>
        <Checkbox />
      </FormFieldContext.Provider>
    ))
    const input = root.querySelector('input')!
    expect(input.id).toBe('field-control')
    expect(input.getAttribute('aria-labelledby')).toBe('field-label')
    expect(input.getAttribute('aria-describedby')).toBe('field-error')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })
})

describe('RadioGroup', () => {
  test('selecting an item reports its value and checks exactly one radio', () => {
    const [value, setValue] = createSignal('a')
    const root = dom.mount(() => (
      <RadioGroup value={value()} onChange={setValue} aria-label="Pick one">
        <RadioGroupItem value="a" label="Alpha" description="First" />
        <RadioGroupItem value="b" label="Beta" />
      </RadioGroup>
    ))
    const group = slot(root, 'radio-group')
    expect(group.getAttribute('role')).toBe('radiogroup')
    expect(group.getAttribute('aria-label')).toBe('Pick one')
    const inputs = [...root.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    expect(inputs.map((input) => input.checked)).toEqual([true, false])
    inputs[1]!.click()
    expect(value()).toBe('b')
    expect(inputs.map((input) => input.checked)).toEqual([false, true])
    expect(root.textContent).toContain('First')
  })

  test('the card variant marks itself, draws media, and stretches the label over the card', () => {
    const root = dom.mount(() => (
      <RadioGroup defaultValue="a" aria-label="Cards">
        <RadioGroupItem
          value="a"
          label="Card"
          variant="card"
          media={<i data-testid="media" />}
          title="Choose a card"
          aria-busy="true"
        />
        <RadioGroupItem value="b">Custom children</RadioGroupItem>
      </RadioGroup>
    ))
    const card = slotAt(root, 'radio-group-item', 0)
    const plain = slotAt(root, 'radio-group-item', 1)
    expect(card.getAttribute('data-variant')).toBe('card')
    expect(card.classList.contains('items-center')).toBe(true)
    expect(
      slot(root, 'radio-group-item-media').querySelector('[data-testid="media"]')
    ).not.toBeNull()
    expect(card.querySelector('label')?.classList.contains('after:absolute')).toBe(true)
    expect(card.querySelector('input')?.getAttribute('aria-busy')).toBe('true')
    expect(plain.hasAttribute('data-variant')).toBe(false)
    expect(plain.classList.contains('items-start')).toBe(true)
    expect(plain.textContent).toContain('Custom children')
  })

  test('a group in a form field is labelled by the field and flagged invalid with it', () => {
    const field = createFormFieldContext({
      defaultControlId: 'field-control',
      labelId: 'field-label',
      errorId: 'field-error',
      hint: () => undefined,
      error: () => 'Pick one',
      group: () => true,
    })
    const root = dom.mount(() => (
      <FormFieldContext.Provider value={field}>
        <RadioGroup>
          <RadioGroupItem value="a" label="A" />
        </RadioGroup>
      </FormFieldContext.Provider>
    ))
    const group = slot(root, 'radio-group')
    expect(group.getAttribute('aria-describedby')).toBe('field-error')
    expect(group.getAttribute('aria-invalid')).toBe('true')
  })
})
