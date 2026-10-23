import { describe, expect, test } from 'bun:test'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '../src/components/ui/alert/alert'
import { Badge } from '../src/components/ui/badge/badge'
import { Button } from '../src/components/ui/button/button'
import { Callout, CalloutTitle } from '../src/components/ui/callout/callout'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../src/components/ui/card/card'
import { InputControl } from '../src/components/ui/input/input-control'
import { Kbd, KbdChord, KbdGroup } from '../src/components/ui/kbd/kbd'
import { Spinner } from '../src/components/ui/spinner/spinner'
import { Textarea } from '../src/components/ui/textarea/textarea'
import { FormFieldContext, createFormFieldContext } from '../src/lib/form-field'
import { useDom } from './helpers/dom'

const dom = useDom()

const slot = (root: HTMLElement, name: string) => root.querySelector(`[data-slot="${name}"]`)!

describe('Badge', () => {
  test('renders a span carrying its variant and size classes, and merges a caller class', () => {
    const root = dom.mount(() => (
      <Badge variant="notification" size="sm" class="uppercase">
        3
      </Badge>
    ))
    const badge = slot(root, 'badge')
    expect(badge.tagName).toBe('SPAN')
    expect(badge.textContent).toBe('3')
    expect(badge.classList.contains('bg-destructive-action')).toBe(true)
    expect(badge.classList.contains('h-4')).toBe(true)
    expect(badge.classList.contains('uppercase')).toBe(true)
  })

  test('falls back to the default variant at medium size', () => {
    const badge = slot(
      dom.mount(() => <Badge>Beta</Badge>),
      'badge'
    )
    expect(badge.classList.contains('bg-primary')).toBe(true)
    expect(badge.classList.contains('h-5')).toBe(true)
  })

  test('becomes another element when polymorphic, keeping the styling contract', () => {
    const badge = slot(
      dom.mount(() => <Badge as="div">Label</Badge>),
      'badge'
    )
    expect(badge.tagName).toBe('DIV')
    expect(badge.classList.contains('bg-primary')).toBe(true)
  })
})

describe('Button', () => {
  test('is a non-submitting button by default, so it never submits an enclosing form', () => {
    const button = slot(
      dom.mount(() => <Button>Save</Button>),
      'button'
    )
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.textContent).toBe('Save')
  })

  test('applies variant, size and touch-target classes and fires its click handler', () => {
    let clicks = 0
    const button = slot(
      dom.mount(() => (
        <Button
          variant="destructive"
          size="icon-sm"
          touchTarget="comfortable"
          aria-label="Delete"
          onClick={() => (clicks += 1)}
        />
      )),
      'button'
    ) as HTMLButtonElement
    expect(button.classList.contains('bg-destructive-action')).toBe(true)
    expect(button.classList.contains('size-control-sm')).toBe(true)
    expect(button.classList.contains('touch-target-comfortable')).toBe(true)
    expect(button.getAttribute('aria-label')).toBe('Delete')
    button.click()
    button.click()
    expect(clicks).toBe(2)
  })

  test('renders as a link when polymorphic, keeping the button styling', () => {
    const link = slot(
      dom.mount(() => (
        <Button as="a" href="/docs" variant="link">
          Docs
        </Button>
      )),
      'button'
    )
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/docs')
    expect(link.classList.contains('text-primary')).toBe(true)
  })
})

describe('Card', () => {
  test('composes its slots in order with each slot name exposed for styling', () => {
    const root = dom.mount(() => (
      <Card size="sm" class="opacity-90">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
          <CardAction>Act</CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Foot</CardFooter>
      </Card>
    ))
    const card = slot(root, 'card')
    expect([...card.children].map((child) => child.getAttribute('data-slot'))).toEqual([
      'card-header',
      'card-content',
      'card-footer',
    ])
    expect(
      [...slot(root, 'card-header').children].map((child) => child.getAttribute('data-slot'))
    ).toEqual(['card-title', 'card-description', 'card-action'])
    expect(card.classList.contains('gap-3')).toBe(true)
    expect(card.classList.contains('opacity-90')).toBe(true)
    expect(slot(root, 'card-content').textContent).toBe('Body')
    expect(slot(root, 'card-footer').classList.contains('flex')).toBe(true)
  })

  test('flush size removes the card padding', () => {
    const card = slot(
      dom.mount(() => <Card size="flush" />),
      'card'
    )
    expect(card.classList.contains('py-0')).toBe(true)
    expect(card.classList.contains('gap-0')).toBe(true)
  })
})

describe('Alert', () => {
  test('announces itself as an alert and draws the icon for its tone', () => {
    const root = dom.mount(() => (
      <Alert variant="destructive">
        <AlertTitle>Failed</AlertTitle>
        <AlertDescription>Could not save.</AlertDescription>
        <AlertAction>Retry</AlertAction>
      </Alert>
    ))
    const alert = slot(root, 'alert')
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.classList.contains('bg-destructive-subtle')).toBe(true)
    const icon = slot(root, 'alert-icon')
    expect(icon.classList.contains('text-destructive')).toBe(true)
    expect(icon.querySelector('svg')).not.toBeNull()
    expect(slot(root, 'alert-title').textContent).toBe('Failed')
    expect(slot(root, 'alert-description').textContent).toBe('Could not save.')
    expect(slot(root, 'alert-action').textContent).toBe('Retry')
  })

  test('uses the default tone without a variant and takes a custom icon', () => {
    const root = dom.mount(() => <Alert icon={<i data-testid="mine" />}>Hello</Alert>)
    expect(slot(root, 'alert-icon').classList.contains('text-muted-foreground')).toBe(true)
    expect(root.querySelector('[data-testid="mine"]')).not.toBeNull()
    expect(slot(root, 'alert-icon').querySelector('svg')).toBeNull()
  })

  test('draws no icon slot when the icon is null', () => {
    const root = dom.mount(() => <Alert icon={null}>Plain</Alert>)
    expect(root.querySelector('[data-slot="alert-icon"]')).toBeNull()
  })
})

describe('Callout', () => {
  test('is a note region carrying its tone and size', () => {
    const callout = slot(
      dom.mount(() => (
        <Callout variant="warning" size="lg">
          <CalloutTitle>Heads up</CalloutTitle>
          <p>Detail</p>
        </Callout>
      )),
      'callout'
    )
    expect(callout.getAttribute('role')).toBe('note')
    expect(callout.classList.contains('border-s-warning')).toBe(true)
    expect(callout.classList.contains('px-6')).toBe(true)
    expect(callout.hasAttribute('data-title-only')).toBe(false)
  })

  test('marks a title that stands alone, ignoring whitespace-only siblings', () => {
    const callout = slot(
      dom.mount(() => (
        <Callout>
          <CalloutTitle>Only a title</CalloutTitle>
          {'   '}
          {false}
        </Callout>
      )),
      'callout'
    )
    expect(callout.hasAttribute('data-title-only')).toBe(true)
  })

  test('does not mark a callout whose only child is not a title', () => {
    const callout = slot(
      dom.mount(() => (
        <Callout>
          <p>Just text</p>
        </Callout>
      )),
      'callout'
    )
    expect(callout.hasAttribute('data-title-only')).toBe(false)
  })
})

describe('Spinner', () => {
  test('is a labelled status with a visually hidden text twin', () => {
    const root = dom.mount(() => <Spinner size="lg" />)
    const spinner = slot(root, 'spinner')
    expect(spinner.getAttribute('role')).toBe('status')
    expect(spinner.getAttribute('aria-label')).toBe('Loading')
    expect(spinner.classList.contains('size-5')).toBe(true)
    expect(root.querySelector('.visually-hidden')?.textContent).toBe('Loading')
  })

  test('takes a custom label', () => {
    const root = dom.mount(() => <Spinner label="Saving" />)
    expect(slot(root, 'spinner').getAttribute('aria-label')).toBe('Saving')
    expect(root.querySelector('.visually-hidden')?.textContent).toBe('Saving')
  })

  test('hides from assistive tech entirely when the label is false', () => {
    const root = dom.mount(() => <Spinner label={false} />)
    const spinner = slot(root, 'spinner')
    expect(spinner.hasAttribute('aria-label')).toBe(false)
    expect(spinner.getAttribute('aria-hidden')).toBe('true')
    expect(root.querySelector('.visually-hidden')).toBeNull()
  })
})

describe('Kbd', () => {
  test('renders a kbd element and a group at the compact size', () => {
    const root = dom.mount(() => (
      <KbdGroup size="compact">
        <Kbd size="compact">K</Kbd>
      </KbdGroup>
    ))
    expect(slot(root, 'kbd-group').classList.contains('gap-0.5')).toBe(true)
    const kbd = slot(root, 'kbd')
    expect(kbd.tagName).toBe('KBD')
    expect(kbd.classList.contains('min-h-4')).toBe(true)
  })

  test('KbdChord draws one key per character and is hidden from assistive tech', () => {
    const root = dom.mount(() => <KbdChord keys="⌘K" />)
    const group = slot(root, 'kbd-group')
    expect(group.getAttribute('aria-hidden')).toBe('true')
    expect([...root.querySelectorAll('[data-slot="kbd"]')].map((key) => key.textContent)).toEqual([
      '⌘',
      'K',
    ])
  })
})

describe('InputControl', () => {
  test('is a text input at medium size unless told otherwise', () => {
    const input = slot(
      dom.mount(() => <InputControl placeholder="Name" />),
      'input'
    ) as HTMLInputElement
    expect(input.type).toBe('text')
    expect(input.getAttribute('placeholder')).toBe('Name')
    expect(input.classList.contains('h-control-md')).toBe(true)
  })

  test.each([
    ['sm', 'h-control-sm'],
    ['lg', 'h-control-lg'],
  ] as const)('size %s sets its control height', (size, expected) => {
    const input = slot(
      dom.mount(() => <InputControl size={size} type="email" />),
      'input'
    ) as HTMLInputElement
    expect(input.type).toBe('email')
    expect(input.classList.contains(expected)).toBe(true)
    expect(input.classList.contains('h-control-md')).toBe(false)
  })
})

describe('Textarea', () => {
  test('applies variant, size and resize classes', () => {
    const textarea = slot(
      dom.mount(() => <Textarea variant="code" size="comfortable" resize="none" />),
      'textarea'
    )
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea.classList.contains('font-mono')).toBe(true)
    expect(textarea.classList.contains('max-h-48')).toBe(true)
    expect(textarea.classList.contains('resize-none')).toBe(true)
  })

  test('passes its own accessibility attributes through when it is not in a field', () => {
    const textarea = slot(
      dom.mount(() => (
        <Textarea id="notes" aria-label="Notes" aria-describedby="hint" aria-invalid="true" />
      )),
      'textarea'
    )
    expect(textarea.id).toBe('notes')
    expect(textarea.getAttribute('aria-label')).toBe('Notes')
    expect(textarea.getAttribute('aria-describedby')).toBe('hint')
    expect(textarea.getAttribute('aria-invalid')).toBe('true')
  })

  test('takes its id, label and error wiring from an enclosing form field', () => {
    const field = createFormFieldContext({
      defaultControlId: 'field-control',
      labelId: 'field-label',
      descriptionId: 'field-hint',
      errorId: 'field-error',
      hint: () => 'A hint',
      error: () => 'Required',
      group: () => false,
    })
    const textarea = slot(
      dom.mount(() => (
        <FormFieldContext.Provider value={field}>
          <Textarea />
        </FormFieldContext.Provider>
      )),
      'textarea'
    )
    expect(textarea.id).toBe('field-control')
    expect(textarea.getAttribute('aria-labelledby')).toBe('field-label')
    expect(textarea.getAttribute('aria-describedby')).toBe('field-hint field-error')
    expect(textarea.getAttribute('aria-invalid')).toBe('true')
    expect(textarea.getAttribute('aria-errormessage')).toBe('field-error')
  })

  test('hands its element to a ref callback', () => {
    let received: HTMLTextAreaElement | undefined
    dom.mount(() => <Textarea ref={(element) => (received = element)} />)
    expect(received?.tagName).toBe('TEXTAREA')
  })
})
